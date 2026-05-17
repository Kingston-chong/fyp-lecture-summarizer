# System Improvement Suggestions

> Based on a full review of the codebase — API routes, frontend components, auth flow, and UX patterns.

## Implementation status (May 2026)

| Item | Status |
|------|--------|
| 1.1 Role in JWT/session | **Done** — `jwt` + `session` callbacks in `lib/authOptions.js` |
| 1.2 Default `summarizeFor` from role | **Done** — dashboard initialises from `session.user.role` |
| 1.3 Persistent preferences | **Open** |
| 2.1 LLM rate limits | **Done** — `lib/llmRateLimit.js` on summarize, quiz generate, generate-slides |
| 2.2 Upload size cap | **Done** — 25 MB default in `/api/upload` |
| 2.3 History payload | **Done** — list returns `excerpt` only, not full `output` |
| 3.1 History pagination | **Done** — `page` / `limit` query params on `/api/history` |
| 4.1 History search | **Done** — filter in dashboard + summary sidebars |
| 4.2 Folders/tags | **Open** — no `/api/folders` in repo |
| 4.3 Dead Improve tab in slides modal | **Done** — removed `{false && …}` block |
| 4.4 Slides suggestion chips | **Done** (prior) |
| 5.1 Shared quiz identity | **Done** — optional `respondentLabel` on share flow |
| 5.2 Quiz deadline | **Done** — `closesAt` on `QuizSet` + enforcement |
| 5.3 Class/cohort label | **Open** |
| 6.1 Tests | **Partial** — `lib/quizCollection.test.js`, `lib/llmRateLimit.test.js` |
| 6.2 Style consolidation | **In progress** — AppShell/AppHeader/AuthMarketingNav → `.css`; many `style={{}}` remain |
| 6.3 Error boundaries | **Done** — `ErrorBoundary` in providers, `app/error.tsx` |
| 6.4 Analytics | **Partial** — optional Plausible via `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` |

---

## 1. User Role & Personalisation

### 1.1 Role is never surfaced after registration
**Was:** Role saved in DB but not exposed to the frontend.

**Now:** `session.user.role` is set from the DB (and cached on the JWT). Use it anywhere in the app.

**Still open:** Broader personalisation (quiz defaults, slide style by role).

### 1.2 `summarizeFor` defaults to `"lecturer"` for everyone
**Done:** Dashboard sets `summarizeFor` to `"student"` when `role === "Student"`, else `"lecturer"`, once per session (manual changes preserved).

### 1.3 No persistent user preferences
Settings like preferred AI model, summarize mode, and slide provider are reset on every page load. Users have to re-select them each time.

**Fix:** Persist preferences to the database (a `UserPreferences` table) or at minimum to `localStorage`, and restore them on load.

---

## 2. Security & API Hardening

### 2.1 No rate limiting on any API route
**Done** for LLM routes via `lib/llmRateLimit.js` (memory or Upstash Redis). Register/auth limits were already in place.

### 2.2 No file size limit enforced on upload
**Done** — `UPLOAD_MAX_FILE_BYTES` (default 25 MB) returns 413 before Blob upload.

### 2.3 History API returns full `output` field for every summary
**Done** — list endpoint returns `excerpt` (200 chars) instead of full `output`.

### 2.4 No input length validation on quiz/summarize routes
`/api/quiz/generate` and `/api/summarize` accept arbitrary text from the request body with no server-side length cap (beyond the env-configured `SUMMARY_MAX_INPUT_CHARS` on summarize). A crafted request could pass extremely long strings directly.

**Fix:** Always validate and clamp incoming text fields before passing to the LLM, regardless of how they were constructed.

---

## 3. Performance

### 3.1 History loads all summaries at once with no pagination
**Done** — API supports `page` and `limit` (default 20). **Open:** infinite scroll / "Load more" in the UI.

### 3.2 No caching on repeated identical summarize requests
If a user summarizes the same document twice (or two users summarize the same uploaded file), the system runs a full new LLM call each time.

