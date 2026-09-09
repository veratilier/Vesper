'use client';
import { useEffect, useState, type ReactNode } from 'react';
import './app-center.css';
type Props = { onWake: () => void; onDesire: () => void; renderWatch: () => ReactNode };
const rooms = [{ id: 'study', title: "Study Room", caption: "A little time to focus", mark: '01' }, { id: 'read', title: "Reading Room", caption: "Turn the next page together", mark: '02' }, { id: 'watch', title: "Together Watch", caption: "Watch a film and talk about the moment", mark: '03' }];
export function AppCenter({ onWake, onDesire, renderWatch }: Props) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [watchOpen, setWatchOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(() => { try { setLinks(JSON.parse(localStorage.getItem('vesper-room-links-v1') || '{}')); } catch { /* New device */ } }, 0); return () => clearTimeout(timer); }, []);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error(); const next = { ...links, [editing!]: parsed.href }; localStorage.setItem('vesper-room-links-v1', JSON.stringify(next)); setLinks(next); setEditing(null); setError(''); } catch { setError("Enter an HTTPS app URL without a username or password."); }
  }
  const connectionForm = editing && <form className="room-link-form" onSubmit={save}>
    <h2>Connect{rooms.find(room => room.id === editing)?.title}</h2>
    <label>App URL<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></label>
    <p>Rooms open in a new tab. URLs are saved on this device.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit">Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button>
  </form>;
  if (watchOpen) return <div className="page-body app-center watch-room">
    <div className="watch-room-toolbar"><button type="button" onClick={() => { setWatchOpen(false); setEditing(null); }}>‹ Pandora</button><span>WATCH TOGETHER</span></div>
    <div className="page-intro"><h1>Together Watch</h1><p>Watch together. Talk together.</p></div>
    {renderWatch()}
  </div>;
  return <div className="page-body app-center"><div className="page-intro"><span>OUR LITTLE ROOMS</span><h1>Pandora</h1><p>Study, read, or spend a film together.</p></div><div className="room-grid">{rooms.map(room => <article className="room-card" key={room.id}><small>{room.mark}</small><h2>{room.title}</h2><p>{room.caption}</p>{room.id === 'watch' ? <button type="button" onClick={() => { setEditing(null); setWatchOpen(true); }}>Enter room →</button> : <>{links[room.id] ? <a href={links[room.id]} target="_blank" rel="noopener noreferrer">Open room ↗</a> : <span className="room-unconnected">No room connected</span>}<button onClick={() => { setEditing(room.id); setUrl(links[room.id] || ''); setError(''); }}>{links[room.id] ? "Edit URL" : "Connect room"}</button></>}</article>)}<article className="room-card desire-entry"><small>DESIRE</small><h2>Desire</h2><p>Explore the current state and recent notes.</p><button onClick={onDesire}>Open Desire →</button></article></div><section className="room-wake"><div><h2>Wake AI</h2><p>Start an action in this conversation, with an activity summary and replies.</p></div><button onClick={onWake}>Wake</button></section><p className="room-caption">Keep Vesper open and connected for a manual wake-up. A new turn will not interrupt an active reply.</p>{connectionForm}</div>;
}