import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const env = { VESPER_APP_TOKEN: 'synthetic-device-pairing-for-tests' };
let storedHash = '', failWrites = false, writes = 0;
const db = { prepare(sql) { return { bind(hash) { return { async run() { if (failWrites) throw new Error('DB unavailable'); storedHash = hash; writes++; } }; }, async run() {} }; } };
function compile(path, require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require, crypto, Request, Response, Headers, TextEncoder, Uint8Array, console });
  return exports;
}
const auth = compile('lib/bridge-auth.ts', name => { assert.equal(name, 'cloudflare:workers'); return { env }; });
const cors = compile('lib/cors.ts', () => { throw new Error('unexpected import'); });
const { POST } = compile('app/api/mcp/owner-token/route.ts', name => ({ '@/lib/bridge-auth': auth, '@/lib/cors': cors, '@/lib/db': { getDb: () => db } }[name]));
const oldToken = 'synthetic-old-mcp-token', newToken = 'synthetic-new-mcp-token';
const hash = async value => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
storedHash = await hash(oldToken);
function request(device, token = newToken, extra = {}) { return POST(new Request('https://api.vesper.r-vera.com/api/mcp/owner-token', { method: 'POST', headers: { 'content-type': 'application/json', ...(device ? { 'x-vesper-device-token': device } : {}), ...extra }, body: JSON.stringify({ token }) })); }
for (const device of ['', 'wrong-device', oldToken]) assert.equal((await request(device)).status, 401);
assert.equal(writes, 0, 'MCP credential alone cannot recover owner access');
assert.equal((await request('', newToken, { authorization: `Bearer ${oldToken}` })).status, 401);
const ok = await request(env.VESPER_APP_TOKEN);
assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store');
assert.equal(await ok.text(), '{"ok":true}', 'never return raw credentials or hashes');
assert.equal(storedHash, await hash(newToken)); assert.notEqual(storedHash, await hash(oldToken));
assert.equal((await request(env.VESPER_APP_TOKEN)).status, 200, 'retrying the same token is idempotent');
const count = writes;
for (const value of ['short', `Bearer ${newToken}`, 'bad token with spaces', 'a'.repeat(257), null]) assert.equal((await request(env.VESPER_APP_TOKEN, value)).status, 400);
assert.equal(writes, count);
failWrites = true;
assert.equal((await request(env.VESPER_APP_TOKEN, 'another-synthetic-token')).status, 400);
assert.equal(storedHash, await hash(newToken), 'failed update preserves configured hash');
env.VESPER_APP_TOKEN = '';
assert.equal((await request('synthetic-device-pairing-for-tests')).status, 401, 'missing server pairing secret fails closed');
console.log('MCP recovery: real device auth, missing/wrong/MCP-only credentials, replacement, retry, validation and failed-write preservation passed');
