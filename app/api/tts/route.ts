function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}

function safeHttpsUrl(value: unknown) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error("TTS 地址必须使用 HTTPS");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" || host === "127.0.0.1" || host === "::1" ||
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) throw new Error("不能连接本机或私网 TTS 地址");
  return url;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string; connection?: Record<string, string> };
    const text = String(body.text || "").trim().slice(0, 4_000);
    const connection = body.connection || {};
    if (!text) return json({ error: "朗读文本不能为空" }, 400);
    if (!connection.baseUrl || !connection.apiKey)
      return json({ error: "请先在设置中填写 TTS 地址和 API Key" }, 400);
    const provider = (connection.provider || "").toLowerCase();
    const base = safeHttpsUrl(connection.baseUrl.replace(/\/$/, ""));
    const isElevenLabs = provider.includes("eleven") || base.hostname.includes("elevenlabs");
    const endpoint = connection.endpoint
      ? safeHttpsUrl(connection.endpoint)
      : isElevenLabs
        ? safeHttpsUrl(`${base.toString().replace(/\/$/, "")}/v1/text-to-speech/${encodeURIComponent(connection.voiceId || "")}`)
        : safeHttpsUrl(`${base.toString().replace(/\/$/, "")}/audio/speech`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: isElevenLabs
        ? { "content-type": "application/json", accept: "audio/mpeg", "xi-api-key": connection.apiKey }
        : { "content-type": "application/json", accept: "audio/mpeg, audio/*", authorization: `Bearer ${connection.apiKey}` },
      body: JSON.stringify(isElevenLabs
        ? { text, model_id: connection.model || "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }
        : { model: connection.model || "gpt-4o-mini-tts", voice: connection.voiceId || "alloy", input: text, response_format: "mp3" }),
      redirect: "error",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return json({ error: detail || `TTS 返回 ${response.status}` }, 502);
    }
    return new Response(response.body, {
      headers: { "content-type": response.headers.get("content-type") || "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (reason) {
    return json({ error: reason instanceof Error ? reason.message : "TTS 请求失败" }, 400);
  }
}
