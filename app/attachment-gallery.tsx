'use client';
import { useEffect, useRef, useState } from 'react';
export type GalleryAttachment = { key: string; url: string; name: string; type: string; size: number };
export function AttachmentGallery({ items, onSaveAsSticker }: { items: GalleryAttachment[]; onSaveAsSticker?: (item: GalleryAttachment) => void }) {
  const [index, setIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const [retriedUrls, setRetriedUrls] = useState<Record<string, string>>({});
  const retryBlobs = useRef(new Map<string, string>());
  useEffect(() => () => { retryBlobs.current.forEach(url => URL.revokeObjectURL(url)); retryBlobs.current.clear(); }, []);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const preloadUrls = JSON.stringify(items.length ? [0, 1, -1].map(offset => items[(Math.min(index, items.length - 1) + offset + items.length) % items.length].url) : []);
  useEffect(() => {
    const previews = (JSON.parse(preloadUrls) as string[]).map(url => { const image = new Image(); image.src = url; return image; });
    return () => { previews.forEach(image => { image.onload = null; }); };
  }, [preloadUrls]);
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const active = Math.min(index, items.length - 1);
  const move = (by: number) => setIndex(i => (i + by + items.length) % items.length);
  if (!items.length) return null;
  const item = items[active];
  const retryImage = async () => {
    setFailed(current => ({ ...current, [item.url]: false }));
    // A fresh blob avoids the browser's failed-image cache; original links stay intact.
    try {
      const response = await fetch(item.url, { cache: 'reload' });
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const previous = retryBlobs.current.get(item.url);
      if (previous) URL.revokeObjectURL(previous);
      retryBlobs.current.set(item.url, url);
      setRetriedUrls(current => ({ ...current, [item.url]: url }));
      setRetry(value => value + 1);
    } catch { setFailed(current => ({ ...current, [item.url]: true })); }
  };
  const imageLoaded = () => setFailed(current => current[item.url] ? { ...current, [item.url]: false } : current);
  const imageFailed = () => setFailed(current => current[item.url] ? current : { ...current, [item.url]: true });
  return <div className="attachment-gallery">
    <div className={items.length > 1 ? 'photo-stack' : 'single-photo'} onTouchStart={e => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; swiped.current = false; }} onTouchEnd={e => { if (!start.current) return; const dx = e.changedTouches[0].clientX - start.current.x; const dy = e.changedTouches[0].clientY - start.current.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped.current = true; move(dx < 0 ? 1 : -1); } start.current = null; }}>
      {items.length > 1 && [2, 1].filter(n => n < items.length).map(n => <img className={`stack-under stack-under-${n}`} key={n} src={items[(active + n) % items.length].url} alt="" loading="lazy" aria-hidden="true" />)}
      <button className="photo-open" type="button" onClick={() => { if (!swiped.current) dialog.current?.showModal(); swiped.current = false; }} aria-label={`查看图片 ${active + 1}/${items.length}：${item.name}`}><img key={`${item.key}:${retry}`} src={retriedUrls[item.url] || item.url} alt={item.name} loading="eager" onLoad={imageLoaded} onError={imageFailed} /></button>
    </div>
    {failed[item.url] && <button type="button" onClick={retryImage}>图片加载失败，请打开原图或重试</button>}
    {items.length > 1 && <div className="gallery-controls"><button type="button" aria-label="上一张" onClick={() => move(-1)}>‹</button><button type="button" onClick={() => dialog.current?.showModal()} aria-label="打开整组图片">{active + 1} / {items.length}</button><button type="button" aria-label="下一张" onClick={() => move(1)}>›</button></div>}
    <dialog className="gallery-dialog" ref={dialog} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
      <header><span>{active + 1} / {items.length}</span><a href={item.url} download={item.name} target="_blank" rel="noreferrer">打开原图</a><button autoFocus type="button" aria-label="关闭图片" onClick={() => dialog.current?.close()}>×</button></header>
      {onSaveAsSticker && <button className="save-as-sticker" type="button" onClick={() => onSaveAsSticker(item)}>保存为表情包</button>}
      <img key={`${item.key}:${retry}`} className="gallery-full-image" src={retriedUrls[item.url] || item.url} alt={item.name} onLoad={imageLoaded} onError={imageFailed} />
      {failed[item.url] && <button type="button" onClick={retryImage}>重新加载原图</button>}
      <nav aria-label="整组图片">{items.map((image, i) => <button type="button" key={image.key} aria-label={`图片 ${i + 1}`} aria-current={active === i ? 'true' : undefined} onClick={() => setIndex(i)}><img src={image.url} alt={image.name} loading="lazy" /></button>)}</nav>
    </dialog>
  </div>;
}
