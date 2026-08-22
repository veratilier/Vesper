import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { sendPushBatch, type PushSubscriptionData } from "@mmmike/web-push/send";
import { z } from "zod";

type Env = {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};
type Note = { id: string; text: string; kind: "user" | "agent"; tone: string; createdAt: string };
type Todo = { id: string; title: string; done: boolean; due: string; tag: string; createdAt: string };
type Anniversary = { id: string; title: string; date: string; repeats: boolean };
type DiaryEntry = { user?: string; agent?: string; updatedAt?: string };

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,mcp-protocol-version",
};
const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const now = () => new Date().toISOString();

async function ensure(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vesper_documents (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS vesper_mcp_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS vesper_push_subscriptions (endpoint TEXT PRIMARY KEY, subscription TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
  ]);
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function configuredHash(db: D1Database) {
  return (await db.prepare("SELECT value FROM vesper_mcp_config WHERE key = 'access_token_hash'").first<{ value: string }>())?.value || "";
}

async function authorized(request: Request, db: D1Database) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = await configuredHash(db);
  return Boolean(token && expected && (await digest(token)) === expected);
}

async function readDoc<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db.prepare("SELECT value FROM vesper_documents WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

async function writeDoc(db: D1Database, key: string, value: unknown) {
  await db.prepare(`INSERT INTO vesper_documents(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(key, JSON.stringify(value), now()).run();
}

function createServer(env: Env) {
  const server = new McpServer({ name: "Vesper", version: "1.0.0" });

  server.registerTool("vesper_overview", { description: "查看 Vesper 中便笺、待办、纪念日和日记的数量。" }, async () => {
    const [notes, todos, anniversaries, diary] = await Promise.all([
      readDoc<unknown[]>(env.DB, "notes", []), readDoc<Todo[]>(env.DB, "todos", []),
      readDoc<unknown[]>(env.DB, "anniversaries", []), readDoc<Record<string, unknown>>(env.DB, "diary", {}),
    ]);
    return text({ notes: notes.length, todos: todos.length, openTodos: todos.filter((item) => !item.done).length, anniversaries: anniversaries.length, diaryDays: Object.keys(diary).length });
  });

  server.registerTool("list_notes", { description: "列出 Vesper 便笺。" }, async () => text(await readDoc(env.DB, "notes", [])));
  server.registerTool("save_note", {
    description: "在 Vesper 留下或更新一张 Agent 便笺。",
    inputSchema: { text: z.string().min(1), id: z.string().optional(), tone: z.string().optional() },
  }, async ({ text: noteText, id, tone }) => {
    const notes = await readDoc<Note[]>(env.DB, "notes", []);
    const entry: Note = { id: id || crypto.randomUUID(), text: noteText, kind: "agent", tone: tone || "cool", createdAt: now() };
    const index = notes.findIndex((item) => item.id === entry.id);
    if (index >= 0) notes[index] = { ...notes[index], ...entry }; else notes.push(entry);
    await writeDoc(env.DB, "notes", notes);
    return text(entry);
  });

  server.registerTool("list_todos", { description: "列出 Vesper 提醒。" }, async () => text(await readDoc(env.DB, "todos", [])));
  server.registerTool("save_todo", {
    description: "创建一项 Vesper 提醒。",
    inputSchema: { title: z.string().min(1), due: z.string().optional(), tag: z.string().optional() },
  }, async ({ title, due, tag }) => {
    const todos = await readDoc<Todo[]>(env.DB, "todos", []);
    const entry = { id: crypto.randomUUID(), title, done: false, due: due || "", tag: tag || "Agent", createdAt: now() };
    todos.push(entry); await writeDoc(env.DB, "todos", todos); return text(entry);
  });
  server.registerTool("complete_todo", {
    description: "完成或重新打开一项 Vesper 提醒。",
    inputSchema: { id: z.string(), done: z.boolean().default(true) },
  }, async ({ id, done }) => {
    const todos = await readDoc<Todo[]>(env.DB, "todos", []);
    const entry = todos.find((item) => item.id === id);
    if (!entry) throw new Error("Todo not found");
    entry.done = done; await writeDoc(env.DB, "todos", todos); return text(entry);
  });

  server.registerTool("list_anniversaries", { description: "列出 Vesper 纪念日。" }, async () => text(await readDoc(env.DB, "anniversaries", [])));
  server.registerTool("save_anniversary", {
    description: "创建一个 Vesper 纪念日。日期使用 YYYY-MM-DD。",
    inputSchema: { title: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), repeats: z.boolean().default(true) },
  }, async ({ title, date, repeats }) => {
    const items = await readDoc<Anniversary[]>(env.DB, "anniversaries", []);
    const entry = { id: crypto.randomUUID(), title, date, repeats };
    items.push(entry); await writeDoc(env.DB, "anniversaries", items); return text(entry);
  });

  server.registerTool("get_diary", {
    description: "读取指定日期的 Vesper 日记。",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
  }, async ({ date }) => text((await readDoc<Record<string, unknown>>(env.DB, "diary", {}))[date] || null));
  server.registerTool("write_agent_diary", {
    description: "写入指定日期的 Agent 日记，不会覆盖用户日记。",
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), content: z.string().min(1) },
  }, async ({ date, content }) => {
    const diary = await readDoc<Record<string, DiaryEntry>>(env.DB, "diary", {});
    diary[date] = { ...(diary[date] || { user: "" }), agent: content, updatedAt: now() };
    await writeDoc(env.DB, "diary", diary); return text(diary[date]);
  });

  server.registerTool("search_memory", {
    description: "在 Vesper 的便笺、日记、提醒和纪念日中搜索文字。",
    inputSchema: { query: z.string().min(1) },
  }, async ({ query }) => {
    const keys = ["notes", "diary", "todos", "anniversaries"];
    const lower = query.toLowerCase();
    const matches = [];
    for (const key of keys) {
      const value = await readDoc<unknown>(env.DB, key, key === "diary" ? {} : []);
      const serialized = JSON.stringify(value);
      if (serialized.toLowerCase().includes(lower)) matches.push({ source: key, value });
    }
    return text(matches);
  });

  server.registerTool("send_notification", {
    description: "向已授权 Web Push 的 Vesper 设备发送通知。",
    inputSchema: { title: z.string().default("Vesper"), body: z.string().min(1), url: z.string().default("/"), tag: z.string().optional() },
  }, async ({ title, body, url, tag }) => {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("Web Push is not configured");
    const rows = await env.DB.prepare("SELECT subscription FROM vesper_push_subscriptions").all<{ subscription: string }>();
    const subscriptions = rows.results.map((row) => JSON.parse(row.subscription) as PushSubscriptionData);
    const result = await sendPushBatch(subscriptions, { title, body, url, tag }, {
      publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT || "mailto:admin@r-vera.com",
    });
    for (const endpoint of result.gone) await env.DB.prepare("DELETE FROM vesper_push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
    return text({ subscriptions: subscriptions.length, delivered: result.delivered, failed: result.failed.length });
  });
  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    await ensure(env.DB);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health") return Response.json({ ok: true, configured: Boolean(await configuredHash(env.DB)) }, { headers: cors });
    if (url.pathname === "/setup" && request.method === "POST") {
      const existing = await configuredHash(env.DB);
      if (existing && !(await authorized(request, env.DB))) return Response.json({ error: "当前令牌无效，无法更新" }, { status: 401, headers: cors });
      const body = await request.json<{ token?: string }>();
      if (!body.token || body.token.trim().length < 16) return Response.json({ error: "令牌至少需要 16 位" }, { status: 400, headers: cors });
      await env.DB.prepare(`INSERT INTO vesper_mcp_config(key,value,updated_at) VALUES('access_token_hash',?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(await digest(body.token.trim()), now()).run();
      return Response.json({ ok: true }, { headers: cors });
    }
    if (url.pathname !== "/mcp") return new Response("Vesper MCP", { status: 200, headers: cors });
    if (!(await authorized(request, env.DB))) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { ...cors, "www-authenticate": "Bearer" } });
    return createMcpHandler(() => createServer(env), { route: "/mcp" })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
