import { authorizeApp } from "@/lib/bridge-auth";
import { corsHeaders, optionsResponse } from "@/lib/cors";
import type { MusicSyncTrack } from "@/lib/music-service";

type MusicLibraryAction =
  | "search"
  | "playlists"
  | "playlist"
  | "recommendations"
  | "personal-fm"
  | "recent-plays"
  | "play-history"
  | "liked-songs"
  | "lyrics"
  | "resolve"
  | "playlist-add"
  | "playlist-remove";

type SourceSong = {
  id?: number | string;
  name?: string;
  dt?: number;
  ar?: Array<{ name?: string }>;
  artists?: Array<{ name?: string }>;
  al?: { name?: string; picUrl?: string };
  album?: { name?: string; picUrl?: string };
};

function json(request: Request, value: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("cache-control", "no-store");
  return Response.json(value, { status, headers });
}

export const OPTIONS = optionsResponse;

function loginCookie(value: unknown) {
  const cookie = String(value || "").trim();
  if (!cookie || cookie.includes("=")) return cookie;
  return `MUSIC_U=${cookie}`;
}

function duration(milliseconds?: number) {
  if (!milliseconds) return "";
  return `${Math.floor(milliseconds / 60_000)}:${String(Math.floor(milliseconds / 1_000) % 60).padStart(2, "0")}`;
}

function toTrack(song: SourceSong) {
  const id = String(song.id || "");
  const album = song.al || song.album;
  return {
    id: `netease-${id}`,
    neteaseId: id,
    title: song.name || "未命名歌曲",
    artist: (song.ar || song.artists || []).map((artist) => artist.name).filter(Boolean).join(" / ") || "未知歌手",
    album: album?.name || "",
    duration: duration(song.dt),
    cover: album?.picUrl?.replace(/^http:\/\//i, "https://") || "",
    url: "",
    playable: false,
  };
}

async function requestNetease(path: string, params: Record<string, string>, cookie = "") {
  const base = "https://music-api.r-vera.com";
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ ...params, ...(cookie ? { cookie } : {}) }),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || Number(result.code || 200) >= 400) throw new Error(`网易云接口返回 ${result.code || response.status}`);
  return result;
}

function sourceSongs(value: unknown) {
  return Array.isArray(value) ? value as SourceSong[] : [];
}

