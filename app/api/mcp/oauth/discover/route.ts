type JsonRecord = Record<string, unknown>;

function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function safeHttpsUrl(value: unknown) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error("MCP 与 OAuth 地址必须使用 HTTPS");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) throw new Error("不能访问本机或私网 OAuth 地址");
  return url;
}

async function readJson(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) return null;
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) throw new Error("OAuth 元数据过大");
  return (await response.json()) as JsonRecord;
}

function metadataCandidates(resource: URL, challenge?: string | null) {
  const fromHeader = challenge?.match(/resource_metadata="([^"]+)"/i)?.[1];
  const path = resource.pathname === "/" ? "" : resource.pathname;
  return [
    fromHeader,
    `${resource.origin}/.well-known/oauth-protected-resource${path}`,
    `${resource.origin}/.well-known/oauth-protected-resource`,
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

async function discoverResource(resource: URL) {
  let challenge = "";
  try {
    const probe = await fetch(resource, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Vesper", version: "1.0" } },
      }),
      redirect: "error",
    });
    challenge = probe.headers.get("www-authenticate") || "";
  } catch {}
  for (const candidate of metadataCandidates(resource, challenge)) {
    try {
      const value = await readJson(safeHttpsUrl(candidate));
      if (value) return { value, challenge };
    } catch {}
  }
  throw new Error("MCP 没有提供 OAuth Protected Resource Metadata");
}

async function discoverAuthorizationServer(issuer: URL) {
  const issuerPath = issuer.pathname === "/" ? "" : issuer.pathname.replace(/\/$/, "");
  const candidates = [
    `${issuer.origin}/.well-known/oauth-authorization-server${issuerPath}`,
    `${issuer.origin}${issuerPath}/.well-known/openid-configuration`,
    `${issuer.origin}/.well-known/openid-configuration${issuerPath}`,
  ];
  for (const candidate of candidates) {
    try {
      const value = await readJson(safeHttpsUrl(candidate));
      if (value?.authorization_endpoint && value?.token_endpoint) return value;
    } catch {}
  }
  throw new Error("无法从授权服务器发现授权端点");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      redirectUri?: string;
      clientId?: string;
    };
    const resource = safeHttpsUrl(body.url);
    const redirectUri = safeHttpsUrl(body.redirectUri).toString();
    const { value: protectedResource, challenge } = await discoverResource(resource);
    const authorizationServers = protectedResource.authorization_servers;
    if (!Array.isArray(authorizationServers) || !authorizationServers.length)
      throw new Error("MCP 元数据没有声明授权服务器");
    const issuer = safeHttpsUrl(authorizationServers[0]);
    const metadata = await discoverAuthorizationServer(issuer);
    const methods = Array.isArray(metadata.code_challenge_methods_supported)
      ? metadata.code_challenge_methods_supported.map(String)
      : [];
    if (!methods.includes("S256")) throw new Error("该授权服务器没有声明支持 PKCE S256");

    let clientId = body.clientId?.trim() || "";
    let clientSecret = "";
    const registrationEndpoint = metadata.registration_endpoint;
    if (!clientId && typeof registrationEndpoint === "string") {
      const registration = await fetch(safeHttpsUrl(registrationEndpoint), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_name: "Vesper",
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code"],
          response_types: ["code"],
        }),
        redirect: "error",
      });
      const registered = (await registration.json()) as { client_id?: string; client_secret?: string; error_description?: string };
      if (!registration.ok || !registered.client_id)
        throw new Error(registered.error_description || "OAuth 客户端自动注册失败");
      clientId = registered.client_id;
      clientSecret = registered.client_secret || "";
    }

    const challengedScope = challenge.match(/scope="([^"]+)"/i)?.[1];
    const scopes = challengedScope ||
      (Array.isArray(protectedResource.scopes_supported)
        ? protectedResource.scopes_supported.map(String).join(" ")
        : Array.isArray(metadata.scopes_supported)
          ? metadata.scopes_supported.map(String).join(" ")
          : "");
    return json({
      authorizationUrl: String(metadata.authorization_endpoint),
      tokenUrl: String(metadata.token_endpoint),
      clientId,
      clientSecret,
      scopes,
      resource: String(protectedResource.resource || resource),
      needsClientId: !clientId,
    });
  } catch (reason) {
    return json({ error: reason instanceof Error ? reason.message : "OAuth 自动发现失败" }, 400);
  }
}
