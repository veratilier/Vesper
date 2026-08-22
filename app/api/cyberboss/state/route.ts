import { allowedDocumentKeys } from "@/db/schema";
import { authorizeBridge } from "@/lib/bridge-auth";
import { ensureSchema, getDb } from "@/lib/db";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!(await authorizeBridge(request)))
    return json({ error: "Unauthorized" }, 401);
  await ensureSchema();
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!allowedDocumentKeys.has(key))
    return json({ error: "Unknown document" }, 400);
  const row = await getDb()
    .prepare("SELECT value, updated_at FROM vesper_documents WHERE key = ?")
    .bind(key)
    .first<{ value: string; updated_at: string }>();
  return json(
    row
      ? { key, value: JSON.parse(row.value), updatedAt: row.updated_at }
      : { key, value: null },
  );
}

export async function PUT(request: Request) {
  if (!(await authorizeBridge(request)))
    return json({ error: "Unauthorized" }, 401);
  await ensureSchema();
  const body = (await request.json()) as { key?: string; value?: unknown };
  if (
    !body.key ||
    !allowedDocumentKeys.has(body.key) ||
    body.value === undefined
  ) {
    return json({ error: "Invalid document" }, 400);
  }
  const updatedAt = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT INTO vesper_documents (key, value, updated_at)
    VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(body.key, JSON.stringify(body.value), updatedAt)
    .run();
  return json({ ok: true, updatedAt });
}
