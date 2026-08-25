# Vesper

Vesper is a mobile-first personal companion PWA. `main` is the source of truth:
Cloudflare serves the built app and API directly on `vesper.r-vera.com`; there is
no Sites intermediary.

## Entry points

- `static-index.html` / `static-entry.tsx` — GitHub Pages entry point
- `app/page.tsx` — the shared React UI
- `app/api/state/route.ts` — D1-backed application state API
- `app/api/media/route.ts` — media upload API
- `public/manifest.webmanifest` — PWA manifest
- `app/api/codex/route.ts` — authenticated WebSocket proxy for the VPS Codex app-server
- `wrangler.production.jsonc` — API Worker deployment

`npm run build` produces the Cloudflare Worker and client assets in `dist/`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run build:pages
```

## Deployment

Push `main` (or run the commands below) to update the live domain directly:

```bash
npm run build
npx wrangler d1 execute vesper-db --remote --file migrations/0001_vesper_documents.sql
npx wrangler deploy --config wrangler.production.jsonc --keep-vars
```

PWA: <https://vesper.r-vera.com>

API: <https://api.vesper.r-vera.com>

## One Codex app-server connection

The chat client uses the official bidirectional JSON-RPC app-server protocol.
It does not ask for an API key, MCP URL, CyberBoss endpoint, or provider
selector. Run Codex on the VPS and keep its ChatGPT login there:

```bash
codex login --device-auth
codex app-server --listen ws://127.0.0.1:4500
```

Put the public `wss://…` URL in Vesper → Settings → Codex Server. If the VPS
is behind the Vesper Worker, set these Worker secrets instead and leave the URL
blank in the app:

```bash
npx wrangler secret put CODEX_APP_SERVER_URL --config wrangler.production.jsonc
npx wrangler secret put CODEX_APP_SERVER_TOKEN --config wrangler.production.jsonc
```

The browser advertises two safe Vesper dynamic tools (`read_vesper_state` and
`write_vesper_state`). Codex calls them with `item/tool/call`; Vesper executes
them locally and returns `inputText` content to the same app-server turn.
Images and audio are sent as inline data URLs, videos contribute a representative
frame, and text/JSON/HTML files are included as text. Other files are uploaded
to the existing media bucket and shown in the transcript.
