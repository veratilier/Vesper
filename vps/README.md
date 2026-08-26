# Vesper Codex history service

The static PWA reads and writes Codex conversation history through
`https://codex.r-vera.com/history`. The service runs beside `codex app-server`
on the Vesper VPS and authenticates the same bearer capability token.

Persistent data lives at `/home/ubuntu/.vesper/chat-history.sqlite3`. The
`conversations` table owns the Vesper-to-Codex mapping, title, timestamps, and
archive state. The `messages` table stores user and final agent messages with
their original timestamps and explicit `item_id` / `turn_id` columns for
idempotent snapshot merging.

Runtime files:

- `codex_history_server.py`: loopback-only HTTP/SQLite service on port 4510.
- `vesper-codex-history.service`: systemd unit.
- `nginx-codex-history.conf`: `/history/` reverse-proxy location for the
  existing authenticated `codex.r-vera.com` tunnel.
