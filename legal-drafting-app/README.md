# Legal Lens — Legal Drafting Assistant (frontend)

React + Vite app for the Legal Lens Legal Drafting Assistant. Sign-in, documents,
autosave, version history/restore and AI draft generation use the Legal Lens
backend. The legal-intelligence panel tools (health, clauses, compliance,
citations, research, assistant), OCR and comparison samples remain clearly
labelled demos.

## Run

This app lives inside the main Legal Lens site (`legal-drafting-app/`) and is
served at **`/legal-drafting/`**. Start the backend first
(`cd backend && npm run dev`, port 5000), then:

```bash
npm install
npm run dev      # http://localhost:5173/legal-drafting/  (proxies /api → localhost:5000)
npm run lint
npm run build    # → dist/, copied to /legal-drafting/ by the root build
```

The whole site (main pages + this app, same origin) is built and served from
the project root — see the root `README-DEPLOY.md`.

## Opening it from the main Legal Lens site

The main site's **Features → Legal Drafting Assistance → Explore** button uses
`LEGAL_DRAFTING_APP_URL` from the root `config.js`, which points to
`/legal-drafting/`. **Legal Lens home** in this app's account menu goes back to
`/` (the main site).

Sessions: both apps use the same backend auth (in-memory access token +
httpOnly refresh cookie). Signing in here also sets the main site's non-secret
navbar flags (`loggedIn`, `userRole`, `userName`, `userEmail`) and signing out
clears them, matching the main site's `auth.js` convention. The sign-in form is
prefilled with the email the main site last used.

## Backend connection

| Frontend | Backend |
|---|---|
| Sign in / session | `POST /api/auth/{customer,lawyer}/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| My Documents, dashboard list | `GET /api/documents` |
| Create (Draft Setup, templates, review, compare, duplicate, import) | `POST /api/documents` |
| Open / reopen | `GET /api/documents/:id` |
| Autosave, rename, status | `PATCH /api/documents/:id` |
| Save / clause / AI edit / large edit / regenerate → version | `PATCH /api/documents/:id` with `versionReason` |
| Version history, preview, restore | `GET /api/documents/:id/versions[/:versionId]`, `POST …/restore` |
| Delete | `DELETE /api/documents/:id` |
| "Write the full draft with AI" | `POST /api/drafting/generate` (OpenAI on the server) |

The access token lives in memory only; the refresh token is the backend's
httpOnly cookie. Drafts saved in this browser by earlier versions can be
imported from My Documents (local copies are never deleted).

## Build progress

- [x] Step 2 — design system, routing, shared layout, Drafting Dashboard
- [x] Step 3 — Draft Setup flow (modal, description-detail indicator, language, BNS/BNSS preference)
- [x] Step 4 — Draft Workspace (case details, TipTap editor, field tokens, save/autosave) — verified locally
- [x] Step 5 — Legal assistant panel (demo) — verified locally
- [x] Step 6 — Review existing document, OCR UI, Compare / redlining (demo) — verified locally
- [x] Step 7 — Template Library, My Documents, Version History, Limitation Calculator,
      court-ready preview and export/print
- [x] V2 — connected to the Legal Lens backend (auth, documents, versions, AI drafts)

Every route now renders a real page; no "scheduled for step N" placeholders remain.

## Structure

```
src/
  components/
    common/      Button, Badge, Tabs, EmptyState, Skeleton, Toast, SectionHeader, …
    layout/      AppShell, Navbar (+ mobile drawer), Footer, ScrollManager
    dashboard/   HeroSection, WorkflowSteps, DocumentTypeGrid/Card, DocumentsOverview, TemplatesPanel, ToolShortcuts
    draft-setup/ DraftSetupModal, DocumentTypePicker, DescriptionDetail, LanguagePicker, FrameworkOption, DraftSetupSummary
  context/       ToastProvider, DocumentsProvider (localStorage-backed), DraftSetupProvider (opens setup from anywhere)
  data/          document types, sample documents, navigation (mock data only)
  hooks/         useDocuments, useToast, useLocalStorage, useFavoriteTemplates, …
  pages/         one file per route
  services/      API boundary — components call services, never data/ directly
  styles/        tokens.css (design tokens), base.css
  utils/
```

## Connecting a backend later

`services/config.js` exposes `USE_MOCKS` (env `VITE_USE_MOCKS=false` to disable)
and `API_BASE_URL` (`VITE_API_BASE_URL`). Replace the mock branch inside each
service with a `fetch` call; the components stay unchanged.

## Draft Setup → workspace hand-off (Step 3)

`openDraftSetup({ typeId?, source })` (hook `useDraftSetup`) opens the setup modal
from any screen; `/draft/new?type=<id>` deep-links to it. "Generate Preliminary
Draft" calls `draftingService.generatePreliminaryDraft` (mock), stores a document
and navigates to `/draft/:docId`. The document carries:

```js
setup: { description, language: 'en'|'hi'|'mr', useBnsFramework: true|false|null,
         source, descriptionDetail: { score, level, found } }
