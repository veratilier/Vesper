'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumPhoto } from '../lib/photo-album';
import { AttachmentGallery } from './attachment-gallery';
import './photo-album.css';
type Result = { photos: AlbumPhoto[]; categories: string[]; nextOffset: number | null };
export function PhotoAlbum({ apiUrl, headers, active }: { active: boolean; apiUrl: (path: string) => string; headers: (json?: boolean) => Record<string, string> }) {
  const [result, setResult] = useState<Result>({ photos: [], categories: [], nextOffset: null });
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('');
  const [search, setSearch] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState<AlbumPhoto | null>(null);
  const input = useRef<HTMLInputElement>(null), generation = useRef(0);
  const editor = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editing) editor.current?.showModal(); else editor.current?.close(); }, [editing?.id]);
  const load = useCallback(async (offset = 0) => {
    const id = ++generation.current; setBusy(true);
    try {
      const response = await fetch(apiUrl('/api/photos?' + new URLSearchParams({ query: search, category: filter, offset: String(offset) })), { headers: headers(), cache: 'no-store' });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(data.error || '相册暂时无法读取');
      if (id === generation.current) { setResult(previous => ({ ...data, photos: offset ? [...previous.photos, ...data.photos] : data.photos })); setMessage(''); }
    } catch (e) { if (id === generation.current) setMessage(e instanceof Error ? e.message : '读取失败'); }
    finally { if (id === generation.current) setBusy(false); }
  }, [apiUrl, headers, search, filter]);
  useEffect(() => {
    if (!active) return;
    const retry = () => { void load(); };
    retry();
    window.addEventListener('online', retry);
    return () => { generation.current++; window.removeEventListener('online', retry); };
  }, [load, active]);
  async function save(key: string, category: string, caption: string) {
    const response = await fetch(apiUrl('/api/photos'), { method: 'POST', headers: headers(true), body: JSON.stringify({ key, category, caption }) });
    const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || '保存失败');
  }
  async function importPhotos(files: File[]) {
    setBusy(true); let saved = 0;
    try {
      for (const file of files) {
        if (!/^image\/(png|jpeg|gif|webp|avif|heic|heif)$/i.test(file.type)) throw new Error('请选择支持的图片文件');
        if (file.size > 32 * 1024 * 1024) throw new Error('单张照片不能超过 32 MB');
        const body = new FormData(); body.set('file', file);
        const response = await fetch(apiUrl('/api/media'), { method: 'POST', headers: headers(), body });
        const data = await response.json() as { key: string; error?: string }; if (!response.ok) throw new Error(data.error || '上传失败');
        await save(data.key, filter || '未分类', ''); saved++;
      }
      await load();
    } catch (e) { await load(); setMessage(`已保存 ${saved} 张。${e instanceof Error ? e.message : '导入失败'}`); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <section className="page-body album-page">
    <header><small>KEEPSAKES</small><h1>相册</h1><p>把想留下的照片收好，想起时再翻出来。</p></header>
    <form className="album-toolbar" onSubmit={e => { e.preventDefault(); setSearch(query); }}>
      <input aria-label="搜索照片" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索照片、描述或分类" />
      <button disabled={busy}>搜索</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>＋ 导入</button>
      <input ref={input} hidden type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/heic,image/heif" onChange={e => { if (e.target.files?.length) void importPhotos(Array.from(e.target.files)); }} />
    </form>
    <nav className="album-filters" aria-label="照片分类">{['', ...result.categories].map(category => <button key={category} type="button" aria-pressed={filter === category} disabled={busy} onClick={() => setFilter(category)}>{category || '全部'}</button>)}</nav>
    <p role="status">{message || (busy ? '正在整理照片…' : '')}</p>
    {message && !busy && <button type="button" onClick={() => void load()}>重新加载相册</button>}
    {!busy && !message && !result.photos.length && <p className="album-empty">这里还没有照片。可以导入，也可以在聊天中把想留下的照片交给我。</p>}
    <div className="album-grid">{result.photos.map(photo => <article key={photo.id}><AttachmentGallery items={[photo]} /><p className="album-photo-name">{photo.name}</p><p className="album-photo-caption">{photo.caption || "尚未添加概述与评价"}</p><button type="button" onClick={() => setEditing(photo)}>{photo.category} · 编辑</button></article>)}</div>
    {result.nextOffset !== null && <button type="button" disabled={busy} onClick={() => void load(result.nextOffset!)}>更多照片</button>}
    <dialog ref={editor} className="album-editor-dialog" onCancel={() => setEditing(null)} onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>{editing && <form className="album-edit" aria-label="编辑照片" onSubmit={async e => {
      e.preventDefault(); setBusy(true);
      try { await save(editing.key, editing.category, editing.caption); setEditing(null); await load(); }
      catch (error) { setMessage(error instanceof Error ? error.message : '保存失败'); } finally { setBusy(false); }
    }}><h2>留个记号</h2><label>分类<input autoFocus maxLength={60} required value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></label><label>概述与评价<textarea maxLength={500} value={editing.caption} onChange={e => setEditing({ ...editing, caption: e.target.value })} /></label><p role="alert">{message}</p><button disabled={busy}>保存</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>取消</button></form>}</dialog>
  </section>;
}
