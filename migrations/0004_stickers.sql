-- Vesper sticker catalog. Assets live in the bound R2 bucket; this schema stores
-- only opaque resource keys and metadata, never image bytes or data URLs.
CREATE TABLE IF NOT EXISTS vesper_sticker_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, character_id, name)
);
CREATE INDEX IF NOT EXISTS idx_vesper_sticker_categories_scope
  ON vesper_sticker_categories(user_id, character_id, sort_order, name);

CREATE TABLE IF NOT EXISTS vesper_sticker_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  category_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'upload',
  source_conversation_id TEXT,
  source_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'needs_review', 'deleting', 'deleted')),
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(user_id, character_id, sha256),
  FOREIGN KEY(category_id) REFERENCES vesper_sticker_categories(id)
);
CREATE INDEX IF NOT EXISTS idx_vesper_sticker_assets_scope
  ON vesper_sticker_assets(user_id, character_id, status, favorite, last_used_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS vesper_sticker_collect_settings (
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  max_per_day INTEGER NOT NULL DEFAULT 8,
  cooldown_seconds INTEGER NOT NULL DEFAULT 120,
  min_confidence REAL NOT NULL DEFAULT 0.88,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, character_id)
);
CREATE TABLE IF NOT EXISTS vesper_sticker_collection_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  source_attachment_key TEXT NOT NULL,
  source_message_id TEXT NOT NULL,
  source_conversation_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued', 'retry', 'completed', 'ignored', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  decision_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, character_id, source_attachment_key, sha256)
);
CREATE INDEX IF NOT EXISTS idx_vesper_sticker_jobs_due
  ON vesper_sticker_collection_jobs(user_id, character_id, status, next_attempt_at);
CREATE TABLE IF NOT EXISTS vesper_sticker_agent_usage (
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  last_turn_id TEXT NOT NULL DEFAULT '',
  last_sent_at TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, character_id, conversation_id)
);
