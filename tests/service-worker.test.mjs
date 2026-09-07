import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function setup(fetchImpl = async () => new Response('ok')) {
  const handlers = {}, writes = [], deleted = [], waits = [];
  const cache = { put: async (...args) => writes.push(args), match: async () => undefined };
  const context = { URL, Response, fetch: fetchImpl,
    caches: { open: async () => cache, keys: async () => ['vesper-shell-v16-music-room', 'other-app'], delete: async key => deleted.push(key) },
    self: { location: { origin: 'https://vesper.test' }, addEventListener: (name, fn) => handlers[name] = fn, clients: { claim() {} } } };
  vm.runInNewContext(source, context);
  async function request(path, destination = '', headers = {}) {
    let response;
    handlers.fetch({ request: { method: 'GET', url: `https://vesper.test${path}`, destination, mode: 'cors', headers: new Headers(headers) }, respondWith: p => response = p, waitUntil: p => waits.push(p) });
    const result = await response;
    await Promise.all(waits);
    return result;
  }
  return { request, writes, deleted, activate: async () => { handlers.activate({ waitUntil: p => waits.push(p) }); await Promise.all(waits); } };
}
test('API, authenticated and unclassified data requests bypass cache', async () => {
  const s = setup();
  assert.equal(await s.request('/api/chat', 'document'), undefined);
  assert.equal(await s.request('/asset.png', 'image', { authorization: 'test' }), undefined);
  assert.equal(await s.request('/state'), undefined);
  assert.equal(s.writes.length, 0);
});
test('successful static response is cached', async () => {
  const s = setup(); assert.equal((await s.request('/app.js', 'script')).status, 200); assert.equal(s.writes.length, 1);
});
test('errors and private responses are not cached', async () => {
  for (const response of [new Response('bad', { status: 500 }), new Response('secret', { headers: { 'cache-control': 'private' } }), new Response('secret', { headers: { 'cache-control': 'no-store' } })]) {
    const s = setup(async () => response); await s.request('/app.js', 'script'); assert.equal(s.writes.length, 0);
  }
});
test('offline cache miss returns a valid 503 response', async () => {
  const s = setup(async () => { throw new Error('offline'); }); assert.equal((await s.request('/missing.js', 'script')).status, 503);
});
test('activation removes only old Vesper caches', async () => {
  const s = setup(); await s.activate(); assert.deepEqual(s.deleted, ['vesper-shell-v16-music-room']);
});
