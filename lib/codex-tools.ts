import { allowedDocumentKeys } from "@/db/schema";
import { ensureSchema, getDb } from "@/lib/db";

type ToolInput = Record<string, unknown>;

const sectionToKey: Record<string, string> = {
  today: "todos",
  notes: "notes",
  reminders: "todos",
  dates: "anniversaries",
  anniversaries: "anniversaries",
  journal: "diary",
  diary: "diary",
  music: "music",
  memory: "externalMemory",
  settings: "settings",
};

export const codexToolDefinitions = [
  {
    name: "read_vesper_state",
    description: "Read one Vesper document or section. Read-only; never changes data.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        section: {
          type: "string",
          enum: ["today", "notes", "reminders", "dates", "journal", "music", "memory", "settings"],
          description: "The Vesper section to read.",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "search_vesper_state",
    description: "Search Vesper notes, reminders, anniversaries, journal, and music by text. Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { query: { type: "string", description: "Text to search for." } },
      required: ["query"],
    },
  },
  {
    name: "write_vesper_state",
    description: "Create a Vesper note, reminder, anniversary, or agent journal entry.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["note", "reminder", "anniversary", "journal"] },
        text: { type: "string" },
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD for reminders, anniversaries, or journal." },
        repeats: { type: "boolean" },
        due: { type: "string" },
        tag: { type: "string" },
      },
      required: ["kind"],
    },
  },
] as const;

async function readDocument(key: string): Promise<unknown> {
  if (!allowedDocumentKeys.has(key)) throw new Error("Unsupported Vesper document");
  const row = await getDb().prepare("SELECT value FROM vesper_documents WHERE key = ?")
    .bind(key).first<{ value: string }>();
  if (!row) return key === "diary" || key === "settings" ? {} : [];
  try { return JSON.parse(row.value); } catch { return null; }
}

async function writeDocument(key: string, value: unknown) {
  if (!allowedDocumentKeys.has(key)) throw new Error("Unsupported Vesper document");
  await getDb().prepare(`INSERT INTO vesper_documents(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();
  return value;
}

export async function executeCodexTool(name: string, input: ToolInput) {
  await ensureSchema();
  if (name === "read_vesper_state") {
    const section = String(input.section || "notes").toLowerCase();
    const key = sectionToKey[section];
    if (!key) throw new Error(`Unknown Vesper section: ${section}`);
    return { section, value: await readDocument(key) };
  }
  if (name === "search_vesper_state") {
    const query = String(input.query || "").trim().toLowerCase();
    if (!query) return { matches: [] };
    const matches: Array<{ section: string; value: unknown }> = [];
    for (const [section, key] of Object.entries(sectionToKey)) {
      const value = await readDocument(key);
      if (JSON.stringify(value).toLowerCase().includes(query)) matches.push({ section, value });
    }
    return { matches: matches.filter((item, index, list) => list.findIndex((candidate) => candidate.section === item.section) === index) };
  }
  if (name === "write_vesper_state") {
    const kind = String(input.kind || "").toLowerCase();
    const now = new Date().toISOString();
    if (kind === "note") {
      const text = String(input.text || input.title || "").trim();
      if (!text) throw new Error("Note text is required");
      const notes = (await readDocument("notes")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), text, kind: "agent", tone: "cool", createdAt: now };
      await writeDocument("notes", [...notes, entry]);
      return { saved: true, section: "notes", entry };
    }
    if (kind === "reminder") {
      const title = String(input.title || input.text || "").trim();
      if (!title) throw new Error("Reminder title is required");
      const todos = (await readDocument("todos")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), title, done: false, due: String(input.due || input.date || ""), tag: String(input.tag || "Agent"), createdAt: now };
      await writeDocument("todos", [...todos, entry]);
      return { saved: true, section: "reminders", entry };
    }
    if (kind === "anniversary") {
      const title = String(input.title || input.text || "").trim();
      const date = String(input.date || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Anniversary title/date is invalid");
      const anniversaries = (await readDocument("anniversaries")) as Array<Record<string, unknown>>;
      const entry = { id: crypto.randomUUID(), title, date, repeats: input.repeats !== false };
      await writeDocument("anniversaries", [...anniversaries, entry]);
      return { saved: true, section: "anniversaries", entry };
    }
    if (kind === "journal") {
      const date = String(input.date || "");
      const text = String(input.text || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) throw new Error("Journal date/text is invalid");
      const diary = { ...await readDocument("diary") as Record<string, unknown> };
      diary[date] = { ...(diary[date] as Record<string, unknown> || {}), agent: text, updatedAt: now };
      await writeDocument("diary", diary);
      return { saved: true, section: "journal", date };
    }
    throw new Error(`Unsupported write kind: ${kind}`);
  }
  throw new Error(`Unknown Codex tool: ${name}`);
}
