import { authorizeApp } from '@/lib/bridge-auth';
import { memoryScopeFromRequest } from '@/lib/memory';
import { readExecutions, saveExecution } from '@/lib/codex-events';
import { corsHeaders, optionsResponse } from '@/lib/cors';
export const OPTIONS = optionsResponse;
export async function POST(request: Request) {
  const headers = corsHeaders(request); headers.set('cache-control', 'no-store');
  if (!await authorizeApp(request)) return Response.json({ error: 'Device not paired' }, { status: 401, headers });
  try {
    const raw = await request.text(); if (raw.length > 192000) throw new Error('Request too large');
    const { conversationId, event } = JSON.parse(raw);
    const scope = await memoryScopeFromRequest(request);
    await saveExecution(scope.userId, String(conversationId || ''), event);
    return Response.json({ ok: true }, { headers });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : 'Invalid event' }, { status: 400, headers }); }
}
export async function GET(request: Request) {
  const headers = corsHeaders(request); headers.set('cache-control', 'no-store');
  if (!await authorizeApp(request)) return Response.json({ error: 'Device not paired' }, { status: 401, headers });
  const scope = await memoryScopeFromRequest(request);
  const conversation = new URL(request.url).searchParams.get('conversationId') || '';
  if (!conversation) return Response.json({ error: 'Conversation required' }, { status: 400, headers });
  return Response.json(await readExecutions(scope.userId, conversation), { headers });
}
