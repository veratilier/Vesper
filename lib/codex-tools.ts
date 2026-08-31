import { allowedDocumentKeys } from "@/db/schema";
import { ensureSchema, getDb } from "@/lib/db";

type ToolInput = Record<string, unknown>;
type MusicTrack = { id: string; neteaseId?: string; title: string; artist: string; album?: string; cover?: string; duration?: string; url?: string; playable?: boolean };
type MusicPlayback = { trackId?: string; playing?: boolean; positionSeconds?: number; durationSeconds?: number; queueLength?: number; updatedAt?: string };
type NeteaseSourceSong = { id?: string | number; name?: string; dt?: number; ar?: Array<{ name?: string }>; al?: { name?: string; picUrl?: string } };

const sectionToKey: Record<string, string> = {
  today: "todos",
  notes: "notes",
  reminders: "todos",
  dates: "anniversaries",
  anniversaries: "anniversaries",
  journal: "diary",
  diary: "diary",
  music: "music",
  memory: "externalMemory",
  settings: "settings",
};

export const codexToolDefinitions = [
  {
    name: "read_vesper_state",
    description: "Read one Vesper document or section. Read-only; never changes data.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        section: {
          type: "string",
          enum: ["today", "notes", "reminders", "dates", "journal", "music", "memory", "settings"],
          description: "The Vesper section to read.",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "search_vesper_state",
    description: "Search Vesper notes, reminders, anniversaries, journal, and music by text. Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string", description: "Text to search for." } },
      required: ["query"],
    },
  },
  {
    name: "write_vesper_state",
    description: "Create a Vesper note, reminder, anniversary, or agent journal entry.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["note", "reminder", "anniversary", "journal"] },
        text: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD for reminders, anniversaries, or journal." },
        repeats: { type: "boolean" },
        due: { type: "string" },
        tag: { type: "string" },
      },
      required: ["kind"],
    },
  },
  {
    name: "music_get_status",
    description: "Read the current device playback state, including the playing song, playing/paused state, position, duration and queue length. Use this before answering what is currently playing.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "music_search",
    description: "Search the Vesper music library by title, artist, album, or keyword. Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } },
      required: ["query"],
    },
  },
  {
    name: "music_netease_search",
    description: "Search the public NetEase Music catalog, save the returned songs to Vesper music, then use music_send_card, music_queue_add, or music_play with an exact trackId. This does not edit a NetEase playlist.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 10 } },
      required: ["query"],
    },
  },
  {
    name: "music_play",
    description: "Play one uniquely identified Vesper song on the user's current device. Never claims success when no playable audio URL exists.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { trackId: { type: "string" }, replaceQueue: { type: "boolean", default: false } },
      required: ["trackId"],
    },
  },
  {
    name: "music_control",
    description: "Control the current device player without searching: play/resume, pause, next track, or previous track.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { action: { type: "string", enum: ["play", "pause", "next", "previous"] } },
      required: ["action"],
    },
  },
  {
    name: "music_queue_add",
    description: "Add one Vesper song to the shared playback queue, either next or at the end.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { trackId: { type: "string" }, position: { type: "string", enum: ["next", "end"] } },
      required: ["trackId", "position"],
    },
  },
  {
    name: "music_send_card",
    description: "Return a structured Vesper song card for the chat timeline without starting playback.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { trackId: { type: "string" }, message: { type: "string" } },
      required: ["trackId"],
    },
  },
  {
    name: "music_playlist_add",
    description: "Add a Vesper song to the persistent local music library/playlist; this is separate from the temporary playback queue.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { trackId: { type: "string" } },
      required: ["trackId"],
    },
  },
] as const;

async function readDocument(key: string): Promise<unknown> {
  if (!allowedDocumentKeys.has(key)) throw new Error("Unsupported Vesper document");
  const row = await getDb().prepare("SELECT value FROM vesper_documents WHERE key = ?")
    .bind(key).first<{ value: string }>();
  if (!row) return key === "diary" || key === "settings" ? {} : [];
  try { return JSON.parse(row.value); } catch { return null; }
}

