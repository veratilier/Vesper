# Vesper OAuth and photo album release

This change extends the external Vesper MCP server. It does not change the separate feature for adding third-party MCP servers inside Vesper.

## Deployment prerequisites

- Preserve the existing release workflow and dashboard variables.
- API and MCP must share the existing D1 database and R2 bucket `vesper-media`.
- Verify MCP `VESPER_MEMORY_USER_ID` matches the paired API account, or retain the same `VESPER_APP_TOKEN` fallback as the API. Do not rotate tokens or reassign existing data.
- Provision a persistent KV namespace for MCP `OAUTH_KV`; record its real ID in the existing deployment configuration. The checked-in binding deliberately has no fabricated namespace ID. Reuse this namespace on subsequent deployments.
- Keep the `global_fetch_strictly_public` compatibility flag; the OAuth provider requires it for public CIMD discovery.
- Build and release API/frontend and MCP together through the existing Cloudflare setup. Frontend-only publication does not enable OAuth.
- OAuth authorization uses the canonical origin `https://mcp.vesper.r-vera.com`. Use `https://mcp.vesper.r-vera.com/mcp` in ChatGPT.
- No production changes or real user photo uploads were made by these local tests.

## User connection

Select OAuth in ChatGPT and use the same MCP URL. Consent asks for the existing MCP access token from Vesper settings. Enter it only in the authorization page, not in chat. Existing Bearer clients continue to work. A generated OAuth access token cannot access the legacy owner-only setup route.

The maintained Cloudflare provider supplies authorization-server/protected-resource discovery, CIMD and dynamic registration, S256 PKCE, access tokens and refresh tokens. Access lasts one hour; refresh grants last 30 days. Consent is bound to an HttpOnly cookie and a ten-minute server-side nonce, checks Origin, and restricts redirects to ChatGPT callbacks. Reconnecting the same client replaces its old grant by provider default. Master-token rotation alone does not revoke existing OAuth grants: revoke grants using provider management helpers when intentionally disconnecting a client.

## Album behavior

- Sidebar Photos opens categories, search, import, full-size preview, and category/description editing.
- New image uploads register an owner-scoped source, but are not automatically archived.
- AI explicitly calls `album_save_photo` with the photo key in a Vesper attachment. `album_search_photos` searches only saved photos. `album_send_photos` in app-server chat persists selected images using the existing chat attachment path.
- External MCP offers search/save, `album_import_photo` for actual base64 photo bytes (PNG/JPEG/GIF/WebP, up to 8 MiB), and `album_get_photos` for selected original links. The assistant can show those links in its current reply; this does not forward a message into another chat window.
- If a client cannot read the bytes of a ChatGPT attachment, it cannot import that attachment through MCP. The user can import it through Photos. Never substitute invented local paths or claim it was saved.
- Photos uploaded before this feature have no ownership source row. Re-import them explicitly to archive; do not infer ownership from a public URL.
- Repeated archive calls update the same record. File-byte retries use stable identity. No existing photos, messages or account data are deleted.
- Album listings and writes require account authentication. Original images retain Vesper's existing unguessable media-link model: anyone who receives a photo URL can open that image. This change does not introduce authenticated image downloads.
- No arbitrary remote URL fetch/import is introduced.

## Verification

Local checks: actual provider code with in-memory KV covers discovery, CIMD, owner consent, invalid token/CSRF/origin/callback rejection, public PKCE requirement, code exchange, protected API, refresh, and replay rejection. Actual SQLite queries cover owner isolation, selective archive, stable IDs, escaped search and pagination.

Run:

```sh
node tools/test-mcp-oauth.mjs
node tools/test-photo-album.mjs
node tools/test-codex-artifacts.mjs
node tools/test-codex-attachment-input.mjs
npm run test:codex
npm run build:pages
npm run build
npx wrangler deploy --dry-run --config mcp-server/wrangler.jsonc
```

The OAuth test mocks the public CIMD document and KV rather than contacting ChatGPT or Cloudflare. Real ChatGPT consent, cross-origin image display and mobile layout require production/device verification. Repository-wide tsc still reports pre-existing music typing and test import-extension errors.

After deployment verify both well-known documents, complete ChatGPT OAuth consent, list tools, archive one synthetic test photo, search/select it and confirm the intended chat displays it. Verify API/MCP owner identity before any real archive operation. Record actual results; do not report dry-run as deployed.
