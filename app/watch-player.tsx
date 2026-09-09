'use client';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { parseSubtitles, watchContext, type SubtitleCue, type WatchFrame } from './watch-context';
import './watch-player.css';
export function WatchPlayer({ active, busy, captureRef, onShare }: {
  active: boolean; busy: boolean;
  captureRef: MutableRefObject<(() => Promise<WatchFrame | null>) | null>;
  onShare: (frame: WatchFrame) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const objectUrl = useRef('');
  const session = useRef(0);
  const alive = useRef(true);
  const capturing = useRef(false);
  const [source, setSource] = useState('');
  const [screen, setScreen] = useState(false);
  const [title, setTitle] = useState('');
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [automatic, setAutomatic] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [canShareScreen, setCanShareScreen] = useState(false);
  useEffect(() => { setCanShareScreen(Boolean(navigator.mediaDevices?.getDisplayMedia)); }, []);
  const release = useCallback(() => {
    session.current++;
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream.current = null;
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = '';
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; release(); }; }, [release]);
  useEffect(() => {
    if (!active) {
      session.current++;
      setAutomatic(false);
      if (stream.current) { release(); setScreen(false); setSource(''); }
      else video.current?.pause();
    }
  }, [active, release]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { session.current++; setAutomatic(false); video.current?.pause(); if (stream.current) { release(); setScreen(false); setSource(''); } } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [release]);
  useEffect(() => {
    if (screen && stream.current && video.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => setError("共享预览无法播放，请停止后重新共享。"));
    }
  }, [screen, source]);
  function chooseVideo(file?: File) {
    if (!file) return;
    release(); setAutomatic(false); setCues([]); setError(''); setScreen(false);
    objectUrl.current = URL.createObjectURL(file);
    setSource(objectUrl.current); setTitle(file.name);
  }
  async function shareScreen() {
    setError('');
    const request = session.current;
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!alive.current || request !== session.current || !active || document.hidden) { media.getTracks().forEach(track => track.stop()); return; }
      release(); stream.current = media; setSource(`screen:${session.current}`); setScreen(true); setTitle('共享的影片窗口'); setCues([]); setAutomatic(false);
      media.getVideoTracks()[0].onended = () => { release(); setScreen(false); setSource(''); setAutomatic(false); };
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '无法共享屏幕，请选择本地视频。'); }
  }
  const capture = useCallback(async (): Promise<WatchFrame | null> => {
    const element = video.current;
    if (!active || document.hidden || (!source && !stream.current)) return null;
    if (!element || element.readyState < 2 || !element.videoWidth) throw new Error('画面还没准备好，先播放视频再试。');
    const currentSession = session.current;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1280, element.videoWidth);
    canvas.height = Math.max(1, Math.round(element.videoHeight * canvas.width / element.videoWidth));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法读取画面。');
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    const context = watchContext(title, element.currentTime, cues, Boolean(stream.current));
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
    if (!alive.current || currentSession !== session.current || document.hidden) return null;
    if (!blob) throw new Error('截图失败，请重新播放后再试。');
    return { file: new File([blob], `watch-${Date.now()}.jpg`, { type: 'image/jpeg' }), context };
  }, [active, source, title, cues]);
  useEffect(() => { captureRef.current = capture; return () => { captureRef.current = null; }; }, [capture, captureRef]);
  async function share(auto = false) {
    if (busy || capturing.current || !active) return;
    capturing.current = true; setSharing(true); setError('');
    try { const frame = await capture(); if (frame) await onShare({ ...frame, automatic: auto }); }
    catch (reason) { setAutomatic(false); setError(reason instanceof Error ? reason.message : '分享失败，请重试。'); }
    finally { capturing.current = false; if (alive.current) setSharing(false); }
  }
  const shareRef = useRef(share); shareRef.current = share;
  useEffect(() => {
    if (!automatic || !active) return;
    const timer = setInterval(() => { if (!document.hidden && video.current && !video.current.paused) void shareRef.current(true); }, 30_000);
    return () => clearInterval(timer);
  }, [automatic, active]);
  return <section className="watch-player" aria-label="一起看电影播放器">
    <video ref={video} src={screen ? undefined : source || undefined} controls={!screen} muted={screen} playsInline preload="metadata" onError={() => setError('视频无法播放，请换用浏览器支持的 MP4 视频。')} />
    <div className="watch-player-actions">
      <label className="watch-file-button">选择视频<input type="file" accept="video/*" onChange={event => { chooseVideo(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {canShareScreen && <button type="button" onClick={() => void shareScreen()}>共享影片窗口</button>}
      {screen && <button type="button" onClick={() => { release(); setScreen(false); setSource(''); setAutomatic(false); }}>停止共享</button>}
      <label className="watch-file-button">导入字幕<input type="file" accept=".srt,.vtt" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError('字幕文件请小于 2 MB。'); return; }
        const currentSession = session.current;
        try { const parsed = parseSubtitles(await file.text()); if (currentSession !== session.current || !alive.current) return; setCues(parsed); setError(parsed.length ? '' : '没有识别到字幕，请选择 SRT 或 VTT 文件。'); }
        catch { setError('字幕读取失败，请重新选择。'); }
      }} /></label>
      <button type="button" disabled={busy || sharing || (!source && !screen)} onClick={() => void share()}>看看这一幕</button>
      <label className="watch-auto"><input type="checkbox" checked={automatic} disabled={!source && !screen} onChange={event => setAutomatic(event.target.checked)} />每 30 秒分享画面</label>
    </div>
    <p className="watch-player-note">{title || '选择本地视频，在这里边看边聊。'}{cues.length ? ` · 已载入 ${cues.length} 条字幕` : ''}</p>
    <p className="watch-player-note">发消息会附上当前画面和进度；视频留在本机，只发送截图与对应字幕。暂不传送电影声音。{!canShareScreen ? '此浏览器请使用页内视频播放。' : ''}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
