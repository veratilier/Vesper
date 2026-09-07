import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const globals = { AbortController, AbortSignal, Cloudflare: { compatibilityFlags: { global_fetch_strictly_public: true } }, crypto: globalThis.crypto, Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, btoa, atob, fetch: async () => Response.json({ client_id: "https://chatgpt.com/oauth/client.json", client_name: "ChatGPT", redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }), console, setTimeout, clearTimeout };
function compile(path, require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true } }).outputText, { ...globals, exports, require });
  return exports;
}
const lib = compile('node_modules/@cloudflare/workers-oauth-provider/dist/oauth-provider.js', name => { assert.equal(name, 'cloudflare:workers'); return { WorkerEntrypoint: class {} }; });
const { createOAuth, OAUTH_ORIGIN: origin } = compile('mcp-server/src/oauth.ts', name => { assert.equal(name, '@cloudflare/workers-oauth-provider'); return lib; });
const values = new Map();
const env = { OAUTH_KV: {
  async get(key, format) { const value = values.get(key); if (!value) return null; return (format === 'json' || format?.type === 'json') ? JSON.parse(value) : value; },
  async put(key, value) { values.set(key, value); }, async delete(key) { values.delete(key); },
  async list({ prefix = '' } = {}) { return { keys: [...values.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; }
} };
const provider = createOAuth({ async fetch(req, env, ctx) { return Response.json({ owner: ctx.props?.owner === true }); } }, { async fetch() { return new Response('not found', { status: 404 }); } }, async req => req.headers.get('authorization') === 'Bearer synthetic-owner-token-for-test');
const pending = [];
async function request(path, init) { return provider.fetch(new Request(origin + path, init), env, { waitUntil(p) { pending.push(p); }, passThroughOnException() {} }); }
const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
const protectedMeta = await (await request('/.well-known/oauth-protected-resource/mcp')).json();
assert.equal(protectedMeta.resource, origin + '/mcp');
const unauth = await request('/mcp'); assert.equal(unauth.status, 401); assert.match(unauth.headers.get('www-authenticate'), /resource_metadata/);
const redirect = 'https://chatgpt.com/connector_platform_oauth_redirect';
const registration = await request('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: [redirect, 'https://evil.example/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
assert.equal(registration.status, 201);
const client = await registration.json();
const verifier = 'a'.repeat(64);
const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
function authPath(callback = redirect) { return '/authorize?' + new URLSearchParams({ client_id: client.client_id, redirect_uri: callback, response_type: 'code', scope: 'vesper:access', state: 'test-state', code_challenge: challenge, code_challenge_method: 'S256', resource: origin + '/mcp' }); }
assert.equal((await request(authPath('https://evil.example/callback'))).status, 400);
const cimdPath = new URL(origin + authPath()); cimdPath.searchParams.set('client_id', 'https://chatgpt.com/oauth/client.json');
assert.equal((await request(cimdPath.pathname + cimdPath.search)).status, 200, 'CIMD client discovery');
const noPkce = new URL(origin + authPath()); noPkce.searchParams.delete('code_challenge'); noPkce.searchParams.delete('code_challenge_method');
assert.equal((await request(noPkce.pathname + noPkce.search)).status, 400);
const consent = await request(authPath()); assert.equal(consent.status, 200);
const cookie = consent.headers.get('set-cookie').split(';')[0], nonce = cookie.split('=')[1];
const post = (csrf, token, from = origin) => request('/authorize', { method: 'POST', headers: { origin: from, cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, token, decision: 'allow' }) });
assert.equal((await post('wrong', 'synthetic-owner-token-for-test')).status, 403);
assert.equal((await post(nonce, 'synthetic-owner-token-for-test', 'https://evil.example')).status, 403);
assert.equal((await post(nonce, 'bad-token')).status, 401);
const allow = await post(nonce, 'synthetic-owner-token-for-test'); assert.equal(allow.status, 303);
const location = new URL(allow.headers.get('location')); assert.equal(location.searchParams.get('state'), 'test-state');
const exchange = extra => request('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, code: location.searchParams.get('code'), redirect_uri: redirect, code_verifier: verifier, resource: origin + '/mcp', ...extra }) });
assert.equal((await exchange({ code_verifier: 'b'.repeat(64) })).status, 400);
const tokenResponse = await exchange({}); assert.equal(tokenResponse.status, 200);
const tokens = await tokenResponse.json(); assert.ok(tokens.access_token); assert.ok(tokens.refresh_token);
const api = await request('/mcp', { headers: { authorization: 'Bearer ' + tokens.access_token } }); assert.equal(api.status, 200); assert.equal((await api.json()).owner, true);
assert.equal((await post(nonce, 'synthetic-owner-token-for-test')).status, 403, 'consent cannot be replayed');
const refresh = await request('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource: origin + '/mcp' }) });
assert.equal(refresh.status, 200); assert.ok((await refresh.json()).access_token);
assert.equal((await exchange({})).status, 400, 'authorization code cannot be replayed');
await Promise.all(pending);
console.log('OAuth: discovery, consent, CSRF, callback restriction, owner authentication, PKCE, token use, replay rejection and refresh passed');
