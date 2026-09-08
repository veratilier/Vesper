'use client';
import { useEffect, useState } from 'react';
import type { Execution } from './codex-execution';
import { wakeActivities, type WakeRecord } from './wake-summary';
export function WakeCard({ wake, executions, status, online }: { wake: WakeRecord; executions: Execution[]; status: string; online: boolean }) {
  const [now, setNow] = useState(0);
  useEffect(() => { const update = () => setNow(Date.now()); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, []);
  const running = !wake.endedAt && !['error', 'completed'].includes(status);
  const elapsed = wake.startedAt ? Math.max(0, (Date.parse(wake.endedAt || '') || now || Date.parse(wake.startedAt)) - Date.parse(wake.startedAt)) : 0;
  const activity = wakeActivities(executions);
  return <section className="wake-session-card" aria-label="唤醒活动"><header><span aria-hidden="true">☀</span><b>{status === 'error' ? '本轮未完成' : !wake.startedAt ? '正在连接' : running ? online ? '醒来' : '连接中断 · 状态待确认' : '本轮结束'}</b><small>{wake.startedAt ? `${running ? '已醒' : '历时'} ${Math.floor(elapsed / 60000)} 分 ${Math.floor(elapsed / 1000) % 60} 秒` : '尚未开始'}</small></header><p>{activity.length ? [...new Set(activity.map(item => `${item.label} · ${item.status}`))].join('；') : '尚未收到工具调用记录。'}</p>{activity.length > 0 && <details><summary>查看 {activity.length} 项活动</summary><ul>{activity.map(item => <li key={item.id}><span>{item.name}</span><small>{item.status}</small></li>)}</ul></details>}</section>;
}
