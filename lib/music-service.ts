export type MusicSyncTrack = {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  url: string;
  cover?: string;
  neteaseId?: string;
  album?: string;
  playable?: boolean;
};

export type NeteasePlaylist = { id: string; name: string; trackCount?: number };

export type MusicSyncResult = {
  error?: string;
  playlists?: NeteasePlaylist[];
  tracks?: MusicSyncTrack[];
  queue?: MusicSyncTrack[];
  meta?: Record<string, string>;
  summary?: string;
};

export async function requestNeteaseSync(
  endpoint: string,
  headers: HeadersInit,
  payload: { action: "playlists" | "sync"; uid: string; playlistId: string; cookie: string },
): Promise<MusicSyncResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as MusicSyncResult;
  if (!response.ok) throw new Error(result.error || "网易云同步失败");
  return result;
}
