# Vesper external MCP

This Worker exposes Vesper data to an external MCP client such as ChatGPT.
It is independent of Vesper's Settings → MCP Servers, which connects external
servers to the app-server. Do not replace that UI, its OAuth flow or `/api/mcp`.

Endpoint after deployment: `https://mcp.vesper.r-vera.com/mcp`.
Keep the existing Bearer access token and shared `vesper-db` D1 binding.

## Tools

- Notes: `list_notes`, `save_note`.
- Reminders: `list_todos`, `save_todo`, `complete_todo`.
- Diary: `list_diaries`, `get_diary`, `write_agent_diary`.
  Writing now appends by default. `mode: replace` is only for an explicitly
  requested replacement. The user's diary field is preserved. Dates use
  YYYY-MM-DD; callers should choose the date in Vera's Asia/Shanghai timezone.
- Memory library: `list_memories`, `save_memory`, using the app's existing memory
  service, scope, deduplication and core-candidate workflow. Source is
  `vesper-mcp:chatgpt` or `vesper-mcp:automation`; choose automation for wake-ups.
  `search_memory` remains the legacy search across notes/diaries/todos/dates.
- Notifications: `send_notification` sends immediately to subscribed devices.
  Saving a reminder does not itself schedule a push. Existing VAPID keys must
  match those used to subscribe the devices; don't generate replacement keys.
- Existing anniversary and music tools remain available.

## Release

Deploy only `mcp-server/wrangler.jsonc` for the MCP update, preserving secrets.
The Worker requires `VESPER_APP_TOKEN` with exactly the same secret value as the
production Vesper API to resolve its existing memory scope. Do not paste it in
chat, commit it, log it, or use the MCP Bearer token in its place. If unavailable,
only memory-library tools fail with a configuration error; existing tools work.
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are needed for Web Push.

Checks:

```
node --experimental-strip-types tools/test-mcp-diary.mjs
npx wrangler deploy --dry-run --config mcp-server/wrangler.jsonc
```

After authorized deployment, verify `/health`, authenticated initialize and
`tools/list`, then read existing notes/diary/memory through the client. Refresh
its tool catalog. Do not send test notifications or create sample private
entries without an explicit test request.

Current storage limitation: legacy document tools use read-modify-write JSON;
concurrent app/MCP writes can conflict. MCP diary writes check for changes since
read and reject a stale write; other writers still need their own concurrency
controls. Diary append is not a retry-idempotency
mechanism. The memory library retains its existing deduplication behavior.
