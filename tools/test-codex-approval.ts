import assert from "node:assert/strict";
import {
  approvalResultFor,
  clearCodexApprovals,
  createCodexApprovalRequest,
  queueCodexApproval,
  type PendingCodexApproval,
} from "../lib/codex-approval.ts";

const command = createCodexApprovalRequest({
  id: 41,
  method: "item/commandExecution/requestApproval",
  params: { itemId: "item-command", threadId: "thread-1", turnId: "turn-1", command: "git commit -m approval", cwd: "/repo" },
});
assert.ok(command, "command approval should be recognized");
assert.deepEqual(approvalResultFor(command, "allow"), { decision: "accept" }, "one-time command allow must use accept");

const file = createCodexApprovalRequest({
  id: "file-rpc",
  method: "item/fileChange/requestApproval",
  params: { itemId: "item-file", threadId: "thread-1", turnId: "turn-1", grantRoot: "/repo", reason: "Update the README" },
});
assert.ok(file, "file approval should be recognized");
assert.deepEqual(approvalResultFor(file, "deny"), { decision: "decline" }, "file deny must use decline");

const permissions = createCodexApprovalRequest({
  id: 42,
  method: "item/permissions/requestApproval",
  params: { itemId: "item-permissions", threadId: "thread-1", turnId: "turn-2", cwd: "/repo", permissions: { network: { enabled: true } } },
});
assert.ok(permissions, "permissions approval should be recognized");
assert.deepEqual(approvalResultFor(permissions, "allow"), { permissions: { network: { enabled: true } }, scope: "turn" }, "permissions allow must grant only this turn");
assert.deepEqual(approvalResultFor(permissions, "deny"), { permissions: {}, scope: "turn" }, "permissions deny must return an empty grant");

const duplicate = createCodexApprovalRequest({
  id: 43,
  method: "item/commandExecution/requestApproval",
  params: { itemId: "item-command", threadId: "thread-1", turnId: "turn-1", command: "git commit -m approval", cwd: "/repo" },
});
assert.ok(duplicate, "duplicate approval should be recognized");
const queued = queueCodexApproval([command], duplicate);
assert.equal(queued.length, 1, "duplicate server requests must use one user prompt");
assert.deepEqual(queued[0].rpcIds, [41, 43], "one user choice must reply to each duplicate RPC id");

const disconnected = clearCodexApprovals(queued as PendingCodexApproval[]);
assert.deepEqual(disconnected, [], "disconnect must clear pending approval UI without deciding for the user");

console.log("codex approval regression: allow, deny, duplicate, and disconnect flows: ok");
