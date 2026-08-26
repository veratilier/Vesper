#!/usr/bin/env python3
"""Authenticated SQLite history API colocated with the Vesper Codex app-server."""

from __future__ import annotations

import hmac
import json
import os
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


DB_PATH = Path(os.environ.get("VESPER_HISTORY_DB", "/home/ubuntu/.vesper/chat-history.sqlite3"))
TOKEN_PATH = Path(os.environ.get("CODEX_TOKEN_FILE", "/home/ubuntu/.codex/app-server-token"))
ALLOWED_ORIGINS = {"https://vesper.r-vera.com", "http://localhost:3000", "http://localhost:5173"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
  vesper_conversation_id TEXT PRIMARY KEY,
  codex_thread_id TEXT UNIQUE,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS conversations_updated
  ON conversations(archived_at, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  vesper_conversation_id TEXT NOT NULL REFERENCES conversations(vesper_conversation_id),
  role TEXT NOT NULL CHECK(role IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  item_id TEXT,
  turn_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS messages_item
  ON messages(vesper_conversation_id, item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_turn
  ON messages(vesper_conversation_id, turn_id);
CREATE INDEX IF NOT EXISTS messages_created
  ON messages(vesper_conversation_id, created_at, id);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.executescript(SCHEMA)
    return connection


def conversation(row: sqlite3.Row, message_count: int | None = None) -> dict:
    value = {
        "vesperConversationId": row["vesper_conversation_id"],
        "id": row["vesper_conversation_id"],
        "codexThreadId": row["codex_thread_id"],
        "title": row["title"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "archived": row["archived_at"] is not None,
        "archivedAt": row["archived_at"],
    }
    if message_count is not None:
        value["messageCount"] = message_count
    return value


def message(row: sqlite3.Row) -> dict:
    try:
        metadata = json.loads(row["metadata_json"] or "{}")
    except json.JSONDecodeError:
        metadata = {}
    return {
        "id": row["id"],
        "conversationId": row["vesper_conversation_id"],
        "role": row["role"],
        "content": row["content"],
        "status": row["status"],
        "metadata": metadata,
        "createdAt": row["created_at"],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "VesperHistory/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        # Never log query strings because the WebSocket capability token is passed there.
        print(f'{self.address_string()} {self.command} {urlparse(self.path).path} {fmt % args}')

    def origin(self) -> str | None:
        value = self.headers.get("Origin")
        return value if value in ALLOWED_ORIGINS else None

    def authenticated(self) -> bool:
        supplied = self.headers.get("Authorization", "")
        supplied = supplied[7:].strip() if supplied.startswith("Bearer ") else ""
        try:
            expected = TOKEN_PATH.read_text(encoding="utf-8").strip()
        except OSError:
            return False
        return bool(supplied and expected and hmac.compare_digest(supplied, expected))

    def send_json(self, status: int, value: object) -> None:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        origin = self.origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        if not self.origin():
            self.send_json(403, {"error": "Origin not allowed"})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.origin() or "")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def dispatch(self) -> None:
        if not self.authenticated():
            self.send_json(401, {"error": "Unauthorized"})
            return
        path = [unquote(part) for part in urlparse(self.path).path.strip("/").split("/") if part]
        if path == ["health"] and self.command == "GET":
            self.send_json(200, {"ok": True})
        elif path == ["conversations"] and self.command == "GET":
            self.list_conversations()
        elif len(path) == 2 and path[0] == "conversations":
            if self.command == "GET": self.get_conversation(path[1])
            elif self.command in {"POST", "PATCH"}: self.upsert_conversation(path[1])
            elif self.command == "DELETE": self.archive_conversation(path[1])
            else: self.send_json(405, {"error": "Method not allowed"})
        elif len(path) == 3 and path[0] == "conversations" and path[2] == "messages" and self.command == "POST":
            self.upsert_message(path[1])
        else:
            self.send_json(404, {"error": "Not found"})

    def body(self) -> dict:
        length = min(int(self.headers.get("Content-Length", "0") or 0), 1_000_000)
        value = json.loads(self.rfile.read(length) or b"{}")
        if not isinstance(value, dict):
            raise ValueError("JSON object required")
        return value

    def list_conversations(self) -> None:
        with db() as connection:
            rows = connection.execute("""SELECT c.*, COUNT(m.id) AS message_count
              FROM conversations c LEFT JOIN messages m ON m.vesper_conversation_id = c.vesper_conversation_id
              WHERE c.archived_at IS NULL GROUP BY c.vesper_conversation_id
              ORDER BY c.updated_at DESC LIMIT 100""").fetchall()
        self.send_json(200, {"conversations": [conversation(row, row["message_count"]) for row in rows]})

    def get_conversation(self, conversation_id: str) -> None:
        with db() as connection:
            row = connection.execute("SELECT * FROM conversations WHERE vesper_conversation_id = ?", (conversation_id,)).fetchone()
            messages = connection.execute("""SELECT * FROM messages WHERE vesper_conversation_id = ?
              ORDER BY created_at ASC, rowid ASC LIMIT 1000""", (conversation_id,)).fetchall()
        self.send_json(200, {"conversation": conversation(row) if row else None, "messages": [message(item) for item in messages]})

    def upsert_conversation(self, conversation_id: str) -> None:
        body = self.body()
        timestamp = now()
        title = str(body.get("title") or "新对话").strip()[:120] or "新对话"
        thread_present = "codexThreadId" in body
        thread_id = str(body.get("codexThreadId") or "").strip() or None
        with db() as connection:
            connection.execute("""INSERT INTO conversations
              (vesper_conversation_id, codex_thread_id, title, created_at, updated_at, archived_at)
              VALUES (?, ?, ?, ?, ?, NULL)
              ON CONFLICT(vesper_conversation_id) DO UPDATE SET
                codex_thread_id = CASE WHEN ? THEN excluded.codex_thread_id ELSE conversations.codex_thread_id END,
                title = CASE WHEN excluded.title <> '新对话' THEN excluded.title ELSE conversations.title END,
                updated_at = excluded.updated_at, archived_at = NULL""",
              (conversation_id, thread_id, title, timestamp, timestamp, thread_present))
            row = connection.execute("SELECT * FROM conversations WHERE vesper_conversation_id = ?", (conversation_id,)).fetchone()
        self.send_json(200, {"conversation": conversation(row)})

    def upsert_message(self, conversation_id: str) -> None:
        body = self.body()
        message_id = str(body.get("id") or "").strip()
        role = str(body.get("role") or "")
        content = str(body.get("content") or "").strip()
        if not message_id or role not in {"user", "agent", "system"} or not content or len(content) > 120_000:
            self.send_json(400, {"error": "Invalid message"})
            return
        metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
        item_id = str(metadata.get("itemId") or "").strip() or None
        turn_id = str(metadata.get("turnId") or "").strip() or None
        created_at = str(body.get("createdAt") or now())
        timestamp = now()
        status = str(body.get("status") or "delivered")[:32]
        title = str(body.get("title") or content[:42]).strip()[:120] or "新对话"
        with db() as connection:
            connection.execute("""INSERT INTO conversations
              (vesper_conversation_id, title, created_at, updated_at, archived_at)
              VALUES (?, ?, ?, ?, NULL)
              ON CONFLICT(vesper_conversation_id) DO UPDATE SET
                title = CASE WHEN conversations.title = '新对话' THEN excluded.title ELSE conversations.title END,
                updated_at = excluded.updated_at, archived_at = NULL""",
              (conversation_id, title, created_at, timestamp))
            existing = connection.execute("""SELECT id FROM messages WHERE vesper_conversation_id = ?
              AND ((? IS NOT NULL AND item_id = ?) OR id = ?) LIMIT 1""",
              (conversation_id, item_id, item_id, message_id)).fetchone()
            target_id = existing["id"] if existing else message_id
            connection.execute("""INSERT INTO messages
              (id, vesper_conversation_id, role, content, status, item_id, turn_id, metadata_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET content = excluded.content, status = excluded.status,
                item_id = COALESCE(excluded.item_id, messages.item_id),
                turn_id = COALESCE(excluded.turn_id, messages.turn_id),
                metadata_json = excluded.metadata_json, updated_at = excluded.updated_at""",
              (target_id, conversation_id, role, content, status, item_id, turn_id,
               json.dumps(metadata, ensure_ascii=False), created_at, timestamp))
            row = connection.execute("SELECT * FROM messages WHERE id = ?", (target_id,)).fetchone()
        self.send_json(200, {"message": message(row)})

    def archive_conversation(self, conversation_id: str) -> None:
        timestamp = now()
        with db() as connection:
            cursor = connection.execute("UPDATE conversations SET archived_at = ?, updated_at = ? WHERE vesper_conversation_id = ?", (timestamp, timestamp, conversation_id))
        self.send_json(200, {"ok": True, "archived": cursor.rowcount})

    do_GET = dispatch
    do_POST = dispatch
    do_PATCH = dispatch
    do_DELETE = dispatch


if __name__ == "__main__":
    with db():
        pass
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("VESPER_HISTORY_PORT", "4510"))), Handler)
    server.serve_forever()