**Fix:** Hash the document content + model + `summarizeFor` and cache results in the DB. Return the cached summary instantly on a hit.

### 3.3 `output` text stored raw in the `Summary` table
Storing the full summary output as a plain text field means the DB has to return it on every related query. With many users this table grows heavy quickly.

**Fix:** Consider offloading large text blobs to Vercel Blob storage and storing only the URL in the DB — the same pattern already used for uploaded documents.

---

## 4. User Experience

### 4.1 No search or filter on document/summary history
**Done** — search inputs on dashboard sidebar and summary `AppSidebar` (client-side filter by title / file name).

### 4.2 No folder or tagging system for documents
**Open** — no `Folder` model or `/api/folders` routes in the current repo.

### 4.3 Generate Slides modal has dead code and an invisible tab system
**Done** — removed the hidden Improve PPT block from `GenerateSlidesModal.jsx`. Improve PPT remains on the dashboard (`?mode=improve`).

### 4.4 The quick instruction chips in slides were hard to see and use
The horizontal scrolling chip row in the Generate Slides modal was cramped and not obvious on narrower screens — the right column overflowed its grid track.

**Fix (already done):** Replaced with a dropdown suggestion menu triggered by an arrow button on the textarea.

### 4.5 No loading skeleton or empty states in the sidebar
When the history is loading, the sidebar shows nothing. When there are no summaries yet, there's no friendly empty state to guide new users.

**Fix:** Add a skeleton loader during fetch and an empty state illustration with a call-to-action ("Upload your first document →") for new users.

---

## 5. Lecturer-Specific Features

### 5.1 Shared quizzes have no identity
**Done** — optional name on the share page; stored as `QuizAttempt.respondentLabel`. Attempts list shows label or username. (Sign-in is still required to submit.)

### 5.2 No way to set a quiz deadline or close responses automatically
**Done** — `QuizSet.closesAt` + datetime picker in lecturer review modal; share routes auto-close when past deadline.

### 5.3 No class/group concept for sharing quizzes
Every quiz is shared via a single public URL with no notion of a "class". A lecturer with multiple groups can't track which group's responses are which.

**Fix:** Add an optional class/cohort label that students enter on the shared quiz page. Include it in the attempt record for filtering in the review view.

---

## 6. Code Quality & Maintainability

### 6.1 No automated tests
**Partial** — unit tests for `lib/quizCollection.js` and `lib/llmRateLimit.js` (`node --test`). Integration tests for API routes still open.

### 6.2 Styles are split across inline `<style>` blocks, CSS modules, and plain CSS files
**In progress** — dashboard/modals moved to co-located `.css`; `AppShell`, `AppHeader`, and `AuthMarketingNav` no longer use embedded `<style>`. Many `style={{}}` usages remain.

**Fix:** Continue migrating to shared tokens in `globals.css` and co-located CSS.

### 6.3 No error boundary in the app
**Done** — `app/components/ErrorBoundary.jsx` wraps the app in `providers.jsx`; `app/error.tsx` handles route errors.

### 6.4 No analytics or usage visibility
**Partial** — `app/components/Analytics.jsx` loads Plausible when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set. Custom event tracking still open.

---

## Priority Order (suggested)

| Priority | Item |
|---|---|
| 🔴 High | Rate limiting on LLM routes (2.1) |
| 🔴 High | File size limit on upload (2.2) |
| 🔴 High | Role in session → default summarize mode (1.1, 1.2) |
| 🟡 Medium | History pagination (3.1) |
| 🟡 Medium | Persist user preferences (1.3) |
| 🟡 Medium | History search/filter (4.1) |
| 🟡 Medium | Shared quiz identity / deadline (5.1, 5.2) |
| 🟢 Low | Folder/tag system (4.2) |
| 🟢 Low | Tests (6.1) |
| 🟢 Low | Analytics (6.4) |
| 🟢 Low | Error boundaries (6.3) |
