# LegalLens — Legal Help (AI Legal Assistance chatbot)

A single screen with a headline, four suggested questions and a ChatGPT-style
search bar, opening into a conversation. Plain HTML/CSS/JS with no build step.

Every question, whether typed, from a card or a follow-up, is answered live by
your existing Legal Lens backend:

```
Chatbot → POST {apiBaseUrl}/guidance/chat → Legal Lens backend → OpenAI → reply shown in the chat
```

The OpenAI key stays in the backend `.env`. This frontend never sees it and
never calls OpenAI directly.

## Files

| File | Purpose |
|---|---|
| `legal-help-service.js` | API client for `POST /guidance/chat`: timeouts, error mapping, conversation history |
| `legal-help.js` | Conversation state, loading state, duplicate-submit guard, retry; `LegalHelpDashboard.mount()` |
| `legal-help-components.js` | QueryCard, SearchBar, ConversationView, FormattedReply, LoadingMessage, ErrorMessage, GovernmentResource, LawyerCard, ComingSoonMessage |
| `legal-help-data.js` | The four suggested questions, **real** official links, **fictional** demo lawyers, UI messages |
| `legal-help.css` | Styles, scoped under `.llh` |
| `index.html` | Standalone page, handy for local testing |

## API contract (existing endpoint)

```
POST /api/guidance/chat
{ "message": "What are my rights as a tenant?",
  "history": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…" } ] }   ← optional

200 { "success": true,  "reply": "…" }
400 { "success": false, "message": "Please enter a legal question." }
500 { "success": false, "message": "Failed to generate legal guidance." }
503 { "success": false, "message": "AI legal guidance is not configured on the server." }
```

The first question is sent as `{ message }` only. Follow-ups include the
earlier turns in `history`, trimmed so the request stays under the backend's
10 kb body limit.

## Run it locally

1. Start the backend: `cd backend`, then `npm run dev`. `.env` must contain
   `OPENAI_API_KEY` and `MONGODB_URI`.
2. Serve this folder over **http://127.0.0.1:5500**, for example with VS Code
   → right-click `index.html` → *Open with Live Server*. That origin is already
   in the backend's CORS list. Opening the file by double-click (`file://`) is
   blocked by the backend's CORS check.

## Add it to an existing page

```html
<link rel="stylesheet" href="legal-help/legal-help.css" />
<div id="legal-help"></div>
<script src="legal-help/legal-help-data.js"></script>
<script src="legal-help/legal-help-service.js"></script>
<script src="legal-help/legal-help-components.js"></script>
<script src="legal-help/legal-help.js"></script>
<script>
  LegalHelpDashboard.mount(document.getElementById('legal-help'), {
    apiBaseUrl: 'http://localhost:5000/api'  // your backend
  });
</script>
```

The page's origin must be in `allowedOrigins` in the backend's `server.js`.

## Behaviour

- **Loading:** "LegalLens is thinking…" appears while waiting. Send is disabled
  and Enter is ignored until the reply arrives (one request at a time).
- **Errors:** backend offline, no internet, OpenAI failure or empty reply, rate
  limit, timeout (60 s) and too-long conversation. Each shows a clear message,
  with **Try again** where retrying makes sense.
- **Empty question:** Send stays disabled; a whitespace-only submit shows
  "Please enter a legal question."
- **Suggested cards** send their question to the API. The answer then shows
  the topic's **real** official government links and the **fictional** demo
  lawyers (labelled, with "Lawyer profiles coming soon.").
- AI replies are rendered as text only (paragraphs, lists, bold). Nothing in a
  reply is treated as HTML, and URLs the AI writes are **not** made clickable;
  only the curated official links are.
- **Paperclip and microphone** still show "Feature coming soon". No file is
  read or uploaded and no microphone permission is requested.

## Later

- Document analysis: `analyzeDocument()` in `legal-help-service.js`
- Voice input: `startVoiceInput()` in `legal-help-service.js`
- Real lawyer suggestions: Lawyer Connect API (`GET /api/lawyers`)
