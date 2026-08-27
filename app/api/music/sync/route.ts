import { ensureSchema, getDb } from "@/lib/db";
import { authorizeApp } from "@/lib/bridge-auth";
import { corsHeaders, optionsResponse } from "@/lib/cors";

type MusicTrack = {
  id: string;
  neteaseId?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  cover?: string;
  url: string;
  playable?: boolean;
};

const DEFAULT_API = "https://music-api.r-vera.com";

function json(request: Request, value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders(request, { "cache-control": "no-store" }) });
}

export const OPTIONS = optionsResponse;

async function readDocument<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().prepare("SELECT value FROM vesper_documents WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

async function writeDocument(key: string, value: unknown) {
  await getDb().prepare(`INSERT INTO vesper_documents(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();
}

async function neteaseProxy(baseUrl: string, path: string, params: Record<string, string>, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" };
  if (cookie) headers["cookie"] = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(params),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || Number(result.code || 200) >= 400) throw new Error(`网易云接口返回 ${result.code || response.status}`);
  return result;
}

function playlistIdFrom(value: string) {
  const trimmed = value.trim();
  const queryMatch = trimmed.match(/[?&]id=(\d+)/i);
  const pathMatch = trimmed.match(/playlist\/(\d+)/i);
  const plainMatch = trimmed.match(/^\d+$/);
  return queryMatch?.[1] || pathMatch?.[1] || (plainMatch ? trimmed : "");
}

export async function POST(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: "Device not paired" }, 401);
  await ensureSchema();
  try {
    const body = await request.json() as {
      action?: "sync";
      playlistId?: string;
      musicU?: string;
      csrf?: string;
      uid?: string;
      baseUrl?: string;
    };
    if (body.action !== "sync") throw new Error("未知同步操作");
    const playlistId = playlistIdFrom(String(body.playlistId || ""));
    if (!playlistId) throw new Error("请填写歌单 ID");

    const baseUrl = (body.baseUrl || DEFAULT_API).trim().replace(/\/$/, "");
    const cookie = body.musicU ? `MUSIC_U=${body.musicU}${body.csrf ? `; __csrf=${body.csrf}` : ""}` : undefined;

    const detail = await neteaseProxy(baseUrl, "/playlist/track/all", { id: playlistId, limit: "500", offset: "0" }, cookie);
    const songs = (detail.songs as Array<{ id: number | string; name: string; dt?: number; ar?: Array<{ name?: string }>; al?: { name?: string; picUrl?: string } }> | undefined) || [];
    if (!songs.length) throw new Error("歌单中没有可同步歌曲");

    const urlMap = new Map<string, string>();
    for (let offset = 0; offset < songs.length; offset += 100) {
      const ids = songs.slice(offset, offset + 100).map((s) => s.id).join(",");
      const urls = await neteaseProxy(baseUrl, "/song/url/v1", { id: ids, level: "standard" }, cookie);
      for (const item of (urls.data as Array<{ id?: number | string; url?: string }> | undefined) || [])
        if (item.id && item.url) urlMap.set(String(item.id), item.url);
    }

    const incoming: MusicTrack[] = songs.map((song) => {
      const neteaseId = String(song.id);
      const audioUrl = urlMap.get(neteaseId) || "";
      return {
        id: `netease-${neteaseId}`,
        neteaseId,
        title: song.name,
        artist: song.ar?.map((a) => a.name).filter(Boolean).join(" / ") || "未知歌手",
        album: song.al?.name || "",
        duration: song.dt ? `${Math.floor(song.dt / 60000)}:${String(Math.floor(song.dt / 1000) % 60).padStart(2, "0")}` : undefined,
        cover: song.al?.picUrl || "",
        url: audioUrl,
        playable: Boolean(audioUrl),
      };
    });

    const existing = await readDocument<MusicTrack[]>("music", []);
    const existingQueue = await readDocument<MusicTrack[]>("musicQueue", []);
    const byKey = (track: MusicTrack) => track.neteaseId ? `netease:${track.neteaseId}` : `id:${track.id}`;
    const merged = [...existing];
    for (const track of incoming) {
      const index = merged.findIndex((item) => byKey(item) === byKey(track));
      if (index >= 0) merged[index] = { ...merged[index], ...track };
      else merged.push(track);
    }
    const queue = existingQueue.length ? [...existingQueue] : [];
    for (const track of incoming) if (!queue.some((item) => byKey(item) === byKey(track))) queue.push(track);
    await writeDocument("music", merged);
    await writeDocument("musicQueue", queue);
    const syncedAt = new Date().toISOString();
    const playable = incoming.filter((t) => t.playable).length;
    return json(request, {
      ok: true, tracks: merged, queue,
      meta: { playlistId, ...(body.musicU ? { musicU: body.musicU } : {}), ...(body.csrf ? { csrf: body.csrf } : {}), ...(body.uid ? { uid: body.uid } : {}), lastSyncAt: syncedAt },
      summary: `同步完成：${incoming.length} 首歌曲，${playable} 首可播放，新增 ${Math.max(0, merged.length - existing.length)} 首`,
    });
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "网易云同步失败" }, 400);
  }
}
