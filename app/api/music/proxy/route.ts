import { corsHeaders, optionsResponse } from "@/lib/cors";

export const OPTIONS = optionsResponse;

const DEFAULT_API = "https://music-api.r-vera.com";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const directUrl = params.get("url");
  const neteaseId = params.get("id");

  if (!directUrl && !neteaseId) return new Response("Missing url or id", { status: 400, headers: corsHeaders(request) });

  let audioUrl = directUrl;

  if (!audioUrl && neteaseId) {
    try {
      const response = await fetch(`${DEFAULT_API}/song/url/v1`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({ id: neteaseId, level: "standard" }),
      });
      const result = await response.json() as { data?: Array<{ id?: number | string; url?: string }> };
      const item = (result.data || []).find((d) => String(d.id) === neteaseId);
      audioUrl = item?.url || null;
      if (!audioUrl) return new Response("No playable URL", { status: 404, headers: corsHeaders(request) });
    } catch {
      return new Response("Failed to resolve audio URL", { status: 502, headers: corsHeaders(request) });
    }
  }

  try {
    const upstream = await fetch(audioUrl!, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "referer": "https://music.163.com/",
      },
      redirect: "follow",
    });

    if (!upstream.ok) return new Response("Upstream error", { status: 502, headers: corsHeaders(request) });

    const headers = corsHeaders(request, {
      "content-type": upstream.headers.get("content-type") || "audio/mpeg",
      "cache-control": "public, max-age=600",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response("Proxy fetch failed", { status: 502, headers: corsHeaders(request) });
  }
}
