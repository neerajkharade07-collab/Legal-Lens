# Legal Lens / CaseZen: final changes and test report (release candidate)

The two ZIPs contain every file that differs from the project you originally uploaded:
the Phase 1 work, the Hero feature and this final review. You can copy them over your
original project.

**Status: release candidate, not "production-ready".**
- **Done here:** all automated tests below pass, with a mocked AI and a
  MongoDB-compatible test database.
- **Still needs real-world testing:**
  - real Gemini answers;
  - real image/scan reading;
  - a real microphone;
  - MongoDB Atlas;
  - your deployment;
  - a legal-content review by a qualified person.

---

## 1. What this final review fixed and added

### 1.1 Lawyer Connect now uses the real database (high priority)

**What was wrong:**
- Find a Lawyer, the lawyer profile page and the lawyer dashboard all read browser
  demo data.
- A real registered lawyer could never fill in a profile that customers or AI
  Legal Guidance could see.

**Directory and profiles:**
- `lawyer-data.js` now calls the backend:
  - `GET /api/lawyers`
  - `GET /api/lawyers/:id`
  - `GET /api/lawyers/:id/similar`
  - the lawyer's own `GET /api/lawyer/profile`
  - `PUT /api/lawyers/me`
  - `PUT /api/lawyer/availability`
- The page design, search, filters, sorting and navigation are unchanged.
- The location filter now also matches "Kothrud, Pune" for Pune.

**Public visibility:**
- Only lawyers who are **verified by an admin and published** appear in the
  directory, on profile pages, in "similar lawyers" and in AI suggestions.
- Pending, not approved, hidden, missing or malformed IDs show "This lawyer profile is
  not available".
- If the server can't be reached, the page says "Couldn't load".

**Nothing invented:**
- Lawyers without a rating show **"New"** (there is no review system); there is no
  "0.0 ★".
- A fee of 0 shows **"Fee not listed"**.
- Public data no longer contains the lawyer's **email**.

**Lawyer dashboard:**
- It now requires a **lawyer login**.
- It edits the lawyer's **real** profile and availability.
- It shows the verification status: pending, verified or not approved, and what each
  means.
- "Register as a Lawyer" now opens the real signup page.

**Admin controls (new):**
- `POST /api/auth/admin/login`.
- `GET /api/admin/lawyers?status=pending|verified|rejected|all&search=`.
- `PATCH /api/admin/lawyers/:id/verify`, `/reject` and `/publish`, with an optional
  review note.
- A new page, **`admin-lawyers.html`**: login, status tabs, search, Verify, Not
  approve, Publish/Hide.
- Admin accounts are created **only on the server** with
  `node scripts/create-admin.js`. There is no public admin signup, and the password is
  asked for with hidden input.

**Security rules:**
- A lawyer can never set their own verification, publication, rating or review fields
  (they get 422).
- If a verified lawyer **changes their name or bar number**, the profile returns to
  pending and disappears from public view until it is verified again.

**AI suggestion → profile:** each suggested lawyer card has **View profile**, which
opens `lawyer-profile.html?id=<real id>`.

**XSS:** lawyer-entered text is escaped everywhere it was put into HTML, on the
directory, profile and dashboard pages.

### 1.2 Persistent case history (high priority)

- **New model `GuidanceConversation`:**
  - owner, title, messages (question, reply, reply type, attached file names, lawyer
    suggestion IDs), document references, and the currently attached documents.
- **New routes, customers only, owner-scoped:**
  - `GET /api/guidance/conversations` returns titles only, no message text.
  - `GET /api/guidance/conversations/:id`
  - `DELETE /api/guidance/conversations/:id` also deletes the documents uploaded in
    that conversation.
- **Saving through `POST /api/guidance/chat`:**
  - `newConversation: true` creates a saved conversation.
  - `conversationId` continues one. The history is then **loaded from MongoDB, and any
    history sent by the browser is ignored**, so it can't be forged.
  - Requests without either field work exactly as before: nothing is saved, and the
    API stays compatible.
- **Interface:**
  - "New conversation" and **"Saved conversations"** buttons.
  - The list also appears on the home screen.
  - Open; delete with an in-page confirmation (no browser pop-up).
  - **After a page refresh, the open conversation comes back.** Only its ID is kept in
    sessionStorage, never the text.
- **Documents:**
  - Reopening restores the still-available documents.
  - Expired or deleted ones are listed by name as "No longer available".
