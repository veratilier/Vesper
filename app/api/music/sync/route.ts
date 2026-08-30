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

function json(request: Request, value: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("cache-control", "no-store");
  return Response.json(value, { status, headers });
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

function loginCookie(value: unknown) {
  const cookie = String(value || "").trim();
  if (!cookie || cookie.includes("=")) return cookie;
  // Let a user paste either a full `MUSIC_U=…` cookie or just its value.
  return `MUSIC_U=${cookie}`;
}

async function neteaseRequest(baseUrl: string, path: string, params: Record<string, string>, cookie = "") {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ ...params, ...(cookie ? { cookie } : {}) }),
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
      action?: "playlists" | "sync";
      baseUrl?: string;
      cookie?: string;
      uid?: string;
      playlistId?: string;
      bidirectional?: string | boolean;
    };
    const baseUrl = (body.baseUrl || "https://music-api.r-vera.com").trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(baseUrl)) throw new Error("网易云接口地址无效");
    if (body.bidirectional === true || body.bidirectional === "true") throw new Error("双向同步暂未启用；当前只执行保留本地歌曲的一向导入");
    const cookie = loginCookie(body.cookie);
    const uid = String(body.uid || "").trim();
    if (body.action === "playlists") {
      if (!uid) throw new Error("请先填写网易云 UID");
      if (!cookie) throw new Error("请粘贴 MUSIC_U 后再读取账号歌单");
      const result = await neteaseRequest(baseUrl, "/user/playlist", { uid, limit: "50" }, cookie);
      const playlists = ((result.playlist as Array<{ id?: string | number; name?: string; trackCount?: number }> | undefined) || [])
        .map((item) => ({ id: String(item.id || ""), name: item.name || "未命名歌单", trackCount: item.trackCount }))
        .filter((item) => item.id);
      return json(request, { playlists });
    }
    if (body.action !== "sync") throw new Error("未知同步操作");
    let playlistId = playlistIdFrom(String(body.playlistId || ""));
    if (!playlistId && uid && cookie) {
      const result = await neteaseRequest(baseUrl, "/user/playlist", { uid, limit: "50" }, cookie);
      playlistId = String(((result.playlist as Array<{ id?: string | number }> | undefined) || [])[0]?.id || "");
    }
    if (!playlistId) throw new Error("请填写网易云歌单 ID");
    const detail = await neteaseRequest(baseUrl, "/playlist/track/all", { id: playlistId, limit: "500", offset: "0" }, cookie);
    const songs = (detail.songs as Array<{ id: number | string; name: string; dt?: number; ar?: Array<{ name?: string }>; al?: { name?: string; picUrl?: string } }> | undefined) || [];
    if (!songs.length) throw new Error("歌单中没有可同步歌曲");
    const urlMap = new Map<string, string>();
    for (let offset = 0; offset < songs.length; offset += 100) {
      const ids = songs.slice(offset, offset + 100).map((song) => song.id).join(",");
      const urls = await neteaseRequest(baseUrl, "/song/url/v1", { id: ids, level: "standard" }, cookie);
      for (const item of (urls.data as Array<{ id?: number | string; url?: string }> | undefined) || []) {
        if (item.id && item.url) urlMap.set(String(item.id), item.url.replace(/^http:\/\//i, "https://"));
      }
    }
    const incoming: MusicTrack[] = songs.map((song) => {
      const neteaseId = String(song.id);
      const url = urlMap.get(neteaseId) || "";
      return { id: `netease-${neteaseId}`, neteaseId, title: song.name, artist: song.ar?.map((artist) => artist.name).filter(Boolean).join(" / ") || "未知歌手", album: song.al?.name || "", duration: song.dt ? `${Math.floor(song.dt / 60000)}:${String(Math.floor(song.dt / 1000) % 60).padStart(2, "0")}` : undefined, cover: song.al?.picUrl || "", url, playable: Boolean(url) };
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
    // Keep the person's queue order and locally-added tracks, but refresh URLs for
    // matching Netease tracks. Signed Netease URLs expire, so retaining the old
    // queue object here would make a successful authenticated sync still unplayable.
    const queue = existingQueue.length ? [...existingQueue] : [];
    for (const track of incoming) {
      const index = queue.findIndex((item) => byKey(item) === byKey(track));
      if (index >= 0) queue[index] = { ...queue[index], ...track };
      else queue.push(track);
    }
    await writeDocument("music", merged);
    await writeDocument("musicQueue", queue);
    const syncedAt = new Date().toISOString();
    return json(request, { ok: true, tracks: merged, queue, meta: { baseUrl, uid, playlistId, lastSyncAt: syncedAt }, summary: `同步完成：读取 ${incoming.length} 首，已刷新可播放链接；本地独有歌曲已保留` });
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "网易云同步失败" }, 400);
  }
}
