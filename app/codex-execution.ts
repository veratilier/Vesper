export type Execution = {
  id: string; type: string; title: string; status: string; command?: string;
  cwd?: string; output: string; exitCode?: number; durationMs?: number;
  updatedAt: string; truncated?: boolean;
};
const types = new Set(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'toolCall', 'functionCall', 'mcpCall', 'shellCall', 'computerCall', 'webSearchCall', 'webSearch']);
const limit = 24000;
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
function display(v: unknown): string { if (v == null) return ''; return typeof v === 'string' ? v : JSON.stringify(v); }
export function executionEvent(method: string, params: Record<string, unknown>, previous?: Execution): Execution | null {
  const item = record(params.item);
  const id = String(item.id || params.itemId || '');
  const delta = method === 'item/commandExecution/outputDelta' || method === 'item/fileChange/outputDelta';
  if (!id || (!delta && !(['item/started', 'item/completed'].includes(method) && types.has(String(item.type))))) return null;
  if (delta && previous && !['inProgress', 'running', 'unknown'].includes(previous.status)) return previous;
  const type = String(item.type || previous?.type || 'commandExecution');
  const command = (display(item.command) || previous?.command || '').slice(0, 3000) || undefined;
  let output = previous?.output || '';
  if (delta) output += display(params.delta);
  else if (item.aggregatedOutput != null) output = display(item.aggregatedOutput);
  else if (item.error != null) output = display(item.error);
  else if (item.result != null) output = display(item.result);
  else if (item.changes != null) output = display(item.changes);
  else if (item.contentItems != null) output = display(item.contentItems);
  const exitCode = typeof item.exitCode === 'number' ? item.exitCode : previous?.exitCode;
  // A late start/delta must not turn a completed item back into a running one.
  const terminal = previous && !['inProgress', 'running', 'unknown'].includes(previous.status);
  const status = terminal && method !== 'item/completed' ? previous.status : String(item.status || (method === 'item/completed' ? 'completed' : previous?.status || 'inProgress'));
  return { id, type, command, title: command || display(item.tool || item.name).slice(0, 500) || (type === 'fileChange' ? '文件修改' : type === 'commandExecution' ? '终端' : type), cwd: display(item.cwd).slice(0, 1000) || previous?.cwd,
    status: item.success === false || (exitCode != null && exitCode !== 0 && status === 'completed') ? 'failed' : status,
    output: output.slice(-limit), truncated: output.length > limit || previous?.truncated,
    exitCode, durationMs: typeof item.durationMs === 'number' ? item.durationMs : previous?.durationMs, updatedAt: new Date().toISOString() };
}
export function workspaceOptions(value: unknown) {
  const cwd = typeof value === 'string' ? value.trim() : '';
  if (!cwd) return {};
  if (!cwd.startsWith('/') || /[\r\n\0]/.test(cwd)) throw new Error('工作目录必须是 app-server 上的绝对路径');
  return { cwd };
}