- **Lawyer suggestions** are stored as IDs. When a conversation is reopened, current
  details are loaded and only lawyers who are **still** verified and published are
  shown.
- **Limits** (configurable):
  - 100 saved conversations per customer;
  - 200 messages per conversation;
  - when a limit is reached the user gets a clear message, and nothing is silently
    deleted.
- **Long conversations:** older AI replies are left out of what the model sees, but
  **the user's own earlier words are kept in a shortened summary**, so case facts are
  not silently lost. The opening message is always kept.
- **Retention** (explained in the interface):
  - **Conversations:** until the customer deletes them, or after 365 days without
    activity.
  - **Documents:** 7 days after upload.
- **Access:** lawyers and admins have **no access** to customer conversations (403).
  Other customers get 404.

### 1.3 Document upload review

- **PDF reading moved to a worker thread** with its own memory limit (256 MB) and a
  hard timeout (25 s). A hostile or very complex PDF can no longer block the server,
  and on timeout the worker is really stopped.
- **Gemini "blocked" responses** (`promptFeedback.blockReason`, or `finishReason`
  SAFETY / PROHIBITED_CONTENT / …):
  - These are now detected.
  - For chat, the user gets a clear "please rephrase" (422) instead of a generic error.
  - For document reading, they get a clear "could not read" message.
- **Gemini configuration errors** (400, 403 or 404, for example a wrong key or model
  name) now show "temporarily unavailable" (503) and are logged with their status.
- **Earlier review fixes kept:**
  - the DOCX reader works in linear time and is protected against zip bombs;
  - header lines are only read at the top of a reply;
  - documents are owner-checked;
  - text inside a document can't escape its data block.

### 1.4 Node.js and dependencies

- `package.json` `engines.node` is now **`>=22.13.0`**, which pdfjs-dist 5.7.284
  requires.
- `.nvmrc` was added with the value `22`.
- **Optional dependency check (by reading the package files only):** pdfjs-dist's
  optional `@napi-rs/canvas` ships prebuilt binaries for **win32-x64** and
  **linux-x64**.
- **No other new dependencies.** DOCX reading uses Node's built-in zlib.

### 1.5 Voice

- **Behaviour reviewed and re-tested with a simulated speech API:**
  - permission denied, unsupported browser, language switching, and Stop/review;
  - the speech is never sent automatically.
- **Android Chrome:** one phrase per tap (continuous mode repeats words on Android).

### 1.6 Gemini request format (checked against the official docs)

- Model `gemini-3.5-flash-lite` exists, is stable, and accepts text, images and PDF
  ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)).
