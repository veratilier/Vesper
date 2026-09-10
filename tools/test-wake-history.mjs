import assert from 'node:assert/strict';
import { readWakeHistory } from '../lib/wake-history.ts';
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://codex.r-vera.com/history/conversations/chat%2Fa/wake-history');
  assert.equal(options.headers.authorization, 'Bearer fixture');
  assert.equal(options.redirect, 'error');
  return Response.json({messages:[{id:'silent',role:'system',content:'activity',createdAt:'2026-09-10',metadata:{wake:{messageOmitted:true},wakeRunId:'run'}}]});
};
let result = await readWakeHistory('chat/a','fixture');
assert.equal(result.available,true);
assert.equal(result.records[0].metadata.wake.messageOmitted,true);
globalThis.fetch = async () => new Response('',{status:404});
result = await readWakeHistory('chat/a','fixture');
assert.equal(result.available,false);
assert.match(result.note,/does not mean no wake/);
console.log('Silent wake history and unavailable-service checks passed');