export async function POST(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: "Device not paired" }, 401);
  try {
    const body = await request.json() as {
      action?: MusicLibraryAction;
      uid?: string;
      cookie?: string;
      query?: string;
      playlistId?: string;
      songIds?: string[];
      tracks?: MusicSyncTrack[];
      limit?: number;
    };
    const action = body.action;
    const uid = String(body.uid || "").trim();
    const cookie = loginCookie(body.cookie);
    const requireAccount = () => {
      if (!cookie) throw new Error("请先连接网易云账号");
      if (!uid) throw new Error("请填写网易云 UID");
    };
    const limit = String(Math.max(1, Math.min(Number(body.limit) || 30, 100)));

    if (action === "search") {
      const query = String(body.query || "").trim();
      if (!query) throw new Error("请输入歌名、歌手或专辑");
      const result = await requestNetease("/cloudsearch", { keywords: query, limit, type: "1" }, cookie);
      const songs = (result.result as { songs?: SourceSong[] } | undefined)?.songs || [];
      return json(request, { title: `“${query}”`, subtitle: "搜索结果", tracks: songs.map(toTrack) });
    }

    if (action === "playlists") {
      requireAccount();
      const result = await requestNetease("/user/playlist", { uid, limit: "100" }, cookie);
      const playlists = ((result.playlist as Array<{ id?: number | string; name?: string; trackCount?: number; coverImgUrl?: string; description?: string; creator?: { nickname?: string } }> | undefined) || [])
        .map((playlist) => ({
          id: String(playlist.id || ""),
          name: playlist.name || "未命名歌单",
          trackCount: playlist.trackCount,
          cover: playlist.coverImgUrl?.replace(/^http:\/\//i, "https://") || "",
          description: playlist.description || "",
          creator: playlist.creator?.nickname || "",
        }))
        .filter((playlist) => playlist.id);
      return json(request, { playlists, summary: `已读取 ${playlists.length} 个歌单` });
    }

    if (action === "playlist") {
      const playlistId = String(body.playlistId || "").trim();
      if (!playlistId) throw new Error("请先选择歌单");
      const result = await requestNetease("/playlist/track/all", { id: playlistId, limit: "500", offset: "0" }, cookie);
      const songs = sourceSongs(result.songs);
      return json(request, { title: "歌单歌曲", tracks: songs.map(toTrack) });
    }

    if (action === "recommendations") {
      requireAccount();
      const result = await requestNetease("/recommend/songs", {}, cookie);
      const songs = sourceSongs((result.data as { dailySongs?: SourceSong[] } | undefined)?.dailySongs);
      return json(request, { title: "每日推荐", subtitle: "为你挑选的 30 首歌", tracks: songs.map(toTrack) });
    }

    if (action === "personal-fm") {
      requireAccount();
      const result = await requestNetease("/personal_fm", {}, cookie);
      return json(request, { title: "私人 FM", subtitle: "为你持续推荐", tracks: sourceSongs(result.data).map(toTrack) });
    }

    if (action === "recent-plays") {
      requireAccount();
      const result = await requestNetease("/record/recent/song", { limit }, cookie);
      const entries = (result.data as { list?: Array<{ data?: SourceSong }> } | undefined)?.list || [];
      return json(request, { title: "最近播放", tracks: entries.map((entry) => entry.data).filter((song): song is SourceSong => Boolean(song)).map(toTrack) });
    }

    if (action === "play-history") {
      requireAccount();
      const result = await requestNetease("/user/record", { uid, type: "1" }, cookie);
      const entries = (result.weekData as Array<{ song?: SourceSong }> | undefined) || [];
      return json(request, { title: "本周常听", tracks: entries.map((entry) => entry.song).filter((song): song is SourceSong => Boolean(song)).map(toTrack) });
    }

    if (action === "liked-songs") {
      requireAccount();
      const result = await requestNetease("/likelist", { uid }, cookie);
      const ids = Array.isArray(result.ids) ? result.ids.slice(0, 100).map(String) : [];
      if (!ids.length) return json(request, { title: "我喜欢的音乐", tracks: [] });
      // Some public mirrors omit /song/detail even when their playlist and URL
      // endpoints are available. Keep the library usable: entries can still be
      // resolved to audio, and normal playlist/history entries retain full data.
      return json(request, { title: "我喜欢的音乐", tracks: ids.map((id) => toTrack({ id, name: "网易云歌曲" })) });
    }

    if (action === "lyrics") {
      const songId = String(body.songIds?.[0] || "").trim();
      if (!songId) throw new Error("缺少歌曲 ID");
      const result = await requestNetease("/lyric", { id: songId }, cookie);
      return json(request, {
        lyrics: ((result.lrc as { lyric?: string } | undefined)?.lyric || "").trim(),
        translation: ((result.tlyric as { lyric?: string } | undefined)?.lyric || "").trim(),
      });
    }

    if (action === "playlist-add" || action === "playlist-remove") {
      requireAccount();
      const playlistId = String(body.playlistId || "").trim();
      const ids = Array.isArray(body.songIds) ? body.songIds.map(String).filter(Boolean).slice(0, 100) : [];
      if (!playlistId) throw new Error("请先选择网易云歌单");
      if (!ids.length) throw new Error("没有可更新的歌曲");
      // This is deliberately only reached by an explicit in-app confirmation.
      // MUSIC_U is forwarded for this request but never persisted by the Worker.
      await requestNetease("/playlist/tracks", {
        op: action === "playlist-add" ? "add" : "del",
        pid: playlistId,
        tracks: ids.join(","),
      }, cookie);
      return json(request, { ok: true, summary: action === "playlist-add" ? "已加入网易云歌单" : "已从网易云歌单移除" });
    }

    if (action === "resolve") {
      const ids = Array.isArray(body.songIds) ? body.songIds.map(String).filter(Boolean).slice(0, 100) : [];
      if (!ids.length) throw new Error("没有可播放的歌曲");
      const supplied = new Map(
        (Array.isArray(body.tracks) ? body.tracks : [])
          .map((track) => [String(track.neteaseId || track.id.replace(/^netease-/, "")), track] as const)
          .filter(([id]) => ids.includes(id)),
      );
      const result = await requestNetease("/song/url/v1", { id: ids.join(","), level: "standard" }, cookie);
      const urls = new Map<string, string>();
      for (const item of ((result.data as Array<{ id?: string | number; url?: string }> | undefined) || [])) {
        if (item.id && item.url) urls.set(String(item.id), item.url.replace(/^http:\/\//i, "https://"));
      }
      const tracks = ids.map((id) => {
        const current = supplied.get(id) || toTrack({ id, name: "网易云歌曲" });
        const url = urls.get(id);
        return { ...current, id: `netease-${id}`, neteaseId: id, url: url || "", playable: Boolean(url) };
      });
      return json(request, { tracks, summary: `${tracks.filter((track) => track.playable).length} 首歌曲已准备播放` });
    }

    throw new Error("不支持的音乐操作");
  } catch (reason) {
    return json(request, { error: reason instanceof Error ? reason.message : "网易云音乐服务暂时不可用" }, 400);
  }
}
