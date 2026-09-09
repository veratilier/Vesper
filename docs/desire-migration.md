# Native Desire integration — 2026-09-09

## Implemented, not yet deployed

The uploaded `Archive.zip` contains the September 7 repaired Desire source and its deployment report. `lib/desire/desire-store.ts` and `encounter-input.ts` are copied unchanged. The service keeps its exact scoring, real-interaction provenance, timestamp cursors, transactional state/history writes and SHA-256 request IDs. Its only service change is an injectable post-commit notification transport. The old push module has a typed ArrayBuffer copy for Vesper's TypeScript version.

Vesper's `/api/desire`, five built-in Codex tools and five official MCP tools now share `executeDesire`: `desire_status`, `desire_history`, `desire_encounter`, `desire_set_style`, `desire_express`. Existing Vesper device authentication / owner-only OAuth applies. Built-in tool calls additionally verify the paired owner's memory scope. No caller may choose the Desire owner. Tool metadata retains required `interaction_source` and `request_id`; the service validates again. The Codex catalog version is bumped so existing sessions refresh it.

The flower UI reads the native endpoint and no longer opens a separate MCP connection. Existing background, profile name and typography remain inherited. Historical `eventAt` is displayed correctly. Only nonblank notes appear in the recent timeline; blank-note events remain in full history. There is no mass deletion or rewriting of historical notes.

## Preserve the original database in place

Both production Worker configs bind **the same existing** `rowan-desire` D1 database (`1668aebc-78ca-4793-aa9f-3029a737f1e7`) as `DESIRE_DB`. The original source's owner check fixes the owner to `veratilier`. This deliberately does not translate the owner to Vesper's `usr_…` memory identifier.

The original KV (`48be10d0a1504a52bdd5ff48442b799c`) is available as `DESIRE_LEGACY_KV`; Vesper MCP's own `OAUTH_KV` stays unchanged. Native reads/writes first require the existing owner row and fail closed if bindings or the row are missing. They never initialize a substitute signal. No SQL migration, data import, deletion, or new production encounter was performed here. The SQL under tests is only an isolated fixture, not a Vesper deployment migration.

New native encounters notify **Vesper's** existing subscriptions using its VAPID configuration. The old PWA subscriptions and keys are not overwritten or used. Retried encounters skip notification as well as scoring. Notification clicks open Vesper Desire, using a service-worker message for an already open window so playback/conversations are not reloaded. Missing push configuration does not roll back a saved encounter.

## Verification

Verified locally: **33/33 tests pass**, production web build succeeds, and MCP Worker dry-run bundles successfully. Full TypeScript check reports only the five pre-existing diagnostics described below.

`npm run test:desire` runs the original relevant engine/service/notification/history regressions plus native cutover tests against isolated SQLite. Coverage includes old-request replay through Vesper, no default seeding, read-only status/history, required provenance, same-ID concurrency, absence accumulation, real user return, verbatim notes, style/expression behavior and native notification routing. Legacy renderer fixtures are retained only for original regressions.

`npm run build` and the MCP Worker dry-run must pass. Full `npx tsc --noEmit` has pre-existing music union/callback errors in `app/page.tsx` and TS5097 imports in `tools/test-codex-approval.ts` and `tools/test-stickers.ts`; no new Desire errors are acceptable.

## Production cutover: deployment-side Codex

This workspace has no Cloudflare API credentials. No production deployment, database query or official Vesper MCP call has been verified. The existing automation is intentionally still on the old service until the new tools are deployed and callable.

1. Pull the release commit from `sites-release-ca9c513`. Using existing local Cloudflare access, verify the original database and its `veratilier` row, back up that existing D1, and compare current state/history with the old read-only MCP. Check all original migrations are already applied, as the uploaded September 7 deployment report states. Do not apply test migrations to Vesper DB or initialize another row.
2. Preserve dashboard variables; deploy existing workers only:
   ```sh
   npm ci
   npm run test:desire
   npm run build
   npx wrangler deploy --config mcp-server/wrangler.jsonc --keep-vars
   npx wrangler deploy --config wrangler.production.jsonc --keep-vars
   ```
   Verify both use the original `DESIRE_DB` and separate `DESIRE_LEGACY_KV`. Vesper's normal VAPID secrets/subscriptions must be available for notifications. Do not copy Desire's VAPID pair over Vesper's pair.
3. Check unauthenticated access is rejected, authenticated native status/history match the old service, API tool catalog contains all five tools, production assets include the flower, and official Vesper MCP lists/calls `desire_status` and `desire_history`. Existing ChatGPT connection metadata may need refreshing. Validate an invalid encounter is rejected without changes; do not fabricate a real interaction just to test writes.
4. Only after those read/metadata checks, update the existing hourly task `6a892bcbede4819186cfbe157bf852fc` in place to call **Vesper's** Desire tools. Keep its schedule and other instructions. Routine activity/tool execution belongs in Atlas; Desire notes only contain a new relationship observation, otherwise omit note. Only a genuinely new Vera message permits `interaction_source=user`; autonomous runs use `automation`. Reuse one stable `request_id` across retries. `desire_express(mode=record)` records an expression without re-sending it.
5. Verify the next genuine encounter through Vesper produces exactly one original-history event, updates expected values and leaves the real-interaction clock unchanged for automation. Stop referring callers to the old Desire MCP. Keep its deployment/data intact for rollback; do not run duplicate events through old and new tool connections with different request IDs.

Rollback deploys the previous API/MCP versions and restores the old task tool selection. The shared schema/data were not rewritten, so no reverse data import is needed. Avoid rolling back to pre-September-7 engine code.

## Visual asset provenance

`public/desire-petal.webp` is the WebP encoding of the generated transparent ice-blue petal. The UI repeats it six times with independent scale/opacity and reduced-motion support. No mock values or preview screenshot are used as live data.
