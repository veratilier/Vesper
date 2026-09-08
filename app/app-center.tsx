'use client';
import { useEffect, useState } from 'react';
import './app-center.css';
type Props = { onWake: () => void; onDesire: () => void };
const rooms = [{ id: 'study', title: '学习室', caption: '留一段专注的时间', mark: '01' }, { id: 'read', title: '共读室', caption: '一起翻到下一页', mark: '02' }, { id: 'watch', title: '一起看电影', caption: '桌面陪看与聊天', mark: '03' }];
export function AppCenter({ onWake, onDesire }: Props) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => { try { setLinks(JSON.parse(localStorage.getItem('vesper-room-links-v1') || '{}')); } catch { /* New device */ } }, 0); return () => clearTimeout(timer); }, []);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error(); const next = { ...links, [editing!]: parsed.href }; localStorage.setItem('vesper-room-links-v1', JSON.stringify(next)); setLinks(next); setEditing(null); setError(''); } catch { setError('请填写不含账号密码的 HTTPS 应用地址。'); }
  }
  return <div className="page-body app-center"><div className="page-intro"><span>OUR LITTLE ROOMS</span><h1>Pandora</h1><p>学习、共读，也一起消磨一场电影。</p></div><div className="room-grid">{rooms.map(room => <article className="room-card" key={room.id}><small>{room.mark}</small><h2>{room.title}</h2><p>{room.caption}</p>{links[room.id] ? <a href={links[room.id]} target="_blank" rel="noopener noreferrer">打开房间 ↗</a> : <span className="room-unconnected">{room.id === 'watch' ? '桌面陪看待接入' : '尚未连接房间'}</span>}<button onClick={() => { setEditing(room.id); setUrl(links[room.id] || ''); setError(''); }}>{links[room.id] ? '修改地址' : '连接已有应用'}</button></article>)}<article className="room-card desire-entry"><small>DESIRE</small><h2>欲望</h2><p>看看此刻的状态和留下的小记。</p><button onClick={onDesire}>打开 Desire →</button></article></div><section className="room-wake"><div><h2>唤醒 AI</h2><p>在当前聊天开始一轮行动，展示真实活动概括，消息照常发来。</p></div><button onClick={onWake}>唤醒</button></section><p className="room-caption">手动唤醒需要保持 Vesper 打开并连接。正在回复时不会插入新一轮。</p>{editing && <form className="room-link-form" onSubmit={save}><h2>连接{rooms.find(room => room.id === editing)?.title}</h2><label>应用地址<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></label><p>房间在新标签页打开；地址保存在当前设备。这里不会自动部署房间。</p>{error && <p role="alert">{error}</p>}<button type="submit">保存</button><button type="button" onClick={() => setEditing(null)}>取消</button></form>}</div>;
}
function unpack(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const obj = input as { isError?: boolean; content?: { type: string; text?: string }[]; structuredContent?: unknown };
  if (obj.isError) throw Error(obj.content?.map(item => item.text || '').join('\n') || 'Desire 返回错误');
  if (obj.structuredContent) return obj.structuredContent;
  const text = obj.content?.filter(item => item.type === 'text').map(item => item.text).join('\n');
  if (text) { try { return JSON.parse(text); } catch { return text; } }
  return input;
}
const metrics = [['longing', '想念'], ['tenderness', '温柔'], ['playfulness', '玩心'], ['intensity', '热度'], ['attachment', '依恋'], ['possessiveness', '占有欲']] as const;
export function DesirePanel({ apiUrl, headers, active }: { apiUrl: (path: string) => string; headers: (json?: boolean) => Record<string,string>; active: boolean }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load(view: 'status' | 'history') {
    setLoading(true); setError('');
    try { const response = await fetch(apiUrl(`/api/desire?view=${view}`), { headers: headers(), cache: 'no-store' }); const result = await response.json() as { error?: string; data?: unknown }; if (!response.ok) throw Error(result.error || '读取失败'); const value = unpack(result.data); if (view === 'status') { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Desire 状态格式暂不支持'); setData(value as Record<string, unknown>); } else setHistory(value); } catch (reason) { setError(reason instanceof Error ? reason.message : '读取失败'); } finally { setLoading(false); }
  }
  useEffect(() => { if (!active) return; const timer = setTimeout(() => void load('status'), 0); return () => clearTimeout(timer); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="page-body app-center"><div className="page-intro"><span>DESIRE</span><h1>欲望</h1><p>沿用原 Desire 服务的状态与记录。</p></div><button disabled={loading} onClick={() => void load('status')}>{loading ? '读取中…' : '刷新状态'}</button>{error && <p role="alert">{error}</p>}<div className="desire-grid">{metrics.map(([key, label]) => <article className="room-card" key={key}><span>{label}</span><b className="desire-value">{typeof data?.[key] === 'number' ? String(data[key]) : '—'}</b></article>)}</div>{typeof data?.note === 'string' && <blockquote>{data.note}</blockquote>}<p className="room-caption">数值由原服务返回；打开页面不会新增互动记录。</p><button disabled={loading} onClick={() => void load('history')}>读取小记</button>{history != null && <DesireHistory value={history} />}</div>;
}
function DesireHistory({ value }: { value: unknown }) {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rows = Array.isArray(value) ? value : [object.events, object.history, object.encounters, object.items].find(Array.isArray);
  if (!rows) return <p>暂时无法识别历史记录格式，原始记录未作修改。</p>;
  return <div className="desire-history">{rows.length ? rows.map((row, index) => { const item = row && typeof row === "object" ? row as Record<string, unknown> : {}; return <article className="room-card" key={String(item.id || item.encounterId || index)}><p>{typeof item.note === 'string' ? item.note : item.kind === 'absence' ? '一次静候' : '本次未附小记'}</p><small>{String(item.event_at || item.createdAt || item.created_at || '')}</small></article>; }) : <p>还没有记录。</p>}</div>;
}
