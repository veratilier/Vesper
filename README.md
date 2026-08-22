# Vesper

Vesper is a mobile-first personal companion PWA built with Next.js-compatible
App Router, Vinext, React, Cloudflare Workers, and D1.

## Entry points

- `app/page.tsx` — the home page and client UI (the framework equivalent of
  `index.html`)
- `app/layout.tsx` — document metadata, viewport, PWA manifest, and root layout
- `app/api/state/route.ts` — D1-backed application state API
- `app/api/media/route.ts` — media upload API
- `public/manifest.webmanifest` — PWA manifest
- `wrangler.production.jsonc` — direct Cloudflare Worker deployment

This is not a static HTML project. Vinext generates the browser HTML and Worker
entry files during `npm run build`, so generated `dist/` files are intentionally
excluded from Git.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Cloudflare deployment

The production Worker uses `wrangler.production.jsonc` and the D1 migration in
`migrations/0001_vesper_documents.sql`.

```bash
npm run build
npx wrangler d1 execute vesper-db --remote --file migrations/0001_vesper_documents.sql
npx wrangler deploy --config wrangler.production.jsonc
```

Production: <https://vesper.r-vera.com>
