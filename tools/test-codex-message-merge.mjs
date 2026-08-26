import assert from "node:assert/strict";
import { mergeCodexMessages } from "../app/codex-message-merge.ts";

const local = {
  id: "local-user-id",
  conversationId: "conversation-1",
  role: "user",
  content: "same user message",
  createdAt: "2026-08-25T01:02:03.000Z",
  metadata: { turnId: "turn-1", turnStatus: "completed" },
};
const snapshot = {
  id: "snapshot-item-id",
  conversationId: "conversation-1",
  role: "user",
  content: "same user message",
  createdAt: "2026-08-26T09:00:00.000Z",
  metadata: { turnId: "turn-1", itemId: "item-1", blockType: "userMessage" },
};
const laterByItemId = {
  ...snapshot,
  id: "another-snapshot-id",
  metadata: { ...snapshot.metadata, restored: true },
};

const merged = mergeCodexMessages([local], [snapshot], [laterByItemId]);
assert.equal(merged.length, 1, "thread snapshot must not duplicate the cached user message");
assert.equal(merged[0].id, local.id, "the original local/backend identity must remain stable");
assert.equal(merged[0].createdAt, local.createdAt, "the original timestamp must remain stable");
assert.equal(merged[0].metadata.itemId, "item-1", "snapshot itemId must be backfilled");
assert.equal(merged[0].metadata.restored, true, "later itemId matches must update the same record");

console.log("codex message merge regression: ok");