- `systemInstruction`, `contents` / `parts`, `inlineData` and the block reasons match
  the [generateContent reference](https://ai.google.dev/api/generate-content).
- Reasoning ("thought") parts are filtered out.

---

## 2. Complete list of changed files (compared with your original upload)

### Backend: `LegalLens-Backend-RELEASE-CANDIDATE.zip`

| File | Status | Phase |
|---|---|---|
| `controllers/guidanceController.js` | changed | P1, Hero, Final (saved conversations, error mapping) |
| `controllers/guidanceConversationController.js` | **new** | Final |
| `controllers/guidanceDocumentController.js` | **new** | Hero, Final |
| `controllers/lawyerController.js` | changed | Final (public filter, regex escaping, admin review, re-verification) |
| `controllers/authController.js` | changed | Final (admin login) |
| `models/GuidanceConversation.js` | **new** | Final |
| `models/GuidanceDocument.js` | **new** | Hero |
| `models/Lawyer.js` | changed | Final (verifiedAt / verifiedBy / reviewNote, public and admin shapes) |
| `routes/guidanceRoutes.js` | changed | Hero, Final |
| `routes/adminRoutes.js` | changed | Final |
| `routes/authRoutes.js` | changed | Final |
| `validators/lawyerValidator.js` | changed | Final |
| `services/legalGuidanceService.js` | changed | P1, Hero, Final |
| `services/geminiGuidanceClient.js` | changed | P1, Hero, Final (blocked responses) |
| `services/documentTextExtractor.js` | **new** | Hero, Final (worker thread) |
| `services/pdfExtractWorker.js` | **new** | Final |
| `services/lawyerRecommendationService.js` | **new** | Hero |
| `scripts/create-admin.js` | **new** | Final |
| `scripts/guidance-eval.js` | changed | P1, Hero |
| `package.json` | changed | Hero (pdfjs-dist), Final (engines) |
| `.nvmrc` | **new** | Final |
| `.env.example` | changed | names and defaults only, no secrets |
| `tests/guidance.test.js` | changed | 25 tests |
| `tests/guidanceHero.test.js` | **new** | 24 tests |
| `tests/guidanceConversations.test.js` | **new** | 9 tests |
| `tests/lawyerConnect.test.js` | **new** | 7 tests |
| `tests/regressionSmoke.test.js` | **new** | 6 tests |
| `tests/geminiGuidanceClient.test.js` | changed | 8 tests |
| `tests/fixtures/*` (4 files) | **new** | small **fictional** sample PDF, DOCX and TXT files |

### Frontend: `LegalLens-Frontend-RELEASE-CANDIDATE.zip`

| File | Status | Phase |
|---|---|---|
| `admin-lawyers.html` | **new** | Final |
| `auth.js` | changed | Final (admin login and redirect; customer and lawyer behaviour unchanged) |
| `lawyer-data.js` | changed | Final (backend API instead of demo data) |
| `find-a-lawyer.html` | changed | Final |
| `lawyer-profile.html`, `lawyer-profile.js` | changed | Final |
| `lawyer-dashboard.html` | changed | Final (lawyer login, real profile) |
| `lawyer-connect.html` | changed | Final (Register → real signup) |
| `legal-help-dashboard/index.html` | changed | Hero, Final |
| `legal-help-dashboard/legal-help.js` | changed | P1, Hero, Final (saved history) |
| `legal-help-dashboard/legal-help-components.js` | changed | P1, Hero, Final |
| `legal-help-dashboard/legal-help-service.js` | changed | P1, Hero, Final |
| `legal-help-dashboard/legal-help-data.js` | changed | P1, Hero, Final |
| `legal-help-dashboard/legal-help.css` | changed | P1, Hero, Final |
| `legal-help-dashboard/legal-help-voice.js` | **new** | Hero, Final |
| `legal-help-dashboard/README.md` | changed | documentation |

Not included: `.env`, keys, `node_modules`, `package-lock.json` (npm updates it on
your machine), private uploads and database exports.

## 3. New dependencies

- `pdfjs-dist` **5.7.284** (Mozilla PDF.js, Apache-2.0). npm also installs its optional
  `@napi-rs/canvas` automatically.
- Requires **Node.js 22.13 or newer**.

## 4. Database changes (no migration script needed)

Mongoose creates these automatically on first use:
- **New collections:**
  - `guidanceconversations`, with indexes `{owner, lastMessageAt}` and a TTL index on
    `expiresAt`.
  - `guidancedocuments`, with an owner index and a TTL index on `expiresAt`.
- **New optional fields on `lawyers`:** `verifiedAt`, `verifiedBy`, `reviewNote`.
  Existing records stay valid.

**Important behaviour change:**
- Public pages now show **only verified and published** lawyers.
- In your current database, lawyers who are still `pending` (including seeded demo
  lawyers marked pending) are no longer listed until an admin verifies them.
- Demo lawyers from `npm run seed` that are marked verified still appear. They are
  labelled demo data in `seed.js`.

## 5. Environment variables (names only; set the values in your own `.env`)

- **Required:** `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`.
- **Optional, AI Legal Guidance:**
  - `GEMINI_MODEL`, `GUIDANCE_SCOPE_MODEL`
  - `GUIDANCE_RATE_LIMIT_WINDOW_MINUTES`, `GUIDANCE_RATE_LIMIT_MAX`
  - `GUIDANCE_BODY_LIMIT`
- **Optional, documents:**
  - `GUIDANCE_DOC_MAX_MB`, `GUIDANCE_DOC_TTL_DAYS`, `GUIDANCE_DOC_MAX_PER_USER`
  - `GUIDANCE_DOC_UPLOAD_RATE_LIMIT`
  - `GUIDANCE_PDF_TIMEOUT_MS`, `GUIDANCE_PDF_WORKER_MEMORY_MB`
- **Optional, saved conversations:** `GUIDANCE_CONVERSATION_TTL_DAYS`,
  `GUIDANCE_CONVERSATION_MAX_PER_USER`, `GUIDANCE_CONVERSATION_MAX_MESSAGES`.
- **Unchanged and still used by Legal Drafting:** `OPENAI_API_KEY`.
- **For automation only:** `ADMIN_PASSWORD` (read by `create-admin.js`).

## 6. Windows installation

1. Check Node.js with `node -v`. It must be **v22.13 or newer**; if not, install the
   current LTS from nodejs.org.
2. **Back up** your `backend` and frontend folders.
3. Stop the backend (`Ctrl + C`).
4. **Backend:**
   - Right-click `LegalLens-Backend-RELEASE-CANDIDATE.zip` → Extract All.
   - Copy everything inside into `backend` and choose **Replace**.
   - Do not overwrite your `.env`.
   - PowerShell alternative:
     `Expand-Archive LegalLens-Backend-RELEASE-CANDIDATE.zip -DestinationPath C:\path\to\backend -Force`
5. **Frontend:** extract `LegalLens-Frontend-RELEASE-CANDIDATE.zip` into your frontend
   root and choose **Replace**.
6. In `backend`, run `npm install` (adds pdfjs-dist).
7. **Create your admin account** (one time):
   ```powershell
   node scripts/create-admin.js you@yourdomain.com "Your Name"
   ```
   Type the password when asked.
8. Run `npm run dev`. Open the site with Live Server at `http://127.0.0.1:5500` and
   press `Ctrl + F5`.
9. **Verify your existing lawyers:** open `admin-lawyers.html`, log in, and verify the
   real lawyers on the **Pending** tab.

**Deployment (Render):**
- Render reads `engines.node` from `package.json`; you can also set the environment
  variable `NODE_VERSION=22`.
- No other change is needed. The Vercel build copies the new frontend files
  automatically.

## 7. Exact test commands

**Backend (PowerShell, in `backend`).** Use a test database; its name must contain
"test".

```powershell
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017/legallens_test"
node --test tests/guidance.test.js tests/guidanceHero.test.js tests/guidanceConversations.test.js tests/lawyerConnect.test.js tests/regressionSmoke.test.js tests/smartCaseBuilder.test.js
node --test tests/geminiGuidanceClient.test.js
```

**Real Gemini** (uses your quota):

```powershell
node scripts/guidance-eval.js 13 14 15 16 17 18
```

## 8. Test results

### 8.1 Automated backend tests: executed, all passed (mocked AI)

These use the real Express app, routes, auth, validators, PDF/DOCX/TXT extraction and
the worker thread, with a MongoDB-compatible test database (FerretDB). The AI model is
a scripted fake.

| Suite | Result | Covers |
|---|---|---|
| `guidance.test.js` | **25/25** | Phase 1: customer-only access, legal-only refusal, injection, natural replies, formatting cleanup, long history with fact summary, limits, errors |
| `guidanceHero.test.js` | **24/24** | Uploads, file validation, scans/images (mocked reader), document ownership, document context and injection, lawyer suggestions, court-prep rules, PDF worker timeout, damaged PDF |
| `guidanceConversations.test.js` | **9/9** | Save and continue (browser history ignored), reopen, titles-only list, ownership (other customer 404, lawyer 403, anonymous 401), document references (deleted, expired, cascade delete), live lawyer re-check, fact summary, limits (409), API compatibility, Gemini blocked → 422 and bad config → 503 |
| `lawyerConnect.test.js` | **7/7** | Public = verified + published only, no emails, 404 for pending/rejected/hidden/malformed, regex-injection safety, admin login and role checks, **full flow: signup → profile → admin verify → AI suggestion → profile → re-verification on name change → hide → reject**, lawyer login and availability |
| `regressionSmoke.test.js` | **6/6** | Health; customer signup/login/refresh/logout (session revoked); Legal Drafting documents CRUD; drafting route answers without crashing (no AI key); Tracker and Case Builder lists; public directory |
| `smartCaseBuilder.test.js` (your existing file) | **11/11** | Unchanged module, regression |
| `geminiGuidanceClient.test.js` | **8/8** | Request mapping, JSON only for the scope check, file parts, thought filtering, 429 passthrough, blocked responses |
| **Total** | **90/90** | |

### 8.2 Browser tests (Chromium): executed, all passed

These use the real backend and database, with page and API on different origins, and
the AI mocked.

| Suite | Result | Covers |
|---|---|---|
| Lawyer flow (`test_ui_lawyer_flow`) | **27/27** | Real directory (no demo lawyers; pending and rejected hidden), XSS-safe names, "New" rating / "Fee not listed", location filter, real profile page, not-available state, phone width; the dashboard requires login; Register → real signup → dashboard shows pending → profile saved to the DB and still not public; a customer can't log in as admin; admin verifies; AI suggests the lawyer; **View profile opens the correct real profile**; the lawyer appears in Find a Lawyer; admin page at phone width |
| Saved history (`test_ui_history`) | **21/21** | Saved on the first question; follow-ups by ID; **refresh restores** messages, replies and the document; new conversation keeps the old one saved; list, reopen, two-step delete; another customer sees nothing (404); retention text; phone width |
| Hero features (`test_ui_hero`) | **34/34** | Voice (simulated speech API), uploads and validation, document follow-ups, lawyer cards, court prep and Hindi follow-up buttons (case history from the server), refusal, phone width, no XSS |
| Login (`test_ui_auth`) | **8/8** | Logged out, login return, expired token renewed for chat and upload, lawyer → customer-only |
| Phase 1 formatting (`test_ui_phase1`) | **16/16** | Markdown rendering, drafts and Copy, Hindi/Marathi, no XSS, long conversation |
| Page smoke (`test_ui_pages`) | **15/15** | 14 existing pages load with no JavaScript errors (logged out and as a customer), and customer login lands on the dashboard |
| **Total** | **121/121** | |

### 8.3 Failures found during this review, and how they were fixed

1. **Real bug:** the new saved-conversation code named a variable `history`, which hid
   the existing `history()` function. Questions silently failed to send. Found by the
   browser test and fixed (renamed); all suites were re-run.
2. **Test-setup problems, not application bugs:**
   - Tests expected 400, but the project's validation middleware returns 422. I fixed
     the expectations.
   - A deliberately small test limit (3 conversations) was shared between tests. I gave
     each test its own customer.
   - Two Phase 1 checks expected the browser to send history, which saved
     conversations now do on the server. I updated them to check the server side.
3. **Test-database limitation:**
   - FerretDB doesn't support a projection that the existing lawyer-name sync in
     `lawyerController` sends.
   - I replaced `User.findByIdAndUpdate` with the equivalent `User.updateOne`, which
     behaves the same on real MongoDB.

**Open failures:** none in the tests above.

### 8.4 Checked by reading code or documentation only

- Gemini REST request format and block reasons, against Google's API reference.
- `@napi-rs/canvas` has prebuilt Windows binaries, according to its package metadata.
- The prompt wording for court preparation, documents and lawyer rules.

### 8.5 Not verified: needs real credentials, a microphone, or deployment

- **Real Gemini behaviour:**
  - quality and accuracy of legal guidance and court preparation;
  - Hindi, Marathi and Hinglish quality;
  - document explanations;
  - whether lawyer suggestions appear at sensible times;
  - whether the model reliably writes its hidden header lines.

  Mocked tests do **not** prove legal accuracy. Run `scripts/guidance-eval.js` and have
  a qualified lawyer review sample answers.
- **Image and scanned-PDF reading by Gemini.** It is implemented and tested only with a
  mocked reader, so I make **no claim that it works** until you have run eval scenario
  18 and a real image upload.
- **Real speech recognition** with a microphone (Chrome/Edge; English, Hindi, Marathi).
  Only a simulated speech API was used here.
- **`npm install` on Windows,** and Node 22.13+ on your machine and on Render.
- **MongoDB Atlas:** TTL index expiry timing, index creation, and the
  `findByIdAndUpdate` → `updateOne` change on real MongoDB. It is equivalent, but was
  run here only on FerretDB.
- **Deployment** on Vercel and Render: CORS, cookies and the proxy over https.
- **Legal Drafting with your OpenAI key.** The route answers, but no real generation
  was run.
- A professional security review or penetration test.

## 9. Known limitations

- **Consultation requests and "My Clients" are still browser-only demo data,** in the
  same browser only, as before. This is labelled in the dashboard and modal. The backend
  consultation API exists, but connecting it was outside this request.
- **Ratings** are not shown for real lawyers ("New"), because there is no review
  system. Seeded demo lawyers keep their seed values.
- **Deletion:**
  - Deleted conversations and documents are removed from MongoDB right away.
  - Backups or replicas you run may keep copies until they rotate.
  - TTL expiry runs about once a minute, and expired items are hidden immediately.
- **Gemini free tier:**
  - Up to 2 AI calls per question, plus 1 per image or scan.
  - The full history of a saved conversation is sent (trimmed), so longer cases use
    more tokens.
- **Admin:**
  - There is a single admin role, with no audit-log screen (`verifiedBy` and
    `verifiedAt` are stored).
  - Admin users are created from the command line.
- **The AI is not a lawyer.** It can be wrong. It never represents users or guarantees
  outcomes.
- The private evidence file found in your original backend ZIP was not opened and is
  not included.
