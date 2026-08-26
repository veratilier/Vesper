export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS vesper_documents (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vesper_documents_updated_at
   ON vesper_documents(updated_at)`,
  `CREATE TABLE IF NOT EXISTS vesper_chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'agent', 'system')),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    delivered_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vesper_chat_conversation
   ON vesper_chat_messages(conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_vesper_chat_delivery
   ON vesper_chat_messages(role, status, created_at)`,
  `CREATE TABLE IF NOT EXISTS vesper_bridge_status (
    id TEXT PRIMARY KEY,
    runtime TEXT NOT NULL DEFAULT 'cyberboss',
    last_seen_at TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS vesper_push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    subscription TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

export const allowedDocumentKeys = new Set([
  "profile",
  "appearance",
  "notes",
  "todos",
  "anniversaries",
  "diary",
  "conversations",
  "settings",
  "environment",
  "music",
  "musicQueue",
  "musicControl",
  "musicTogether",
  "musicAnnotations",
  "musicFavorites",
  "magicBox",
  "pet",
  "connections",
  "externalMemory",
  "favorites",
]);
