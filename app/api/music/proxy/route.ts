import { corsHeaders, optionsResponse } from "@/lib/cors";

export const OPTIONS = optionsResponse;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return new Response("Missing url parameter", { status: 400, headers: corsHeaders(request) });

  try {
    const upstream = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "referer": "https://music.163.com/",
      },
      redirect: "follow",
    });

    if (!upstream.ok) return new Response("Upstream error", { status: 502, headers: corsHeaders(request) });

    const headers = corsHeaders(request, {
      "content-type": upstream.headers.get("content-type") || "audio/mpeg",
      "cache-control": "public, max-age=3600",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response("Proxy fetch failed", { status: 502, headers: corsHeaders(request) });
  }
}
