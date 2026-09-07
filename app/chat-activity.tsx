'use client';
import { ExecutionCard } from './execution-card';
import type { Execution } from './codex-execution';
export type TurnActivity = { busy: boolean; online: boolean; executions: Execution[]; summary: string };
export function ChatActivity({ busy, online, executions, summary, timestamp, dateTime, status }: TurnActivity & {
  timestamp: string; dateTime?: string; status?: string;
}) {
  return <details className="chat-activity chat-activity-inline">
    <summary aria-label={`${timestamp} 工具调用与思考摘要`}>
      <i aria-hidden="true" /><time dateTime={dateTime}>{timestamp}</time>
      <svg className="activity-chevron" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      {busy && status && <span className="turn-progress">{status}</span>}
    </summary>
    <section aria-label="工具调用详情">
      <h3>工具调用</h3>
      {executions.length ? executions.map(execution => <ExecutionCard key={execution.id} execution={execution} live={busy && online} />)
        : <p>尚未收到本轮工具详情。</p>}
      <h3>思考摘要</h3>
      <p className="activity-summary">{summary || (busy ? '等待后端返回思考摘要…' : '后端没有返回本轮思考摘要。')}</p>
    </section>
  </details>;
}
