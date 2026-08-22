CREATE TABLE IF NOT EXISTS vesper_documents (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vesper_documents_updated_at
ON vesper_documents(updated_at);

PRAGMA optimize;
