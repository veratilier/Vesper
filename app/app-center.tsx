'use client';
import { useEffect, useState, type ReactNode } from 'react';
import './app-center.css';
type Props = { onWake: () => void; onDesire: () => void; renderWatch: () => ReactNode };
const rooms = [{ id: 'study', title: '学习室', caption: '留一段专注的时间', mark: '01' }, { id: 'read', title: '共读室', caption: '一起翻到下一页', mark: '02' }, { id: 'watch', title: '一起看电影', caption: '边看电影，边聊这一幕', mark: '03' }];
export function AppCenter({ onWake, onDesire, renderWatch }: Props) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [watchOpen, setWatchOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => { try { setLinks(JSON.parse(localStorage.getItem('vesper-room-links-v1') || '{}')); } catch { /* New device */ } }, 0); return () => clearTimeout(timer); }, []);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error(); const next = { ...links, [editing!]: parsed.href }; localStorage.setItem('vesper-room-links-v1', JSON.stringify(next)); setLinks(next); setEditing(null); setError(''); } catch { setError('请填写不含账号密码的 HTTPS 应用地址。'); }
  }
  const connectionForm = editing && <form className="room-link-form" onSubmit={save}>
    <h2>连接{rooms.find(room => room.id === editing)?.title}</h2>
    <label>应用地址<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></label>
    <p>房间在新标签页打开；地址保存在当前设备。</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit">保存</button><button type="button" onClick={() => setEditing(null)}>取消</button>
  </form>;
  if (watchOpen) return <div className="page-body app-center watch-room">
    <div className="watch-room-toolbar"><button type="button" onClick={() => { setWatchOpen(false); setEditing(null); }}>‹ Pandora</button><span>WATCH TOGETHER</span></div>
    <div className="page-intro"><h1>一起看电影</h1><p>一起看，也一起聊。</p></div>
    {renderWatch()}
  </div>;
  return <div className="page-body app-center"><div className="page-intro"><span>OUR LITTLE ROOMS</span><h1>Pandora</h1><p>学习、共读，也一起消磨一场电影。</p></div><div className="room-grid">{rooms.map(room => <article className="room-card" key={room.id}><small>{room.mark}</small><h2>{room.title}</h2><p>{room.caption}</p>{room.id === 'watch' ? <button type="button" onClick={() => { setEditing(null); setWatchOpen(true); }}>进入房间 →</button> : <>{links[room.id] ? <a href={links[room.id]} target="_blank" rel="noopener noreferrer">打开房间 ↗</a> : <span className="room-unconnected">尚未连接房间</span>}<button onClick={() => { setEditing(room.id); setUrl(links[room.id] || ''); setError(''); }}>{links[room.id] ? '修改地址' : '连接房间'}</button></>}</article>)}<article className="room-card desire-entry"><small>DESIRE</small><h2>欲望</h2><p>看看此刻的状态和留下的小记。</p><button onClick={onDesire}>打开 Desire →</button></article></div><section className="room-wake"><div><h2>唤醒 AI</h2><p>在当前聊天开始一轮行动，展示真实活动概括，消息照常发来。</p></div><button onClick={onWake}>唤醒</button></section><p className="room-caption">手动唤醒需要保持 Vesper 打开并连接。正在回复时不会插入新一轮。</p>{connectionForm}</div>;
}