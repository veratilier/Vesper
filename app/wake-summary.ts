import type { Execution } from './codex-execution';
export type WakeRecord = { requestId: string; requestedAt: string; startedAt?: string; endedAt?: string; source: 'manual' | 'automation' };
const labels: [RegExp, string][] = [
  [/atlas_memory|search_memory|recall_memory/, '翻阅记忆'],
  [/atlas_note|list_notes|save_note/, '查看或整理便笺'],
  [/journal|diary/, '查看或整理日记'],
  [/galatea|botling|galaxy/, '浏览社区'],
  [/desire/, '查看或记录 Desire'],
  [/search|browse/i, '检索资料'],
];
export function wakeActivities(executions: Execution[]) {
  const unique = new Map(executions.map(item => [item.id, item]));
  return [...unique.values()].map(item => ({ id: item.id, name: item.title, label: labels.find(([pattern]) => pattern.test(item.title))?.[1] || (item.type === 'commandExecution' ? '执行命令' : item.type === 'fileChange' ? '修改文件' : '调用工具'), status: ['completed', 'succeeded'].includes(item.status) ? '已完成' : ['failed', 'error', 'declined', 'cancelled', 'interrupted'].includes(item.status) ? '未完成' : '执行中' }));
}
