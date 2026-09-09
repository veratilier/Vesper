'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DesireFlower } from './desire-flower';
import './desire-panel.css';
function unpack(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const obj = input as { isError?: boolean; content?: { type: string; text?: string }[]; structuredContent?: unknown };
  if (obj.isError) throw Error(obj.content?.map(item => item.text || '').join('\n') || 'Desire 返回错误');
  if (obj.structuredContent) return obj.structuredContent;
  const text = obj.content?.filter(item => item.type === 'text').map(item => item.text).join('\n');
  if (text) { try { return JSON.parse(text); } catch { throw Error('Desire 返回了无法识别的数据'); } }
  return input;
}
type Note = { id: string; note: string; date: string };
function historyNotes(value: unknown): Note[] {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rows = Array.isArray(value) ? value : [object.records, object.events, object.history, object.encounters, object.items].find(Array.isArray);
  if (!rows) throw Error('暂时无法识别历史记录格式');
  return rows.flatMap((row, index) => {
    const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    if (typeof item.note !== 'string' || !item.note.trim()) return [];
    return [{ id: String(item.id || item.encounterId || index), note: item.note, date: String(item.eventAt || item.event_at || item.createdAt || item.created_at || '') }];
  });
}
function dateLabel(date: string) { const stamp = new Date(date); return Number.isFinite(stamp.getTime()) ? stamp.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; }
export function DesirePanel({ apiUrl, headers, active, agentName }: {
  apiUrl: (path: string) => string; headers: (json?: boolean) => Record<string, string>;
  active: boolean; agentName: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('');
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setLoading(true);
    const get = async (view: string) => {
      const response = await fetch(apiUrl(`/api/desire?view=${view}`), { headers: headers(), cache: 'no-store', signal: controller.signal });
      const result = await response.json() as { error?: string; data?: unknown };
      if (!response.ok) throw Error(result.error || '读取失败');
      return unpack(result.data);
    };
    try {
      const [status, history] = await Promise.allSettled([get('status'), get('history')]);
      if (controller.signal.aborted) return;
      if (status.status === 'fulfilled') {
        const object = status.value as Record<string, unknown> | null;
        const state = object?.state ?? object;
        if (state && typeof state === 'object' && !Array.isArray(state)) { setData(state as Record<string, unknown>); setError(''); setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })); }
        else setError('Desire 状态格式暂不支持');
      } else setError(status.reason instanceof Error ? status.reason.message : '状态读取失败');
      if (history.status === 'fulfilled') {
        try { setNotes(historyNotes(history.value)); setHistoryError(''); } catch (reason) { setHistoryError(reason instanceof Error ? reason.message : '小记读取失败'); }
      } else setHistoryError(history.reason instanceof Error ? history.reason.message : '小记读取失败');
    } finally { if (request.current === controller) { request.current = null; setLoading(false); } }
  }, [apiUrl, headers]);
  useEffect(() => {
    if (!active) return;
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = setTimeout(refresh, 0), interval = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); clearInterval(interval); document.removeEventListener('visibilitychange', refresh); request.current?.abort(); request.current = null; };
  }, [active, load]);
  const note = typeof data?.note === 'string' && data.note.trim() ? data.note : notes[0]?.note;
  return <div className="page-body app-center desire-panel desire-garden">
    <div className="desire-heading"><div><small>INNER WEATHER</small><h1>此刻</h1></div></div>
    {error && <p className="desire-error" role="alert">{error}{data ? ' · 当前仍显示上次读取的数值。' : ''}</p>}
    <section className="desire-note-surface"><h2>{agentName}</h2><p>{note || (loading ? '正在读此刻的小记…' : '此刻安静，还没有留下小记。')}</p>{notes[0]?.date && <time>{dateLabel(notes[0].date)}</time>}</section>
    <section className="desire-flower-surface"><DesireFlower data={data} /><div className="desire-flower-footer"><small>{loading ? '读取中…' : updatedAt ? `更新于 ${updatedAt}` : '尚未读取数值'}</small><button type="button" disabled={loading} onClick={() => void load()} aria-label="刷新心情"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12-1L20 9M4 15l2.5 3a7.5 7.5 0 0 0 12-1" /></svg></button></div></section>
    <section className="desire-timeline"><div className="desire-timeline-heading"><h2>留下的小记</h2>{notes.length > 3 && <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : '最近记录'} ›</button>}</div>{historyError && <p role="alert">{historyError}</p>}{!notes.length && !historyError && <p className="desire-timeline-empty">{loading ? '正在读取…' : '有话留下时，就会在这里。'}</p>}<ol>{notes.slice(0, expanded ? notes.length : 3).map(item => <li key={item.id}><time>{dateLabel(item.date)}</time><p>{item.note}</p></li>)}</ol></section>
  </div>;
}
