import { allowedDocumentKeys } from '@/db/schema';
import { ensureSchema, getDb } from '@/lib/db';

export async function GET(request: Request) {
  await ensureSchema();
  const key = new URL(request.url).searchParams.get('key');
  if (key) {
    if (!allowedDocumentKeys.has(key)) return Response.json({ error: 'Unknown document' }, { status: 400 });
    const row = await getDb().prepare('SELECT value, updated_at FROM vesper_documents WHERE key = ?').bind(key).first<{ value: string; updated_at: string }>();
    return Response.json(row ? { key, value: JSON.parse(row.value), updatedAt: row.updated_at } : { key, value: null });
  }
  const result = await getDb().prepare('SELECT key, value, updated_at FROM vesper_documents').all<{ key: string; value: string; updated_at: string }>();
  const documents = Object.fromEntries(result.results.map((row) => [row.key, { value: JSON.parse(row.value), updatedAt: row.updated_at }]));
  return Response.json({ documents });
}

export async function PUT(request: Request) {
  await ensureSchema();
  const body = await request.json() as { key?: string; value?: unknown };
  if (!body.key || !allowedDocumentKeys.has(body.key) || body.value === undefined) {
    return Response.json({ error: 'Invalid document' }, { status: 400 });
  }
  const updatedAt = new Date().toISOString();
  await getDb().prepare(`INSERT INTO vesper_documents (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(body.key, JSON.stringify(body.value), updatedAt).run();
  return Response.json({ ok: true, updatedAt });
}
