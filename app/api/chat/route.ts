import { ensureSchema, getDb } from '@/lib/db';
import { authorizeApp } from '@/lib/bridge-auth';
import { corsHeaders, optionsResponse } from '@/lib/cors';

type ChatRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  status: string;
  metadata: string;
  created_at: string;
};

function json(request: Request, value: unknown, status = 200) {
  return Response.json(value, { status, headers: corsHeaders(request) });
}

function present(row: ChatRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    status: row.status,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  };
}

export const OPTIONS = optionsResponse;

export async function GET(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: 'Device not paired' }, 401);
  await ensureSchema();
  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversationId')?.trim() || 'main';
  const result = await getDb().prepare(`SELECT id, conversation_id, role, content, status, metadata, created_at
    FROM vesper_chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 200`)
    .bind(conversationId).all<ChatRow>();
  const bridge = await getDb().prepare('SELECT runtime, last_seen_at, details FROM vesper_bridge_status WHERE id = ?')
    .bind('primary').first<{ runtime: string; last_seen_at: string; details: string }>();
  return json(request, {
    messages: result.results.reverse().map(present),
    bridge: bridge ? {
      runtime: bridge.runtime,
      lastSeenAt: bridge.last_seen_at,
      online: Date.now() - new Date(bridge.last_seen_at).getTime() < 45_000,
      details: JSON.parse(bridge.details || '{}'),
    } : { runtime: 'cyberboss', online: false },
  });
}

export async function POST(request: Request) {
  if (!(await authorizeApp(request))) return json(request, { error: 'Device not paired' }, 401);
  await ensureSchema();
  const body = await request.json() as { conversationId?: string; content?: string };
  const content = body.content?.trim() || '';
  if (!content || content.length > 20_000) return json(request, { error: 'Invalid message' }, 400);
  const message = {
    id: crypto.randomUUID(),
    conversationId: body.conversationId?.trim() || 'main',
    role: 'user' as const,
    content,
    status: 'queued',
    metadata: {},
    createdAt: new Date().toISOString(),
  };
  await getDb().prepare(`INSERT INTO vesper_chat_messages
    (id, conversation_id, role, content, status, metadata, created_at)
    VALUES (?, ?, 'user', ?, 'queued', '{}', ?)`)
    .bind(message.id, message.conversationId, message.content, message.createdAt).run();
  return json(request, { message }, 201);
}
