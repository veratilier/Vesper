import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { executeDesire } from '/tmp/vesper-desire-native-test.mjs';
import { recordEncounter } from '/tmp/rowan-encounter-service-test.mjs';
const start = '2026-09-04T17:04:07.374Z';
function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  for (const file of ["0001_desire_state_and_history.sql", "0002_separate_absence_cursors.sql", "0003_interaction_provenance_and_time.sql"]) {
    db.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), "utf8"));
  }
  db.prepare(`INSERT INTO desire_state (user_id,style,longing,tenderness,playfulness,intensity,attachment,possessiveness,
    last_encounter_at,last_real_interaction_at,longing_calculated_through_at,updated_at,
    last_absence_evaluated_at,last_intensity_evaluated_at,last_settled_at)
    VALUES ('veratilier','quiet',100,99,28,22,96,20,?,?,?,?,?,?,?)`).run(...Array(7).fill(start));
  const kv = new Map();
  let pushLookups = 0;
  const env = {
    DESIRE_DB: {
      prepare(sql) {
        return { bind(...values) {
          return { first: async () => db.prepare(sql).get(...values) ?? null,
            all: async () => ({ results: db.prepare(sql).all(...values) }), run: async () => db.prepare(sql).run(...values), sql, values };
        } };
      },
      async batch(statements) {
        db.exec("BEGIN");
        try {
          const result = statements.map(({ sql, values }) => db.prepare(sql).run(...values));
          db.exec("COMMIT"); return result;
        } catch (error) { db.exec("ROLLBACK"); throw error; }
      },
    },
    OAUTH_KV: {
      async get(key) { if (key.includes("push-subscriptions")) pushLookups++; return kv.get(key) ?? null; },
      async put(key, value) { kv.set(key, JSON.parse(value)); },
    },
  };
  return { env: { DESIRE_DB: env.DESIRE_DB, DESIRE_LEGACY_KV: env.OAUTH_KV }, db, pushLookups: () => pushLookups,
    snapshot: () => db.prepare("SELECT * FROM desire_state").get() };
}

test('native reads reuse the verified original owner without altering state', async t => {
  const f = fixture(t), before = f.snapshot();
  const status = await executeDesire(f.env, 'desire_status');
  assert.equal(status.longing, 100);
  assert.deepEqual(f.snapshot(), before);
  const history = await executeDesire(f.env, 'desire_history');
  assert.deepEqual(history.records, []);
  assert.deepEqual(f.snapshot(), before);
});
test('missing binding or original state fails closed without a default seed', async t => {
  await assert.rejects(executeDesire({}, 'desire_status'));
  const f = fixture(t); f.db.exec('DELETE FROM desire_state');
  await assert.rejects(executeDesire(f.env, 'desire_status'));
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM desire_state').get().n, 0);
});
test('old MCP encounter replays through Vesper, preserving IDs and history', async t => {
  const f = fixture(t);
  const input = { kind: 'repair', interaction_source: 'user', request_id: 'before-cutover', note: '  原样保留。\n不重复计分。  ' };
  const old = await recordEncounter({ DESIRE_DB: f.env.DESIRE_DB, OAUTH_KV: f.env.DESIRE_LEGACY_KV }, 'veratilier', input, new Date(start));
  const before = f.snapshot();
  const replay = await executeDesire(f.env, 'desire_encounter', input);
  assert.equal(replay.replayed, true); assert.equal(replay.encounterId, old.encounterId);
  assert.deepEqual(f.snapshot(), before);
  assert.equal((await executeDesire(f.env, 'desire_history')).records[0].note, input.note);
  await assert.rejects(executeDesire(f.env, 'desire_encounter', { ...input, note: 'different' }));
});
test('native validates provenance; automation does not impersonate a real message', async t => {
  const f = fixture(t), before = f.snapshot();
  await assert.rejects(executeDesire(f.env, 'desire_encounter', { kind: 'repair', request_id: 'bad' }));
  await assert.rejects(executeDesire(f.env, 'desire_encounter', { kind: 'absence', interaction_source: 'user', request_id: 'bad' }));
  assert.deepEqual(f.snapshot(), before);
  await executeDesire(f.env, 'desire_encounter', { kind: 'warmth', interaction_source: 'automation', request_id: 'wake' });
  assert.equal(f.snapshot().last_real_interaction_at, before.last_real_interaction_at);
});
test('record expression and style changes never create a relationship encounter', async t => {
  const f = fixture(t), before = f.snapshot();
  const result = await executeDesire(f.env, 'desire_express', { mode: 'record' });
  assert.equal(result.recorded, true); assert.equal(result.message, undefined);
  await executeDesire(f.env, 'desire_set_style', { style: 'playful' });
  assert.equal(f.snapshot().style, 'playful');
  assert.equal(f.snapshot().last_real_interaction_at, before.last_real_interaction_at);
  assert.equal((await executeDesire(f.env, 'desire_history')).records.length, 0);
});
test('native notifications use Vesper subscriptions once, never old PWA subscriptions', async t => {
  const f = fixture(t); let lookups = 0;
  f.env.DB = { prepare(sql) { assert.equal(sql, 'SELECT subscription FROM vesper_push_subscriptions'); return { async all() { lookups++; return { results: [] }; } }; } };
  f.env.VAPID_PUBLIC_KEY = 'unused'; f.env.VAPID_PRIVATE_KEY = 'unused';
  f.env.DESIRE_LEGACY_KV.get = async key => { assert.ok(!key.includes('push-subscriptions')); return null; };
  const input = { kind: 'warmth', interaction_source: 'automation', request_id: 'native-notify' };
  await executeDesire(f.env, 'desire_encounter', input);
  await executeDesire(f.env, 'desire_encounter', input);
  assert.equal(lookups, 1);
});

test('notification click opens Desire without reloading an existing Vesper window', async () => {
  const { runInNewContext } = await import('node:vm');
  const handlers = {}; let message, focused = false, pending;
  const window = { url: 'https://vesper.r-vera.com/', postMessage(value) { message = value; }, async focus() { focused = true; } };
  const self = { registration: { scope: 'https://vesper.r-vera.com/' }, addEventListener(name, callback) { handlers[name] = callback; }, clients: { async matchAll() { return [window]; }, openWindow() { throw Error('must not open a second window'); } } };
  runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), { self, URL });
  handlers.notificationclick({ notification: { close() {}, data: { url: '/?section=desire' } }, waitUntil(value) { pending = value; } });
  await pending;
  assert.equal(message.section, 'desire'); assert.equal(focused, true);
});
test('notification click opens the native route in a new window and rejects external destinations', async () => {
  const { runInNewContext } = await import('node:vm');
  for (const [requested, expected] of [['/?section=desire', 'https://vesper.r-vera.com/?section=desire'], ['https://other.example/', 'https://vesper.r-vera.com/']]) {
    const handlers = {}; let opened, pending;
    const self = { registration: { scope: 'https://vesper.r-vera.com/' }, addEventListener(name, callback) { handlers[name] = callback; }, clients: { async matchAll() { return []; }, async openWindow(url) { opened = url; } } };
    runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), { self, URL });
    handlers.notificationclick({ notification: { close() {}, data: { url: requested } }, waitUntil(value) { pending = value; } });
    await pending; assert.equal(opened, expected);
  }
});
