import assert from 'node:assert/strict';
import { executionEvent, workspaceOptions } from '../app/codex-execution.ts';
import { mergeCodexMessages } from '../app/codex-message-merge.ts';
let state = executionEvent('item/started', { item: { id: 'exec-1', type: 'commandExecution', command: 'npm test', cwd: '/project', status: 'inProgress' } });
assert.equal(state.status, 'inProgress');
state = executionEvent('item/commandExecution/outputDelta', { itemId: 'exec-1', delta: 'one\n' }, state);
state = executionEvent('item/commandExecution/outputDelta', { itemId: 'exec-1', delta: 'two\n' }, state);
assert.equal(state.output, 'one\ntwo\n');
state = executionEvent('item/completed', { item: { id: 'exec-1', type: 'commandExecution', status: 'completed', aggregatedOutput: 'authoritative', exitCode: 1 } }, state);
assert.equal(state.output, 'authoritative'); assert.equal(state.status, 'failed');
assert.equal(executionEvent('item/started', { item: { id: 'exec-1', type: 'commandExecution', status: 'inProgress' } }, state).status, 'failed');
assert.equal(executionEvent('item/agentMessage/delta', { itemId: 'x', delta: 'hello' }), null);
assert.equal(executionEvent('item/completed', { item: { id: 'reason', type: 'reasoning', content: 'private' } }), null);
const large = executionEvent('item/commandExecution/outputDelta', { itemId: 'exec-2', delta: 'x'.repeat(30000) });
assert.equal(large.output.length, 24000); assert.equal(large.truncated, true);
assert.equal(executionEvent('item/completed', { item: { id: 'call', type: 'dynamicToolCall', success: false, contentItems: [{ text: 'denied' }] } }).status, 'failed');
const messages = ['a', 'b'].map(id => ({ id, role: 'system', content: 'npm test', createdAt: '2026-09-08T00:00:00Z', metadata: { itemId: id, turnId: 'turn' } }));
assert.equal(mergeCodexMessages(messages).length, 2, 'distinct executions must never deduplicate by command');
assert.equal(mergeCodexMessages(messages, messages).length, 2, 'snapshot replay remains idempotent');
assert.deepEqual(workspaceOptions('/home/ubuntu/Vesper'), { cwd: '/home/ubuntu/Vesper' });
assert.deepEqual(workspaceOptions(''), {});
assert.throws(() => workspaceOptions('relative/path'));
assert.throws(() => workspaceOptions('/project\nother'));
console.log('Execution event, replay, output limits, failed status and workspace checks passed');

assert.equal(executionEvent('item/commandExecution/outputDelta', { itemId: 'exec-1', delta: 'duplicate output' }, state).output, 'authoritative');
const done = { id: 'exec', role: 'system', content: 'terminal', createdAt: '2026-09-08T00:00:00Z', status: 'completed', metadata: { itemId: 'exec', execution: { ...state, status: 'completed', updatedAt: '2026-09-08T00:00:02Z' } } };
const stale = { ...done, status: 'inProgress', metadata: { ...done.metadata, execution: { ...done.metadata.execution, status: 'inProgress', output: 'partial', updatedAt: '2026-09-08T00:00:03Z' } } };
for (const sources of [[done, stale], [stale, done]]) {
  const merged = mergeCodexMessages(sources);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].metadata.execution.status, 'completed');
  assert.equal(merged[0].metadata.execution.output, 'authoritative');
}
console.log('Late output and stale running snapshots cannot replay or regress completed execution');
