'use client';
import { useRef, useState } from 'react';
import type { Execution } from './codex-execution';
const labels: Record<string, string> = { inProgress: '运行中', running: '运行中', completed: '已完成', failed: '失败', declined: '未允许', interrupted: '已中断', unknown: '状态待同步' };
export function ExecutionCard({ execution, live }: { execution: Execution; live: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const running = ['inProgress', 'running'].includes(execution.status);
  const status = running && !live ? '状态待同步' : labels[execution.status] || execution.status;
  const body = <><p className="execution-location">{execution.cwd || '工作目录未提供'}{execution.exitCode != null && ` · exit ${execution.exitCode}`}{execution.durationMs != null && ` · ${(execution.durationMs / 1000).toFixed(1)}s`}</p><pre tabIndex={0}>{execution.output || (running && live ? '等待输出…' : '没有文本输出')}{execution.truncated && '\n[仅显示最后 24,000 个字符]'}</pre></>;
  return <article className="execution-card" data-status={execution.status}>
    <div className="execution-heading"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span aria-hidden="true">›_</span><b>{execution.title}</b><small>{status}</small></button><button type="button" aria-label="放大执行记录" onClick={() => dialog.current?.showModal()}>⤢</button></div>
    {expanded && body}
    <dialog ref={dialog} className="execution-dialog" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}><header><b>{execution.title}</b><button autoFocus type="button" onClick={() => dialog.current?.close()} aria-label="关闭执行记录">×</button></header><p>{status}</p>{body}</dialog>
  </article>;
}
