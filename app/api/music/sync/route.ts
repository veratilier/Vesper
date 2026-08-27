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

async function neteaseApi(path: string, cookie: string, data?: Record<string, string>) {
  const url = `https://music.163.com${path}`;
  const headers: Record<string, string> = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://music.163.com/",
  };
  const init: RequestInit = { headers };
  if (data) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.method = "POST";
    init.body = new URLSearchParams(data).toString();
  } else {
    init.method = "GET";
  }
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || (result.code !== undefined && Number(result.code) !== 200))
    throw new Error(`网易云接口返回 ${result.code ?? response.status}`);
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
    };
    if (body.action !== "sync") throw new Error("未知同步操作");
    if (!body.musicU) throw new Error("请填写 MUSIC_U");
    const playlistId = playlistIdFrom(String(body.playlistId || ""));
    if (!playlistId) throw new Error("请填写歌单 ID");

    const cookie = `MUSIC_U=${body.musicU}${body.csrf ? `; __csrf=${body.csrf}` : ""}`;

    const detail = await neteaseApi(`/api/v6/playlist/detail?id=${playlistId}`, cookie);
    const playlist = (detail.playlist || {}) as {
      tracks?: Array<{ id: number | string; name: string; dt?: number; ar?: Array<{ name?: string }>; al?: { name?: string; picUrl?: string } }>;
    };
    const songs = playlist.tracks || [];
    if (!songs.length) throw new Error("歌单中没有可同步歌曲");

    const songIds = songs.map((s) => s.id);

    const audioUrlMap = new Map<string, string>();
    for (let offset = 0; offset < songIds.length; offset += 100) {
      const batch = songIds.slice(offset, offset + 100);
      const ids = batch.join(",");
      try {
        const urlResult = await neteaseApi(`/api/song/enhance/player/url/v1?ids=[${ids}]&level=standard&encodeType=mp3`, cookie);
        for (const item of (urlResult.data as Array<{ id?: number | string; url?: string }> | undefined) || []) {
          if (item.id && item.url) audioUrlMap.set(String(item.id), item.url);
        }
      } catch {
        // fallback: try older endpoint
        try {
          const urlResult = await neteaseApi("/api/song/enhance/player/url", cookie, { ids: `[${ids}]`, br: "320000" });
          for (const item of (urlResult.data as Array<{ id?: number | string; url?: string }> | undefined) || []) {
            if (item.id && item.url) audioUrlMap.set(String(item.id), item.url);
          }
        } catch { /* some songs may not have playable URLs */ }
      }
    }

    const incoming: MusicTrack[] = songs.map((song) => {
      const neteaseId = String(song.id);
      const audioUrl = audioUrlMap.get(neteaseId) || "";
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
    return json(request, {
      ok: true, tracks: merged, queue,
      meta: { playlistId, musicU: body.musicU, ...(body.csrf ? { csrf: body.csrf } : {}), ...(body.uid ? { uid: body.uid } : {}), lastSyncAt: syncedAt },
      summary: `同步完成：读取 ${incoming.length} 首，新增 ${Math.max(0, merged.length - existing.length)} 首；本地独有歌曲已保留`,
    });
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "网易云同步失败" }, 400);
  }
}
