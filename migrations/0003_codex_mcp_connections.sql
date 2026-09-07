CREATE TABLE IF NOT EXISTS vesper_mcp_connections (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  auth_mode TEXT NOT NULL CHECK(auth_mode IN ('none', 'oauth', 'bearer')),
  token_ciphertext TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  tool_catalog TEXT NOT NULL DEFAULT '[]',
  last_tested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_vesper_mcp_connections_scope
ON vesper_mcp_connections(user_id, enabled, updated_at DESC);
