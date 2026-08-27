import { ensureSchema, getDb } from "@/lib/db";
import { corsHeaders, optionsResponse } from "@/lib/cors";

export const OPTIONS = optionsResponse;

const DEFAULT_API = "https://music-api.r-vera.com";

async function getStoredCookie(): Promise<string | undefined> {
  try {
    await ensureSchema();
    const row = await getDb().prepare("SELECT value FROM vesper_documents WHERE key = ?").bind("musicAuth").first<{ value: string }>();
    if (!row) return undefined;
    const auth = JSON.parse(row.value) as { musicU?: string; csrf?: string };
    if (!auth.musicU) return undefined;
    return `MUSIC_U=${auth.musicU}${auth.csrf ? `; __csrf=${auth.csrf}` : ""}`;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const neteaseId = params.get("id");

  if (!neteaseId) return new Response("Missing id", { status: 400, headers: corsHeaders(request) });

  const cookie = await getStoredCookie();

  try {
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" };
    if (cookie) headers["cookie"] = cookie;

    const response = await fetch(`${DEFAULT_API}/song/url/v1`, {
      method: "POST",
      headers,
      body: new URLSearchParams({ id: neteaseId, level: "standard" }),
    });
    const result = await response.json() as { data?: Array<{ id?: number | string; url?: string }> };
    const item = (result.data || []).find((d) => String(d.id) === neteaseId);
    const audioUrl = item?.url;
    if (!audioUrl) return new Response("No playable URL", { status: 404, headers: corsHeaders(request) });

    const upstream = await fetch(audioUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "referer": "https://music.163.com/",
      },
      redirect: "follow",
    });

    if (!upstream.ok) return new Response("Upstream error", { status: 502, headers: corsHeaders(request) });

    const respHeaders = corsHeaders(request, {
      "content-type": upstream.headers.get("content-type") || "audio/mpeg",
      "cache-control": "public, max-age=600",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) respHeaders.set("content-length", contentLength);

    return new Response(upstream.body, { status: 200, headers: respHeaders });
  } catch {
    return new Response("Proxy fetch failed", { status: 502, headers: corsHeaders(request) });
  }
}
