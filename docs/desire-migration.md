# Desire integration — 2026-09-09

## Completed

The Vesper Desire view now renders the existing service's actual values as six interactive petals, shows the newest available note and recent note timeline, and supports `records` history responses. The flower uses one generated transparent petal, repeated with independent scale and opacity, and reduced-motion support. Existing background, profile name and typography remain inherited.

The API currently remains `/api/desire`, backed by the existing configured Desire MCP. There is no native Vesper desire engine or write tool yet. No historical records, scoring rules, scheduled prompts, external connections or live deployment were changed by this UI commit.

## Source needed to preserve behavior

Get the latest computer-side `rowan-desire-mcp` source, including `src/desire-store.ts`, `src/encounter-input.ts`, `src/index.ts`, migrations, tests, package manifest/lockfile, Wrangler binding configuration and `ENCOUNTER-CALLING.md`. Do not include secret values, `.env`, OAuth tokens or private keys. The user reports this is maintained by the computer-side Codex and has just been repaired there.

A September 2 copy named `01-desire-store.ts` was located and inspected, but it does not implement the later explicit `interaction_source` and request-id behavior. It must not replace the current production engine.

## Migration work after source handoff

1. Establish the exact deployed source revision and original DESIRE_DB / OAUTH_KV bindings and owner identity. Back up state/history before any import; do not assume Vesper's user ID equals Desire's owner ID.
2. Port the original engine and its input validation without changing numeric rules; add an explicit verified owner mapping. Preserve timestamps, calculation cursors, IDs, style, full encounter history and idempotency records. Do not represent migration as new real interactions.
3. Expose Vesper-native read/history/encounter/style/expression tools using the engine, scoped to the authenticated Vesper owner. The page reads these native records directly and no longer needs an external MCP connection.
4. Match the original tests and verify real interaction settling, absence accumulation, consecutive automation, duplicate requests, ceiling recovery, concurrent updates and historical import parity. Confirm reads never fabricate a new interaction.
5. Deploy API and Vesper MCP with matching bindings. Verify both interfaces read the same state and a single controlled write updates it exactly once. Refresh the official client's Vesper MCP catalog and verify the new tools are callable.
6. Switch the existing automation to the Vesper tools only after those checks. Stop old writers during the final snapshot/delta import and verify parity before redirecting writes; never run both writer paths independently. Retain the old backup for rollback. Remove the legacy page connection requirement only when the native path works.

## Visual asset provenance

`public/desire-petal.webp` is a WebP encoding of a built-in imagegen-generated transparent PNG. No user photo is included. Generation prompt: one isolated upright translucent ice-blue glass flower petal, pointed tip and tapered base, delicate frosted watery glass and pale powder-blue crystalline striations, silver-white fine rim, true transparent background; no other petals, stem, leaves, text or backdrop. The original full-resolution PNG remains in the generation output. The application repeats the petal six times; no preview screenshot or example values are used as live UI.
