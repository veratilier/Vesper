import assert from 'node:assert/strict';
import { userInputAnswer } from '../lib/codex-user-input.ts';
const request = { id: 12, method: 'item/tool/requestUserInput', params: { questions: [{ id: 'approval', question: 'Allow tool?', options: [{label:'Accept'}, {label:'Decline'}, {label:'Cancel'}] }] } };
assert.throws(() => userInputAnswer(request, {}));
assert.throws(() => userInputAnswer(request, { approval: 'approve everything' }));
for (const choice of ['Accept','Decline','Cancel']) assert.deepEqual(userInputAnswer(request, { approval: choice }), { answers: { approval: { answers: [choice] } } });
assert.deepEqual(userInputAnswer({ ...request, params: { questions: [{id:'note'}] } }, {note:'my answer'}), {answers:{note:{answers:['my answer']}}});
console.log('Explicit MCP question choices, no default consent, and protocol answer shape passed');
