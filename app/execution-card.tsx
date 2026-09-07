'use client';
import { useMemo, useRef, useState } from 'react';
import { executionFiles, formatExecutionOutput, type Execution } from './codex-execution';
const labels: Record<string, string> = { inProgress: '运行中', running: '运行中', completed: '已完成', failed: '失败', declined: '未允许', interrupted: '已中断', unknown: '状态待同步' };
function Code({ text, diff = false }: { text: string; diff?: boolean }) {
  return <pre tabIndex={0}><code>{text.split('\n').map((line, index) => <span key={index} className={diff ? line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-remove' : line.startsWith('@@') ? 'diff-hunk' : undefined : undefined}>{line}{'\n'}</span>)}</code></pre>;
}
export function ExecutionCard({ execution, live }: { execution: Execution; live: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const running = ['inProgress', 'running'].includes(execution.status);
  const status = running && !live ? '状态待同步' : labels[execution.status] || execution.status;
  const parsed = useMemo(() => {
    if (execution.files?.length) return { files: execution.files, filesTruncated: execution.filesTruncated };
    if (execution.type === 'fileChange') {
      try { return executionFiles(JSON.parse(execution.output)); } catch { /* Older truncated patches remain available as text. */ }
    }
    return { files: [], filesTruncated: execution.filesTruncated };
  }, [execution.files, execution.filesTruncated, execution.type, execution.output]);
  const output = useMemo(() => ['commandExecution', 'shellCall', 'fileChange'].includes(execution.type) ? execution.output : formatExecutionOutput(execution.output), [execution.output, execution.type]);
  const file = parsed.files[Math.min(selected, parsed.files.length - 1)];
  const body = <div className="execution-body">
    <div className="execution-meta"><span>{status}</span>{execution.cwd && <span>{execution.cwd}</span>}{execution.exitCode != null && <span>exit {execution.exitCode}</span>}{execution.durationMs != null && <span>{(execution.durationMs / 1000).toFixed(1)}s</span>}</div>
    {parsed.files.length > 0 && <div className="execution-files" aria-label="修改的文件">{parsed.files.map((entry, index) => {
      const lines = entry.diff.split('\n');
      const added = lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length;
      const removed = lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length;
      return <button key={`${index}:${entry.path}`} type="button" aria-pressed={file === entry} onClick={() => setSelected(index)} title={entry.path}>{entry.path.split('/').pop()} {entry.diff && <><span className="diff-add">+{added}</span> <span className="diff-remove">−{removed}</span></>}{entry.truncated && ' · 部分'}</button>;
    })}</div>}
    {file && <><p className="execution-path">{file.path}</p><Code diff text={file.diff || '后端仅返回了文件路径，未提供代码差异。'} />{file.truncated && <p className="execution-notice">此文件改动超出记录容量，仅保留开头部分；无法展示未保存的代码。</p>}</>}
    {(!file || (execution.files?.length && output)) && <Code text={output || (running && live ? '等待输出…' : '没有文本输出')} />}
    {execution.truncated && <p className="execution-notice">输出已截断，仅保留末尾记录；这不是完整输出。</p>}
    {parsed.filesTruncated && <p className="execution-notice">文件改动超出记录容量，部分内容未保存。</p>}
  </div>;
  return <article className="execution-card" data-status={execution.status}>
    <div className="execution-heading"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span aria-hidden="true">›_</span><b>{execution.title}</b><small>{status}</small></button><button type="button" aria-label="放大执行记录，查看完整已保存输出和文件改动" onClick={() => dialog.current?.showModal()}>⤢</button></div>
    {expanded && body}
    <dialog ref={dialog} className="execution-dialog" aria-label={`${execution.title} 执行详情`} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}><header><span className="terminal-lights" aria-hidden="true"><i/><i/><i/></span><b>{execution.title}</b><button autoFocus type="button" onClick={() => dialog.current?.close()} aria-label="关闭执行记录">×</button></header>{body}</dialog>
  </article>;
}
