# Vesper

Vesper is a mobile-first personal companion PWA. Its production setup mirrors
Rune: GitHub Pages serves the static PWA, while a Cloudflare Worker and D1
provide the data API.

## Entry points

- `static-index.html` / `static-entry.tsx` — GitHub Pages entry point
- `app/page.tsx` — the shared React UI
- `app/api/state/route.ts` — D1-backed application state API
- `app/api/media/route.ts` — media upload API
- `public/manifest.webmanifest` — PWA manifest
- `.github/workflows/deploy-pages.yml` — automatic Pages deployment
- `wrangler.production.jsonc` — API Worker deployment

The UI has two build targets. `npm run build:pages` produces the static site in
`github-pages-spa/`; `npm run build` produces the API Worker in `dist/`.

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

Pushing `main` deploys the PWA to GitHub Pages. The API is deployed separately:

```bash
npm run build
npx wrangler d1 execute vesper-db --remote --file migrations/0001_vesper_documents.sql
npx wrangler deploy --config wrangler.production.jsonc
```

PWA: <https://vesper.r-vera.com>

API: <https://api.vesper.r-vera.com>
