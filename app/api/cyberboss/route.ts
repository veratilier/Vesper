import { ensureSchema, getDb } from '@/lib/db';
import { authorizeBridge } from '@/lib/bridge-auth';

type PendingRow = { id: string; conversation_id: string; content: string; created_at: string };

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
}

async function touch(details: unknown = {}) {
  const now = new Date().toISOString();
  await getDb().prepare(`INSERT INTO vesper_bridge_status (id, runtime, last_seen_at, details)
    VALUES ('primary', 'cyberboss', ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, details = excluded.details`)
    .bind(now, JSON.stringify(details || {})).run();
  return now;
}

export async function GET(request: Request) {
  if (!(await authorizeBridge(request))) return json({ error: 'Unauthorized' }, 401);
  await ensureSchema();
  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  const result = await getDb().prepare(`SELECT id, conversation_id, content, created_at
    FROM vesper_chat_messages WHERE role = 'user' AND status = 'queued'
    ORDER BY created_at LIMIT ?`).bind(limit).all<PendingRow>();
  if (result.results.length) {
    const now = new Date().toISOString();
    await getDb().batch(result.results.map((row) => getDb().prepare(
      "UPDATE vesper_chat_messages SET status = 'delivered', delivered_at = ? WHERE id = ? AND status = 'queued'"
    ).bind(now, row.id)));
  }
  const lastSeenAt = await touch({ state: 'polling' });
  return json({
    messages: result.results.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      content: row.content,
      createdAt: row.created_at,
    })),
    lastSeenAt,
  });
}

export async function POST(request: Request) {
  if (!(await authorizeBridge(request))) return json({ error: 'Unauthorized' }, 401);
  await ensureSchema();
  const body = await request.json() as {
    type?: 'heartbeat' | 'message';
    conversationId?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  };
  if (body.type === 'heartbeat') {
    return json({ ok: true, lastSeenAt: await touch(body.metadata) });
  }
  const content = body.content?.trim() || '';
  if (body.type !== 'message' || !content || content.length > 100_000) {
    return json({ error: 'Invalid event' }, 400);
  }
  const id = crypto.randomUUID();
  const createdAt = body.createdAt || new Date().toISOString();
  await getDb().prepare(`INSERT INTO vesper_chat_messages
    (id, conversation_id, role, content, status, metadata, created_at, delivered_at)
    VALUES (?, ?, 'agent', ?, 'complete', ?, ?, ?)`)
    .bind(id, body.conversationId?.trim() || 'main', content, JSON.stringify(body.metadata || {}), createdAt, createdAt).run();
  await touch({ state: 'replying' });
  return json({ ok: true, id, createdAt }, 201);
}