async function writeDocument(key: string, value: unknown) {
  if (!allowedDocumentKeys.has(key)) throw new Error("Unsupported Vesper document");
  await getDb().prepare(`INSERT INTO vesper_documents(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();
  return value;
}

async function readMusicTracks(key: "music" | "musicQueue") {
  const value = await readDocument(key);
  return Array.isArray(value) ? value.filter((item): item is MusicTrack => Boolean(item && typeof item === "object" && typeof (item as MusicTrack).id === "string")) : [];
}
function findMusicTrack(tracks: MusicTrack[], trackId: string) {
  return tracks.find((track) => track.id === trackId || track.neteaseId === trackId);
}
async function readMusicLibrary() {
  const [library, queue] = await Promise.all([readMusicTracks("music"), readMusicTracks("musicQueue")]);
  const seen = new Set<string>();
  return [...library, ...queue].filter((track) => {
    const stableId = track.neteaseId ? `netease:${track.neteaseId}` : `id:${track.id}`;
    if (seen.has(stableId)) return false;
    seen.add(stableId);
    return true;
  });
}
function musicDuration(milliseconds?: number) {
  if (!milliseconds) return "";
  return `${Math.floor(milliseconds / 60_000)}:${String(Math.floor(milliseconds / 1_000) % 60).padStart(2, "0")}`;
}
function neteaseTrack(song: NeteaseSourceSong, url = ""): MusicTrack {
  const neteaseId = String(song.id || "");
  return {
    id: `netease-${neteaseId}`,
    neteaseId,
    title: song.name || "未命名歌曲",
    artist: song.ar?.map((artist) => artist.name).filter(Boolean).join(" / ") || "未知歌手",
    album: song.al?.name || "",
    duration: musicDuration(song.dt),
    cover: song.al?.picUrl?.replace(/^http:\/\//i, "https://") || "",
    url,
    playable: Boolean(url),
  };
}
async function neteaseRequest(path: string, params: Record<string, string>) {
  const response = await fetch(`https://music-api.r-vera.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(params),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || Number(result.code || 200) >= 400) throw new Error("网易云搜索暂时不可用");
  return result;
}
async function mergeMusicLibrary(incoming: MusicTrack[]) {
  const library = await readMusicTracks("music");
  const merged = [...library];
  for (const track of incoming) {
    const index = merged.findIndex((item) => item.id === track.id || (item.neteaseId && item.neteaseId === track.neteaseId));
    if (index >= 0) merged[index] = { ...merged[index], ...track };
    else merged.push(track);
  }
  await writeDocument("music", merged);
  return incoming;
}
function publicTrack(track?: MusicTrack) {
  if (!track) return null;
  return { trackId: track.id, title: track.title, artist: track.artist, album: track.album || "", cover: track.cover || "", duration: track.duration || "", playable: Boolean(track.url && track.playable !== false), source: track.neteaseId ? "netease" : "vesper" };
}
async function readMusicStatus() {
  const [library, queue, playbackValue] = await Promise.all([readMusicLibrary(), readMusicTracks("musicQueue"), readDocument("musicPlayback")]);
  const playback = playbackValue && typeof playbackValue === "object" && !Array.isArray(playbackValue) ? playbackValue as MusicPlayback : {};
  const current = playback.trackId ? findMusicTrack(queue, playback.trackId) || findMusicTrack(library, playback.trackId) : undefined;
  return {
    available: Boolean(current),
    playback: {
      track: publicTrack(current),
      playing: playback.playing === true,
      positionSeconds: Number.isFinite(playback.positionSeconds) ? Math.max(0, Number(playback.positionSeconds)) : null,
      durationSeconds: Number.isFinite(playback.durationSeconds) ? Math.max(0, Number(playback.durationSeconds)) : null,
      updatedAt: typeof playback.updatedAt === "string" ? playback.updatedAt : null,
    },
    queueLength: queue.length,
    libraryLength: library.length,
  };
}

export async function executeCodexTool(name: string, input: ToolInput) {
  await ensureSchema();
  if (name === "read_vesper_state") {
    const section = String(input.section || "notes").toLowerCase();
    const key = sectionToKey[section];
    if (!key) throw new Error(`Unknown Vesper section: ${section}`);
    if (section === "music") return { section, value: await readMusicStatus() };
    return { section, value: await readDocument(key) };
  }
  if (name === "search_vesper_state") {
    const query = String(input.query || "").trim().toLowerCase();
    if (!query) return { matches: [] };
    const matches: Array<{ section: string; value: unknown }> = [];
    for (const [section, key] of Object.entries(sectionToKey)) {
      const value = await readDocument(key);
      if (JSON.stringify(value).toLowerCase().includes(query)) matches.push({ section, value });
    }
    return { matches: matches.filter((item, index, list) => list.findIndex((candidate) => candidate.section === item.section) === index) };
  }
  if (name === "write_vesper_state") {
    const kind = String(input.kind || "").toLowerCase();
    const now = new Date().toISOString();
    if (kind === "note") {
      const text = String(input.text || input.title || "").trim();
      if (!text) throw new Error("Note text is required");
      const notes = (await readDocument("notes")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), text, kind: "agent", tone: "cool", createdAt: now };
      await writeDocument("notes", [...notes, entry]);
      return { saved: true, section: "notes", entry };
    }
    if (kind === "reminder") {
      const title = String(input.title || input.text || "").trim();
      if (!title) throw new Error("Reminder title is required");
      const todos = (await readDocument("todos")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), title, done: false, due: String(input.due || input.date || ""), tag: String(input.tag || "Agent"), createdAt: now };
      await writeDocument("todos", [...todos, entry]);
      return { saved: true, section: "reminders", entry };
    }
    if (kind === "anniversary") {
      const title = String(input.title || input.text || "").trim();
      const date = String(input.date || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Anniversary title/date is invalid");
      const anniversaries = (await readDocument("anniversaries")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), title, date, repeats: input.repeats !== false };
      await writeDocument("anniversaries", [...anniversaries, entry]);
      return { saved: true, section: "anniversaries", entry };
    }
    if (kind === "journal") {
      const date = String(input.date || "");
      const text = String(input.text || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) throw new Error("Journal date/text is invalid");
      const diary = { ...await readDocument("diary") as Record<string, unknown> };
      diary[date] = { ...(diary[date] as Record<string, unknown> || {}), agent: text, updatedAt: now };
      await writeDocument("diary", diary);
      return { saved: true, section: "journal", date };
    }
    throw new Error(`Unsupported write kind: ${kind}`);
  }
  if (name === "music_get_status") return await readMusicStatus();
  if (name === "music_search") {
    const query = String(input.query || "").trim().toLowerCase();
    const limit = Math.min(20, Math.max(1, Number(input.limit || 8)));
    if (!query) return { matches: [] };
    const matches = (await readMusicLibrary()).filter((track) => JSON.stringify(track).toLowerCase().includes(query)).slice(0, limit).map((track) => publicTrack(track));
    return { matches };
  }
  if (name === "music_netease_search") {
    const query = String(input.query || "").trim();
    const limit = Math.min(10, Math.max(1, Number(input.limit || 6)));
    if (!query) throw new Error("请输入要搜索的歌名、歌手或专辑");
    const search = await neteaseRequest("/cloudsearch", { keywords: query, limit: String(limit), type: "1" });
    const songs = ((search.result as { songs?: NeteaseSourceSong[] } | undefined)?.songs || []).slice(0, limit);
    const ids = songs.map((song) => String(song.id || "")).filter(Boolean);
    const urls = new Map<string, string>();
    if (ids.length) {
      try {
        const source = await neteaseRequest("/song/url/v1", { id: ids.join(","), level: "standard" });
        for (const item of ((source.data as Array<{ id?: string | number; url?: string }> | undefined) || [])) {
          if (item.id && item.url) urls.set(String(item.id), item.url.replace(/^http:\/\//i, "https://"));
        }
      } catch {
        // Search remains useful when a temporary signed URL cannot be returned.
      }
    }
    const imported = await mergeMusicLibrary(songs.map((song) => neteaseTrack(song, urls.get(String(song.id)) || "")));
    return {
      query,
      imported: imported.length,
      matches: imported.map((track) => publicTrack(track)),
      musicLibraryRefresh: true,
      note: "歌曲已加入 Vesper 音乐库；若该设备已连接网易云账号，聊天中的歌曲卡片会使用本机 MUSIC_U 刷新可播放链接。",
    };
  }
  if (name === "music_play") {
    const trackId = String(input.trackId || "");
    const tracks = await readMusicLibrary();
    const track = findMusicTrack(tracks, trackId);
    if (!track) throw new Error("找不到指定歌曲，请先使用 music_search");
    if (!track.url || track.playable === false) throw new Error("这首歌没有可播放音源");
    const queue = await readMusicTracks("musicQueue");
    const replaceQueue = input.replaceQueue === true;
    const nextQueue = replaceQueue ? [track] : queue.some((item) => item.id === track.id || item.neteaseId === track.neteaseId) ? queue : [...queue, track];
    await writeDocument("musicQueue", nextQueue);
    const command = { id: crypto.randomUUID(), action: "play_track", trackId: track.id, replaceQueue, createdAt: new Date().toISOString() };
    await writeDocument("musicControl", command);
    return { ok: true, action: "playing", track: { trackId: track.id, title: track.title, artist: track.artist }, queueLength: nextQueue.length };
  }
  if (name === "music_control") {
    const action = String(input.action || "");
    if (!(["play", "pause", "next", "previous"] as string[]).includes(action)) throw new Error("Unsupported music control action");
    const status = await readMusicStatus();
    if (action === "play" && !status.playback.track) throw new Error("当前没有可继续播放的歌曲");
    const command = { id: crypto.randomUUID(), action, createdAt: new Date().toISOString() };
    await writeDocument("musicControl", command);
    return { ok: true, action, command, playback: status.playback };
  }
  if (name === "music_queue_add") {
    const trackId = String(input.trackId || "");
    const position = input.position === "next" ? "next" : "end";
    const track = findMusicTrack(await readMusicLibrary(), trackId);
    if (!track) throw new Error("找不到指定歌曲，请先使用 music_search");
    const queue = await readMusicTracks("musicQueue");
    if (queue.some((item) => item.id === track.id || item.neteaseId === track.neteaseId)) return { ok: true, alreadyQueued: true, trackId: track.id, queueLength: queue.length };
    if (position === "next") queue.splice(Math.min(1, queue.length), 0, track);
    else queue.push(track);
    await writeDocument("musicQueue", queue);
    return { ok: true, position, trackId: track.id, queueLength: queue.length };
  }
  if (name === "music_send_card") {
    const trackId = String(input.trackId || "");
    const track = findMusicTrack(await readMusicLibrary(), trackId);
    if (!track) throw new Error("找不到指定歌曲，请先使用 music_search");
    return { ok: true, musicCard: { trackId: track.id, title: track.title, artist: track.artist, album: track.album || "", cover: track.cover || "", duration: track.duration || "", url: track.url || "", playable: Boolean(track.url && track.playable !== false), source: track.neteaseId ? "netease" : "vesper", message: typeof input.message === "string" ? input.message : "" } };
  }
  if (name === "music_playlist_add") {
    const trackId = String(input.trackId || "");
    const tracks = await readMusicLibrary();
    const track = findMusicTrack(tracks, trackId);
    if (!track) throw new Error("找不到指定歌曲，请先使用 music_search");
    return { ok: true, alreadyInPlaylist: true, trackId: track.id, playlist: "Vesper music" };
  }
  throw new Error(`Unknown Codex tool: ${name}`);
}
