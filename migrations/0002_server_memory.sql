CREATE TABLE IF NOT EXISTS vesper_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('core', 'long_term', 'feeling', 'dream')),
  body TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  weight REAL NOT NULL DEFAULT 0.65,
  pinned INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'approved' CHECK(review_status IN ('approved', 'candidate')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_surfaced_at TEXT,
  surface_count INTEGER NOT NULL DEFAULT 0,
  embedding TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  demoted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vesper_memories_scope
ON vesper_memories(user_id, character_id, type, pinned, updated_at);

CREATE INDEX IF NOT EXISTS idx_vesper_memories_fingerprint
ON vesper_memories(user_id, character_id, fingerprint);

CREATE TABLE IF NOT EXISTS vesper_memory_revisions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  body TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(memory_id) REFERENCES vesper_memories(id)
);

CREATE INDEX IF NOT EXISTS idx_vesper_memory_revisions_memory
ON vesper_memory_revisions(memory_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vesper_memory_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  turn_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('user', 'agent')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, character_id, conversation_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_vesper_memory_messages_window
ON vesper_memory_messages(user_id, character_id, conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vesper_memory_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued', 'retry', 'completed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, character_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_vesper_memory_jobs_due
ON vesper_memory_jobs(user_id, character_id, status, next_attempt_at);

CREATE VIRTUAL TABLE IF NOT EXISTS vesper_memory_fts USING fts5(
  memory_id UNINDEXED,
  body,
  tags
);

PRAGMA optimize;
