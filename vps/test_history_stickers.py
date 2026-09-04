"""Small migration/serialization regression test for VPS sticker history."""
import importlib.util
import os
import tempfile
from pathlib import Path

module_path = Path(__file__).with_name("codex_history_server.py")
spec = importlib.util.spec_from_file_location("vesper_history", module_path)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory() as directory:
    module.DB_PATH = Path(directory) / "history.sqlite3"
    with module.db() as connection:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(messages)")}
        assert "message_type" in columns
        connection.execute("INSERT INTO conversations(vesper_conversation_id,title,created_at,updated_at,source) VALUES(?,?,?,?,?)", ("chat", "chat", module.now(), module.now(), "codex"))
        connection.execute("INSERT INTO messages(id,vesper_conversation_id,role,content,status,metadata_json,created_at,updated_at,source,time_source,message_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)", ("sticker-1", "chat", "user", "", "delivered", '{"sticker":{"assetId":"asset","url":"https://example.test/sticker","mimeType":"image/png"}}', module.now(), module.now(), "codex", "message", "sticker"))
        row = connection.execute("SELECT * FROM messages WHERE id='sticker-1'").fetchone()
        assert module.message(row)["type"] == "sticker"
        assert module.message(row)["metadata"]["sticker"]["assetId"] == "asset"
print("VPS sticker history tests passed")
