import assert from "node:assert/strict";
import { hasCodexChatBubbles, mergeCodexMessages } from "../app/codex-message-merge.ts";

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

const firstText = "这份夸夸哥哥收下了，也给 OAI 记一朵小红花。";
const secondText = "还有你，亲手把模型选择器接进 Vesper，让喜欢的新模型住进来，当然也得夸。";
const whole = {
  id: "reply-1", conversationId: "conversation-1", role: "agent",
  content: `${firstText}\n${secondText}`, createdAt: "2026-09-05T04:51:49.329Z",
  metadata: { itemId: "reply-1", turnId: "turn-2", threadId: "thread-1", blockType: "agentMessage" },
};
const first = { ...whole, id: "reply-1:bubble:0", content: firstText, metadata: { ...whole.metadata, showTurnStatus: true } };
const second = { ...whole, id: "reply-1:bubble:1", content: secondText, metadata: { ...whole.metadata, itemId: "reply-1:bubble:1", showTurnStatus: false } };
function assertSplit(result) {
  assert.deepEqual(result.map(m => m.content), [firstText, secondText]);
  assert.deepEqual(result.map(m => m.id), [first.id, second.id]);
  assert.deepEqual(result.map(m => m.metadata.showTurnStatus), [true, false]);
  assert.equal(result[0].createdAt, first.createdAt);
  assert.equal(result[0].metadata.itemId, whole.metadata.itemId, "retain tombstone identity");
}
// Stream completion, snapshot recovery, remote history, and local backup can
// arrive in any order. None may add the full reply or overwrite its first part.
for (const sources of [
  [[whole], [first, second]], [[first, second], [whole]],
  [[second], [whole], [first]], [[whole], [first], [second], [whole]],
]) {
  const result = mergeCodexMessages(...sources);
  assertSplit(result);
  assertSplit(mergeCodexMessages(JSON.parse(JSON.stringify(result)), [whole], [first, second]));
}
assert.equal(hasCodexChatBubbles([first], "reply-1"), true, "first bubble alone blocks snapshot aggregate");
assert.equal(hasCodexChatBubbles([second], "reply-1"), true);
assert.equal(hasCodexChatBubbles([whole], "reply-1"), false);
assert.deepEqual(mergeCodexMessages([whole], [first]).map(m => m.content), [firstText], "do not recreate a deleted later bubble");
assert.deepEqual(mergeCodexMessages([whole], [second]).map(m => m.content), [secondText], "do not recreate a deleted first bubble");
assertSplit(mergeCodexMessages([first, second], [{ ...first, content: whole.content }]));
assertSplit(mergeCodexMessages([{ ...first, content: whole.content }], [first, second]));
assert.equal(mergeCodexMessages([first, { ...second, content: firstText }]).length, 2, "equal sentences with distinct item IDs are not duplicates");
const otherReply = { ...whole, id: "different-reply", metadata: { ...whole.metadata, itemId: "different-reply" } };
const withOther = mergeCodexMessages([first, second, otherReply]);
assert.equal(withOther.length, 3, "do not hide genuine additional output blocks");
assert.equal(withOther.filter(m => m.metadata.showTurnStatus).length, 1, "status appears once per turn across output blocks");
const otherConversation = { ...whole, conversationId: "conversation-2" };
assert.equal(mergeCodexMessages([first, second, otherConversation]).length, 3, "do not deduplicate across conversations");
assert.deepEqual(mergeCodexMessages([whole]).map(m => m.content), [whole.content], "unsplit legacy replies remain intact");
const userText = { ...whole, role: "user" };
assert.equal(mergeCodexMessages([first, second, userText]).length, 3, "never remove user text");
const sticker = { ...whole, id: "sticker-1", type: "sticker", content: "[Sticker]", metadata: { ...whole.metadata, itemId: "sticker-1", blockType: "sticker", showTurnStatus: false } };
assert.equal(mergeCodexMessages([sticker, first, second]).find(m => m.id === sticker.id).metadata.showTurnStatus, false);
const frozen = JSON.stringify([whole, first, second]);
mergeCodexMessages([whole, first, second]);
assert.equal(JSON.stringify([whole, first, second]), frozen, "merge must not mutate source history");
console.log("codex message merge regression: user identity, split bubbles, replay, refresh, deletion, status and legacy compatibility: ok");
