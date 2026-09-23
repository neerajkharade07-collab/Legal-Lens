# Legal Lens — deployment

One Vercel project serves everything from this folder:

| URL | What |
|---|---|
| `/` , `/*.html` | Main Legal Lens website (unchanged static pages) |
| `/legal-drafting/` | Legal Drafting Assistant **V2** (React app in `legal-drafting-app/`) |
| `/api/*` | Proxied to your Legal Lens backend (`LEGAL_LENS_API_ORIGIN`) |

Features → Legal Drafting Assistance → **Explore** opens `/legal-drafting/`
(`LEGAL_DRAFTING_APP_URL` in `config.js`). "Legal Lens home" in the app returns to `/`.

## Vercel

- **Root Directory:** this folder (the one containing `vercel.json`).
- Framework preset: **Other** (already set in `vercel.json`); build/install
  commands come from `vercel.json` — leave them empty in the dashboard.
- **Environment variable (required):**
  `LEGAL_LENS_API_ORIGIN` = public URL of the backend, e.g.
  `https://legal-lens-api.onrender.com` (no `/api`, not a secret).

The backend (Express + MongoDB, `legal-lens-backend/backend`) is deployed
separately (Render, Railway, …). In the **backend's** environment set:

- `CLIENT_URL` = your Vercel URL, e.g. `https://legal-lens.vercel.app`
  (comma-separate several, e.g. production + preview domain)
- `COOKIE_SECURE=true`
- `NODE_ENV=production`
- plus its existing `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `OPENAI_API_KEY` (secrets stay on the backend only).

## Local

```bash
# backend (other terminal): cd legal-lens-backend/backend && npm run dev   → :5000
npm install --prefix legal-drafting-app
npm run build        # builds the app + assembles the site into .vercel/output
npm start            # http://localhost:4173  (same routing as Vercel, /api → localhost:5000)
```

Working on the drafting app only: `npm run dev:drafting` →
http://localhost:5173/legal-drafting/ (proxies /api to localhost:5000). Main
pages opened with VS Code Live Server (port 5500) link to that dev server
automatically (see `config.js`).
