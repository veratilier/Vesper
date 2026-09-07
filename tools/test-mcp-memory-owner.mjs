import assert from "node:assert/strict";
import { pinnedMemoryOwner } from "../mcp-server/src/memory-owner.ts";
assert.equal(pinnedMemoryOwner(undefined), undefined);
const owner = "usr_" + "a".repeat(32);
assert.equal(pinnedMemoryOwner(` ${owner} `), owner);
for (const invalid of ["", " ", "other-account", "usr_123", owner + "x", "usr_" + "z".repeat(32)]) {
  assert.throws(() => pinnedMemoryOwner(invalid), /VESPER_MEMORY_USER_ID/);
}
console.log("PASS pinned MCP owner: explicit validated account, missing fallback, invalid fails closed");
