# Chat model selector

The composer exposes the model and reasoning effort of its Codex thread. It does
not change the model picker in the separate ChatGPT website or mobile app.

Protocol verified using `codex-cli 0.149.0` on the existing VPS and its generated
TypeScript bindings (`ModelListResponse`, `ThreadResumeResponse`, `TurnStartParams`).

- After initialization, and whenever the picker opens, fetch all `model/list`
  pages with `includeHidden: false`. Only server-returned model/effort pairs are
  selectable. No model IDs are embedded in production code.
- `thread/start` and `thread/resume` responses provide `model` and
  `reasoningEffort`, including after reconnecting or opening a persisted thread
  on another device. No frontend default is claimed as the active model.
- A user's selection is pending until the next `turn/start`. Send `model` and
  **`effort`** (not `reasoningEffort`) alongside the unchanged thread ID, input,
  original user-message ID and other turn fields. Commit the display only after
  the RPC succeeds; a failure retains the pending choice for correction/retry.
- Before a selection is sent it is only a draft in this mounted chat. Once sent,
  app-server owns the sticky thread settings; no browser-local model preference
  overrides a restored server thread.
- Changing a model preserves a supported effort or falls back to that model's
  advertised default. A removed model or unsupported effort fails closed.
- Catalog requests time out after 15 seconds. Disconnect rejects pending RPCs;
  selection cannot submit offline or while an answer is running.
- The picker is a native modal dialog in the viewport top layer with focus
  containment, Escape dismissal, scrollable content and bottom safe-area padding.

No database migration, model API key, new route, or history rewrite is required.
Run `npm run test:codex` for model selection plus existing history, approval and
sticker regressions, and `npm run build` for the production build.

## Verification (2026-09-05)

- The VPS returned six visible models with per-model effort options.
- An isolated test thread started on `gpt-5.4-mini` / `low`, then completed a
  turn on `gpt-5.6-luna` / `low`. Both an immediate resume and a resume in a new
  app-server process returned `gpt-5.6-luna` / `low`. The test thread was removed.
- All `test:codex` regressions and the production build passed. New selector
  files passed ESLint. Full-project TypeScript checking remains blocked by
  existing music typing, approval callback and older test import errors.
- The existing local app preview was opened in Codex's in-app browser. This is
  not a claim of physical iPhone/PWA acceptance testing.