generation: { source: 'demo', verificationStatus: 'unverified', status: 'preliminary', generatedAt }
```

The description-detail indicator (`utils/descriptionAnalysis.js`) only detects which
kinds of detail are mentioned (people, dates, amounts…). It makes no legal assessment.

## Legal assistant panel (Step 5)

All intelligence is **demo** logic running in the browser — no AI model, backend or
legal database. Every result carries `meta: { source: 'demo', verificationStatus:
'requires_verification', generatedAt }` and is labelled in the UI.

```
services/
  healthService.js      runHealthCheck(snapshot)        → demo/healthRules.js
  clauseService.js      detectMissingClauses(snapshot)  → data/intelligence/clauseCatalog.js
  complianceService.js  reviewCompliance(snapshot)      → data/intelligence/complianceRules.js
  citationService.js    listCitations / verifyCitation  → data/intelligence/citationCatalog.js
  researchService.js    searchResearch / saved items    → data/intelligence/researchTopics.js
  assistantService.js   runAssistant(action, {text})    → demo/assistantTransforms.js
utils/documentSnapshot.js      serialisable view of the draft sent to services
components/editor/editorBridge.js   the only code that changes the TipTap doc for review tools
hooks/useWorkspaceIntelligence.js   panel state + actions (survives panel collapse)
components/intelligence/*           Overview, Health, Clauses, Compliance, Citations, Research, Assistant
components/editor/SelectionActions  floating Explain / Rewrite / Formalize / Simplify / Check bar
```

Safety rules built in: no section numbers, case names, decisions or URLs are ever
generated; statutory items are always "to be verified"; assistant rewrites refuse
selections containing linked field tokens and re-check the text before replacing it.

## Review & Compare (Step 6)

Both flows run entirely in the browser. **Files are never uploaded or read**: extraction
and OCR are simulated, and the UI says so. The review rules and the diff engine are real
and run on whatever text is shown.

```
services/ocrService.js            extractText(fileInfo, { language, ocr }) → sample text (demo)
services/documentReviewService.js runReviewPipeline / reviewText / suggestDocumentType
services/demo/reviewRules.js      placeholders, blank signature lines, address gaps,
                                  date-format consistency, notice wording (structural only)
services/comparisonService.js     compareTexts (real diff) / compareDocuments (demo versions)
utils/textDiff.js                 paragraph LCS + word-level diff, applyDecisions()
utils/textToDoc.js                plain text ⇄ TipTap JSON
utils/reviewedDocument.js         builds a document record that opens in the Draft Workspace
utils/fileValidation.js           PDF / DOCX / JPG / JPEG / PNG, 25 MB demo limit
data/review/                      demo OCR samples (EN / HI / MR), comparison versions, stages
```

"Open in Drafting Editor" (Review) and "Open in Editor" (Compare → Clean Version) create a
local document with `source: 'reviewed-document' | 'compared-document'`, the original file
metadata, and TipTap content — then open it in the existing workspace, where all Step 5
tools work. Documents without a matching template use the hidden `general-document` type.

## Templates, documents, versions, limitation, export (Step 7)

```
data/templates/demoTemplates.js       8 demo templates, 7 categories, sections + purpose
data/draftTemplates/                  neutral template bodies (bracketed placeholders only)
data/limitation/demoLimitationRules.js matter types (no verified rule), illustrative demo period, warning text
services/templatesService.js          search / categories / favourites / recent, preview JSON, "use template" payload
services/documentStorageService.js    origin labels, title validation, duplicate payload, query (search/filter/sort), normalisation
services/versionService.js            per-document version snapshots (localStorage), labels, major-change detection
services/limitationService.js         date arithmetic only — never decides a legal period
services/exportService.js             print / PDF-via-print-dialog / Word-compatible .doc, A4 page geometry, print options
utils/paginate.js                     greedy A4 pagination, keeps headings with the next block
utils/defaultTitle.js                 sensible default document titles
components/export/                    CourtPreview (A4 pages, options, print) + DocRenderer
components/documents/                 document list item, rename dialog, document preview
components/workspace/VersionHistoryDrawer.jsx
styles/print.css                      hides all application chrome when printing
```

**Template Library** — search, category chips, favourites and recently used. Four
templates map to a structured document type and open Draft Setup; the rest create a
`general-document` with `origin.templateId`, so "Regenerate" still rebuilds them.

**My Documents** — search, document-type filter, status tabs and sort (recently edited by
default). Open, Preview, Rename, Duplicate, change status and Delete (confirmation dialog,
never `alert()`). Documents are stored by the backend (`/api/documents`).

**Version history** — snapshots are written at meaningful events (first open, manual save,
clause added, AI edit accepted, large edit, regenerate, restore), never per keystroke.
Restoring asks for confirmation, keeps later versions and adds a "Restored from Version N"
entry. Stored by the backend (`DocumentVersion`); deleting a document deletes them.

**Limitation Calculator** — a date framework, not a legal source. No statutory period is
configured: either an illustrative demo value (labelled *Demo value · Requires
verification*) or a period the user has verified and entered. The required warning is shown
above the form and again with every result.

**Court-ready preview & export** — measured pagination onto A4 pages with margins, page
numbers and an optional footer; options persist in `legal-lens:print-options:v1`.
Print and "Export PDF" both open the browser print dialog (choose *Save as PDF*) — the app
never writes a PDF itself. DOCX is shown as unavailable with the reason; only a clearly
labelled Word-compatible `.doc` (HTML) is offered, never a renamed file.
