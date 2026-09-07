'use client';
import { useEffect, useRef, useState } from 'react';
type FileItem = { name: string; type: string; size: number; url: string };
export function FileAttachmentCard({ file }: { file: FileItem }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const html = ['html','htm'].includes(extension);
  const previewable = html || ['md','txt','json','csv','log','xml','yaml','yml'].includes(extension) || file.type.startsWith('text/');
  const size = file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`;
  const close = () => { request.current?.abort(); dialog.current?.close(); };
  useEffect(() => () => request.current?.abort(), []);
  const open = async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setText(''); setError(''); setLoading(true); dialog.current?.showModal();
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('文件较大，请下载后查看。');
      const response = await fetch(file.url, { signal: controller.signal });
      if (!response.ok) throw Error('暂时无法读取文件，请重试或下载。');
      const content = await response.text();
      if (!controller.signal.aborted) setText(content);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '文件读取失败'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <>
    <div className="vesper-file-card">
      <span className="file-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 12l-2 2 2 2M15 12l2 2-2 2M13 11l-2 6"/></svg></span>
      <span className="file-card-details"><b title={file.name}>{file.name}</b><small>{extension.toUpperCase() || 'FILE'} · {size}</small></span>
      <span className="file-card-actions">{previewable && <button type="button" onClick={() => void open()} aria-label={`打开 ${file.name}`}>打开</button>}<a href={file.url} download={file.name} target="_blank" rel="noreferrer" aria-label={`下载 ${file.name}`}>下载</a></span>
    </div>
    <dialog ref={dialog} className="file-preview-dialog" onCancel={event => { event.preventDefault(); close(); }}>
      <header><b>{file.name}</b><button type="button" onClick={close} aria-label="关闭文件预览">×</button></header>
      {loading ? <p role="status">正在读取文件…</p> : error ? <p role="alert">{error}</p> : html ? <iframe title={file.name} sandbox="" referrerPolicy="no-referrer" srcDoc={text} /> : <pre>{text}</pre>}
      <footer><a href={file.url} download={file.name} target="_blank" rel="noreferrer">下载原文件</a></footer>
    </dialog>
  </>;
}
