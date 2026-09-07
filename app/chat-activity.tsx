'use client';
import { ExecutionCard } from './execution-card';
import type { Execution } from './codex-execution';
export function ChatActivity({ busy, online, label, executions, summary }: {
  busy: boolean; online: boolean; label: string; executions: Execution[]; summary: string;
}) {
  return <details className="chat-activity">
    <summary>{busy ? label : '本轮调用记录'}<span>工具 {executions.length} · 思考摘要　⌄</span></summary>
    <section aria-label="工具调用详情">
      <h3>工具调用</h3>
      {executions.length ? executions.map(execution => <ExecutionCard key={execution.id} execution={execution} live={busy && online} />)
        : <p>尚未收到本轮工具详情。状态提示本身不包含命令或输出。</p>}
      <h3>思考摘要</h3>
      <p className="activity-summary">{summary || (busy ? '等待后端返回思考摘要…' : '后端没有返回本轮思考摘要。')}</p>
    </section>
  </details>;
}
