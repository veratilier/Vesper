import { authorizeApp } from '@/lib/bridge-auth';
import { getDb } from '@/lib/db';
import { corsHeaders, optionsResponse } from '@/lib/cors';
export const OPTIONS = optionsResponse;

// Recovery uses the independent device pairing credential, never the lost MCP token.
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  headers.set('cache-control', 'no-store');
  if (!await authorizeApp(request)) return Response.json({ error: '设备配对已失效，请先重新配对 Vesper，再恢复 MCP 令牌。' }, { status: 401, headers });
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: '需要 JSON 请求' }, { status: 415, headers });
    const raw = await request.text();
    if (raw.length > 2048) return Response.json({ error: '请求过大' }, { status: 413, headers });
    const body = JSON.parse(raw) as { token?: unknown };
    if (typeof body?.token !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(body.token)) return Response.json({ error: '请填写 16–256 位访问令牌，仅含字母、数字、下划线或短横线，不要包含 Bearer。' }, { status: 400, headers });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.token));
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    const db = getDb();
    await db.prepare('CREATE TABLE IF NOT EXISTS vesper_mcp_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
    await db.prepare("INSERT INTO vesper_mcp_config(key,value,updated_at) VALUES('access_token_hash',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(hash, new Date().toISOString()).run();
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: '令牌未能保存，请稍后重试。' }, { status: 400, headers });
  }
}
