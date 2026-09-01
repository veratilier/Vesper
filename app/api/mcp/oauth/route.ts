function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tokenUrl?: string;
      code?: string;
      verifier?: string;
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      resource?: string;
    };
    const tokenUrl = new URL(body.tokenUrl || "");
    if (tokenUrl.protocol !== "https:")
      return json({ error: "Token URL 必须使用 HTTPS" }, 400);
    if (!body.code || !body.verifier || !body.clientId || !body.redirectUri)
      return json({ error: "OAuth 回调参数不完整" }, 400);
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code: body.code,
      client_id: body.clientId,
      redirect_uri: body.redirectUri,
      code_verifier: body.verifier,
    });
    if (body.clientSecret) form.set("client_secret", body.clientSecret);
    if (body.resource) form.set("resource", body.resource);
    const response = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: form,
    });
    const result = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !result.access_token)
      return json(
        { error: result.error_description || result.error || `Token 服务返回 ${response.status}` },
        502,
      );
    return json({
      accessToken: result.access_token,
      tokenType: result.token_type || "Bearer",
      expiresIn: result.expires_in,
    });
  } catch (reason) {
    return json({ error: reason instanceof Error ? reason.message : "OAuth 授权失败" }, 400);
  }
}
