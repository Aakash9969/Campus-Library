# College Library Chatbot — Netlify Edition

This edition is adapted to deploy on Netlify: static HTML/CSS/JS frontend, a Netlify Function API, and Netlify Blobs for persistent catalog storage. It does not need a separate Flask server.

## Deploy from GitHub

1. Push/upload this entire folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project** and select that repository.
3. Netlify build settings:
   - Build command: leave blank
   - Publish directory: `public`
   - Functions directory: `netlify/functions` (already configured in `netlify.toml`)
4. In **Site configuration → Environment variables**, add:
   - `ADMIN_PASSWORD`: choose a strong admin password
   - `SESSION_SECRET`: a long random secret string (at least 32 characters)
5. Trigger a deploy. Netlify should install `@netlify/blobs` from `package.json`.

The first API request seeds the persistent Netlify Blobs catalog with the sample books. Data is stored in a site-wide Netlify Blobs store so it persists across deployments.

## API

Static frontend files live in `public/`; the API source lives outside the publish directory in `netlify/functions/` so function source is not published as ordinary static files.

The app uses `/api/books`, `/api/categories`, `/api/chat`, `/api/admin/login`, `/api/admin/logout`, `/api/admin/session`, `/api/admin/books`, and related admin routes. These are routed directly to `netlify/functions/api.mjs`.

## Local development

Install Node.js 20+ and the Netlify CLI:
```bash
npm install
npm install -g netlify-cli
netlify dev
```
Use Netlify Dev to test functions and Blobs locally.

## Notes

- This is a keyword-matching catalog assistant, not an LLM.
- The sample catalog is illustrative; replace it with your college's actual catalog.
- Admin access is protected by environment variables and a signed HttpOnly cookie. Use a strong `ADMIN_PASSWORD` and `SESSION_SECRET`.
- Netlify Blobs is used for persistent book data; do not add a local SQLite file expecting it to persist on Netlify.
