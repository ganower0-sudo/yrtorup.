# YRTORUP — Cloudflare Workers starter

This package contains the adapted server code. It does not include the website's HTML/assets yet.

## Before deploying
1. Keep the existing GitHub repository and Render deployment unchanged.
2. Create a folder named `site` beside `wrangler.toml`.
3. Copy the CURRENT `index.html` from the GitHub repository into `site/index.html`.
4. Copy the repository's `public` and `case-art` folders into `site/` if they contain files used by the page.
5. Copy root-level public assets referenced by `index.html` (for example favicon files) into `site/`.
6. Do not copy `server.js`, `.env`, passwords, API keys, or other server-only files into `site/`.

## Deploy
Cloudflare Workers & Pages -> Create application -> Workers -> Import repository.
Use the repository root as the project root. Build command: leave empty. Deploy command: `npx wrangler deploy`.
The included `wrangler.toml` configures static assets from `./site`.

The Worker preserves these routes:
- `/api/prices/RUB.json`
- `/api/skin-image?name=...`
- `/health`

The price/image caches are in Worker memory and may reset when Cloudflare replaces an isolate. For a production-grade shared persistent cache, add a Cloudflare KV namespace later.

## Important
This is an initial port of the supplied Express `server.js`. It must be tested after deployment against the actual current site and its external APIs. Do not delete or disable Render until the Cloudflare version has passed those tests.
