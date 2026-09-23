# Legal Lens — SIH demo build notes

- Public site: no customer login. Homepage, AI Legal Guidance and Legal Drafting open signed out.
- Legal Drafting runs in **Guest / Demo Mode** (default): no sign-in gate, drafts and versions are
  saved only in the visitor's browser (localStorage). AI draft generation is disabled and labelled.
  Build with `VITE_DRAFTING_REQUIRE_AUTH=true` to restore the signed-in, backend-saved flow
  (AuthGate / SignInPanel are still in the source).
- AI Legal Guidance calls `/api/guidance/chat` (same origin). If the backend/AI is unavailable it shows
  clearly labelled "Demo Mode" sample guidance for the four suggested topics only.
- Lawyer Connect: lawyer Login/Signup use the real backend (`/api/auth/lawyer/*`, `auth.js`).
  The lawyer directory, dashboard profile data and consultation requests are browser-local demo data
  and are labelled as such; requests are NOT sent to lawyers.
- `legal-drafting-app/dist` and `.vercel/output` are intentionally not included: they are rebuilt by
  `npm run build` (Vercel does this automatically).
