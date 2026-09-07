# Chat execution, files and visual updates

Scope: mini terminal, AI file delivery, task progress, project debugging from chat,
photo stacks and theme-aware frosted chrome. Home layout and splash animation are
intentionally unchanged. This is independent of external Vesper MCP (PR14) and
Settings → MCP Servers.

## What is wired

- Actual app-server item starts/completions, command output deltas, file-change
  items, turn plans, diffs and terminal turn states render collapsible records.
  Expand into a native modal dialog; output is plain text, capped to the last
  24,000 characters. No command is executed by opening a record. Raw reasoning
  and tool arguments are not displayed. Completed execution identity is stable;
  identical commands in separate items stay separate.
- Live output renders immediately, with persistence checkpoints at most once
  per second and an immediate completion flush. VPS history stores these as
  system messages with execution metadata; app-server snapshots restore items.
  On disconnect/unmount the last checkpoint can lag by up to a second; running
  cards are explicitly shown as awaiting synchronization when not live.
- Authenticated `/api/codex/events` stores per-account/per-conversation D1
  observations. `read_codex_task_progress` reads the last 30 observations for the
  invoking conversation, including time, command, output, exit/error and state.
  It cannot inspect another Codex installation or act as a live process probe.
- `send_chat_file` accepts 1–8 files with real text or base64 bytes, max 8 MiB
  each and a bounded batch. R2 stores actual bytes; same owner/name/type/content
  reuses its key on retry. The browser persists attachment metadata to the VPS
  conversation before returning tool success. A failure is reported if history
  persistence fails. No server-local path is claimed to be a download URL.
  Attachment URLs use the existing unguessable media-link access model; anyone
  receiving such a URL can read it. Non-media files download with nosniff headers.
- New/resumed conversations request the tool catalogue. Older app-server
  versions that reject resume tool updates retain their existing thread and
  show that a new conversation is needed for the new tools.
- Codex Server settings accept an optional absolute project directory on the
  app-server host. It is sent as cwd for new threads and subsequent turns.
  The existing on-request policy and server sandbox are preserved. The approval
  callback now correctly binds the current pending request.
- Multi-image attachments use one stacked gallery for either sender, swipe or
  buttons to navigate, and a full-size viewer with group thumbnails. Single
  images remain single photos. Motion respects reduced-motion preferences.
- Floating sidebar, bottom navigation, composer and connection overlays use
  theme colors with blur/translucency and highlights. Unsupported or reduced
  transparency uses opaque theme surfaces. Chat bodies remain transparent.

## Local checks

- `node --experimental-strip-types tools/test-codex-execution.mjs`
- `node tools/test-codex-artifacts.mjs`
- `npm run test:codex`
- `npm run build:pages` and `npm run build`

## Production acceptance — not yet performed

Deploy through the existing Cloudflare frontend/API workflow; preserve PR14/15
when integrating. There are no new tokens, token rotations, or VPS schema
changes. The D1 execution table is created lazily by the API.

1. Confirm the Vesper repository and dependencies exist on the app-server host;
   enter that actual path in Codex Server settings. Merely saving a path does
   not clone the repository, mount files, or grant write/network access.
2. In a Vesper conversation, ask Codex to inspect project status, perform a
   reversible scoped edit and run the relevant validation. Verify real command
   output, file diff, nonzero exit reporting, approval accept/deny, and refresh
   recovery. Read-only or missing-workspace failures must remain visible.
3. Send a text file and two small images using the new tool. Verify actual
   download bytes, names, sizes, galleries and history after refresh. Verify
   the tool reports failure on R2/history errors. Use a new chat if the deployed
   app-server does not support catalogue updates on resume.
4. Ask the AI to read task progress; compare returned observations/timestamps
   with the UI. Disconnect mid-command; stale observations must not be described
   as confirmed live execution. Confirm different accounts cannot read records.
5. On phone and desktop, test gallery touch/button/fullscreen/escape/focus,
   long filenames, theme changes, photo backgrounds, reduced motion and keyboard.

No production deployment or real VPS editing was performed in this change.
Browser verification was subsequently completed on the release Mac at 375,
390, 430 and 1280 CSS pixels. The tests cover photo backgrounds, transparent
headers and AI text, safe-area/keyboard geometry, offline draft preservation and
deleted-message suppression. Separate browser fixtures verify execution cards,
late output, deliberately reordered checkpoint persistence, stale snapshots,
gallery navigation/dialog closure, file history success/failure, approval
accept/deny and rejection of another thread's tool request. These fixtures do
not establish real production VPS editing capability.

Actual isolated Worker/D1/R2 HTTP checks verify generated text/image bytes,
idempotent file keys, download headers, authentication, monotonic observations
and conversation isolation. The installed local runtime requires a local-only
compatibility-date override to 2026-05-22; production config remains unchanged.
Completed execution checkpoints are now serialized, and late deltas/stale
running records cannot regress a completed item. Whole-repository TypeScript checking
still reports pre-existing music typing and test-extension configuration errors;
the newly added modules pass the check.

Protocol reference: https://learn.chatgpt.com/docs/app-server
