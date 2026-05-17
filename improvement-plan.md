# Code Improvement Plan — Next.js App

> **Scope:** Agent-executable refactoring tasks derived from static analysis.
> **Stack:** Next.js 14 App Router · Prisma · Vercel Blob · NextAuth
> **Estimated total effort:** ~3–4 days of focused work

---

## How to use this plan

Work through phases in order. Each task includes:

- **What** — what to create or change
- **Where** — exact file path(s)
- **How** — step-by-step instructions the agent can follow directly
- **Verify** — how to confirm the task is done correctly

Do not skip Phase 1 before starting Phase 2. Later phases depend on the shared utilities created in Phase 1.

---

## Phase 1 — Extract shared utilities (highest priority, ~2 hours)

### Task 1.1 — Create `lib/extractDocumentText.js`

**What:** Move the duplicate document-extraction logic (PDF, DOCX, PPTX, XLSX, TXT) into a single shared utility.

**Where:**

- Source A: `app/api/chat/route.js` — functions `fetchBlobBuffer` and `extractDocumentText`
- Source B: `app/api/summarize/route.js` — same two functions, copy-pasted
- Target: `lib/extractDocumentText.js` (new file)

**How:**

1. Create `lib/extractDocumentText.js` with the following exports:

   ```js
   // lib/extractDocumentText.js
   import { get } from "@vercel/blob";
   import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
   import mammoth from "mammoth";

   export async function fetchBlobBuffer(url) { ... }
   export async function extractDocumentText(url, type) { ... }
   ```

2. Copy the implementation verbatim from `app/api/chat/route.js` into the new file.
3. In `app/api/chat/route.js`: delete both function definitions and add `import { fetchBlobBuffer, extractDocumentText } from "@/lib/extractDocumentText";` at the top.
4. In `app/api/summarize/route.js`: delete both function definitions and add the same import.

**Verify:**

- `grep -n "fetchBlobBuffer\|extractDocumentText" app/api/chat/route.js` — should show only the import line, no function body.
- `grep -n "fetchBlobBuffer\|extractDocumentText" app/api/summarize/route.js` — same.
- `lib/extractDocumentText.js` exists and exports both functions.
- Dev server starts without errors (`npm run dev`).

---

### Task 1.2 — Create `lib/apiHandler.js` error-wrapper

**What:** A thin wrapper that adds consistent try/catch and error response to every route handler.

**Where:** `lib/apiHandler.js` (new file)

**How:**

1. Create `lib/apiHandler.js`:

   ```js
   // lib/apiHandler.js
   import { NextResponse } from "next/server";

   /**
    * Wraps a Next.js route handler with a top-level try/catch.
    * @param {(req: Request) => Promise<Response>} handler
    */
   export function apiHandler(handler) {
     return async function (req, ctx) {
       try {
         return await handler(req, ctx);
       } catch (err) {
         console.error("[apiHandler]", req.method, req.url, err);
         const message = err?.message || "Internal server error";
         const status = err?.status || 500;
         return NextResponse.json({ error: message }, { status });
       }
     };
   }
   ```

**Verify:**

- File exists at `lib/apiHandler.js` and exports `apiHandler`.

---

## Phase 2 — Fix unguarded routes (~1 hour)

The following six route files have **no try/catch**. Wrap each using the `apiHandler` from Phase 1.

### Routes to fix

| File                                             | Current export                    |
| ------------------------------------------------ | --------------------------------- |
| `app/api/forgot-password/route.js`               | `export async function POST(req)` |
| `app/api/verify-otp/route.js`                    | `export async function POST(req)` |
| `app/api/new-password/route.js`                  | `export async function POST(req)` |
| `app/api/reset-password/route.js`                | `export async function POST(req)` |
| `app/api/openapi/route.js`                       | `export async function GET(req)`  |
| `app/api/generate-slides/[id]/download/route.js` | `export async function GET(req)`  |

### Task 2.1 — Wrap each route

**How (repeat for every file in the table above):**

1. Open the file.
2. Add this import at the top:
   ```js
   import { apiHandler } from "@/lib/apiHandler";
   ```
3. Change:
   ```js
   export async function POST(req) {
     // ... existing body
   }
   ```
   to:
   ```js
   export const POST = apiHandler(async function (req) {
     // ... existing body (unchanged)
   });
   ```
   Use `GET` instead of `POST` where applicable (see table above).
4. Do **not** change any logic inside the handler body — only the wrapping changes.

**Verify:**

- `grep -rn "try {" app/api/forgot-password app/api/verify-otp app/api/new-password app/api/reset-password app/api/openapi "app/api/generate-slides/[id]/download"` — may return 0 results (handler body is now wrapped by apiHandler, individual try/catch inside is fine too).
- Each route returns a proper JSON error instead of crashing when given invalid input.

---

## Phase 3 — Migrate raw SQL to Prisma (~1 day)

### Task 3.1 — Add `ChatThread` and `ChatMessage` to Prisma schema

**What:** The `app/api/chat/route.js` file uses 9 raw SQL statements for `ChatThread` and `ChatMessage`. These must become proper Prisma models.

**Where:** `prisma/schema.prisma`

**How:**

1. Open `prisma/schema.prisma`.
2. Add the following models (adjust field types to match your database engine — MySQL shown):

   ```prisma
   model ChatThread {
     id        Int           @id @default(autoincrement())
     userId    Int
     summaryId Int
     createdAt DateTime      @default(now())
     updatedAt DateTime      @updatedAt
     messages  ChatMessage[]

     @@unique([userId, summaryId])
   }

   model ChatMessage {
     id         Int        @id @default(autoincrement())
     threadId   Int
     turn       Int
     role       String     @db.VarChar(16)
     content    String     @db.Text
     modelLabel String?    @db.VarChar(128)
     createdAt  DateTime   @default(now())
     thread     ChatThread @relation(fields: [threadId], references: [id])
   }
   ```

3. Run `npx prisma migrate dev --name add_chat_tables` to create the migration.
4. Run `npx prisma generate` to regenerate the client.

**Verify:**

- `npx prisma validate` exits 0.
- `npx prisma studio` shows `ChatThread` and `ChatMessage` tables.

---

### Task 3.2 — Replace raw SQL in `app/api/chat/route.js`

**What:** Replace all `$executeRaw` / `$queryRaw` calls with typed Prisma client calls.

**Where:** `app/api/chat/route.js`

**How:** Find each raw SQL block and replace as follows.

**Block A — Thread upsert (currently near end of POST handler):**

```js
// BEFORE
await prisma.$executeRaw`
  INSERT INTO ChatThread (userId, summaryId, createdAt, updatedAt)
  VALUES (${user.id}, ${summaryId}, NOW(), NOW())
  ON DUPLICATE KEY UPDATE updatedAt = NOW()
`;
const threadRow = await prisma.$queryRaw`
  SELECT id FROM ChatThread
  WHERE userId = ${user.id} AND summaryId = ${summaryId} LIMIT 1
`;
const threadId = Number(threadRow?.[0]?.id);

// AFTER
const thread = await prisma.chatThread.upsert({
  where: { userId_summaryId: { userId: user.id, summaryId } },
  create: { userId: user.id, summaryId },
  update: { updatedAt: new Date() },
  select: { id: true },
});
const threadId = thread.id;
```

**Block B — Regenerate: read last two messages:**

```js
// BEFORE
const lastTwo = await prisma.$queryRaw`
  SELECT turn, role, content FROM ChatMessage
  WHERE threadId = ${threadId} ORDER BY turn DESC LIMIT 2
`;

// AFTER
const lastTwo = await prisma.chatMessage.findMany({
  where: { threadId },
  orderBy: { turn: "desc" },
  take: 2,
  select: { turn: true, role: true, content: true },
});
```

**Block C — Regenerate: delete old assistant message:**

```js
// BEFORE
await prisma.$executeRaw`
  DELETE FROM ChatMessage WHERE threadId = ${threadId} AND turn = ${assistantTurn}
`;

// AFTER
await prisma.chatMessage.deleteMany({
  where: { threadId, turn: assistantTurn },
});
```

**Block D — Regenerate: re-insert assistant message:**

```js
// BEFORE
await prisma.$executeRaw`
  INSERT INTO ChatMessage (threadId, turn, role, content, modelLabel, createdAt)
  VALUES (${threadId}, ${assistantTurn}, 'assistant', ${finalReply}, ${modelLabel}, NOW())
`;

// AFTER
await prisma.chatMessage.create({
  data: {
    threadId,
    turn: assistantTurn,
    role: "assistant",
    content: finalReply,
    modelLabel,
  },
});
```

**Block E — Normal insert: get max turn:**

```js
// BEFORE
const nextTurnRow = await prisma.$queryRaw`
  SELECT COALESCE(MAX(turn), -1) AS maxTurn FROM ChatMessage WHERE threadId = ${threadId}
`;
const nextTurn = Number(nextTurnRow?.[0]?.maxTurn) + 1;

// AFTER
const agg = await prisma.chatMessage.aggregate({
  where: { threadId },
  _max: { turn: true },
});
const nextTurn = (agg._max.turn ?? -1) + 1;
```

**Block F — Normal insert: insert user + assistant messages:**

```js
// BEFORE
await prisma.$executeRaw`
  INSERT INTO ChatMessage (threadId, turn, role, content, modelLabel, createdAt)
  VALUES
    (${threadId}, ${nextTurn}, 'user', ${userRowContent}, NULL, NOW()),
    (${threadId}, ${nextTurn + 1}, 'assistant', ${finalReply}, ${modelLabel}, NOW())
`;

// AFTER
await prisma.chatMessage.createMany({
  data: [
    {
      threadId,
      turn: nextTurn,
      role: "user",
      content: userRowContent,
      modelLabel: null,
    },
    {
      threadId,
      turn: nextTurn + 1,
      role: "assistant",
      content: finalReply,
      modelLabel,
    },
  ],
});
```

**Verify:**

- `grep -n "executeRaw\|queryRaw" app/api/chat/route.js` returns 0 results.
- Send a chat message in the app and confirm it persists and reloads correctly.
- Regenerate a reply and confirm the last assistant message is replaced correctly.

---

## Phase 4 — Standardize auth pattern (~30 minutes)

### Task 4.1 — Audit and document auth usage

**What:** Identify every route and whether it uses `getRequestUser`, `getServerSession`, or no auth guard.

**How:**

1. Run:
   ```bash
   grep -rn "getRequestUser\|getServerSession\|No auth" app/api/*/route.js app/api/*/*/route.js
   ```
2. For any route using `getServerSession(authOptions)` that is NOT a public route (forgot-password, reset-password, verify-otp, new-password), replace with `getRequestUser()` from `@/lib/apiAuth`.
3. Add a comment above any intentionally public route:
   ```js
   // PUBLIC ROUTE — no auth required (password reset flow)
   ```

**Verify:**

- `grep -rn "getServerSession" app/api/` returns only routes that are intentionally using it (or zero results if fully migrated).

---

## Phase 5 — Introduce data-fetching layer (~1 day)

### Task 5.1 — Install SWR

**How:**

```bash
npm install swr
```

---

### Task 5.2 — Replace `fetchHistory` with `useSWR`

**Where:** `app/dashboard/page.jsx`

**How:**

1. Add import at top of file:
   ```js
   import useSWR from "swr";
   const fetcher = (url) => fetch(url).then((r) => r.json());
   ```
2. Delete the `fetchHistory` useCallback and its `useEffect` trigger.
3. Delete `const [history, setHistory] = useState([])` and `const [historyLoading, setHistoryLoading] = useState(true)`.
4. Replace with:
   ```js
   const {
     data: historyData,
     isLoading: historyLoading,
     mutate: mutateHistory,
   } = useSWR(status === "authenticated" ? "/api/history" : null, fetcher);
   const history = historyData?.summaries || [];
   ```
5. Wherever `fetchHistory()` is called after a mutation (e.g. after submitting a summary), replace with `mutateHistory()`.

---

### Task 5.3 — Replace `fetchPrevUploads` with `useSWR`

**Where:** `app/dashboard/page.jsx`

**How:** Same pattern as Task 5.2.

1. Delete `fetchPrevUploads` useCallback, its useEffect, `prevUploads` useState, and `prevLoading` useState.
2. Replace with:
   ```js
   const {
     data: uploadsData,
     isLoading: prevLoading,
     mutate: mutateUploads,
   } = useSWR(status === "authenticated" ? "/api/documents" : null, fetcher);
   const prevUploads = uploadsData?.documents || [];
   ```
3. Replace any `fetchPrevUploads()` call with `mutateUploads()`.

**Verify:**

- Dashboard loads history and documents without errors.
- Uploading a new document and triggering `mutateUploads()` refreshes the list.
- Rapid navigation does not send duplicate API calls (check Network tab — SWR deduplicates within the same key).

---

## Phase 6 — Break up god files (ongoing refactor, ~1–2 days)

This is the largest phase. Work in small, independently testable slices.

### Task 6.1 — Extract `useDocumentManager` hook from `dashboard/page.jsx`

**What:** Extract all state and logic related to previous uploads and document removal into a custom hook.

**Where:** Create `app/dashboard/hooks/useDocumentManager.js`

**What to move:**

- `prevUploads`, `prevLoading` (now via SWR from Phase 5)
- `removingDocId`, `setRemovingDocId`
- `selectedPrevDocIds`, `setSelectedPrevDocIds`
- `bulkRemoving`, `setBulkRemoving`
- `useEffect` that filters `selectedPrevDocIds` when `prevUploads` changes
- All handler functions that call `/api/documents/[id]` DELETE

**How:**

1. Create `app/dashboard/hooks/useDocumentManager.js` and move the above state + logic into it.
2. Return everything the component needs from the hook.
3. In `dashboard/page.jsx`, replace the individual `useState` declarations with:
   ```js
   const {
     prevUploads,
     prevLoading,
     removingDocId,
     selectedPrevDocIds,
     bulkRemoving,
     handleRemoveDoc,
     handleBulkRemove,
     toggleSelectDoc,
   } = useDocumentManager();
   ```

---

### Task 6.2 — Extract `useImproveState` hook from `dashboard/page.jsx`

**What:** All state variables prefixed with `improve` (there are ~20) plus their associated handlers and effects.

**Where:** Create `app/dashboard/hooks/useImproveState.js`

**What to move:** All `improveFile`, `improveDocumentId`, `improveInstructions`, `parsedSlides`, `parseLoading`, `planAdjustments`, `planLoading`, `planError`, `addStockImages`, `additiveImprove`, `improveDetailLevel`, `improveImgQuery`, `improveImgResults`, `improveImageProvider`, `improveTargetSlide`, `pickedUserImages`, `improvePasteUrl`, `improveGenLoading`, `improveErr`, `improveAiModel`, `improveModelOpen` state and their handlers.

---

### Task 6.3 — Extract `<ImproveTab>` component

**What:** All JSX that renders when `dashMode === "improve"` should move to its own component.

**Where:** Create `app/dashboard/components/ImproveTab.jsx`

**How:**

1. Find the JSX block in `dashboard/page.jsx` guarded by `dashMode === "improve"`.
2. Move it to `ImproveTab.jsx` as a named export.
3. Pass the state from `useImproveState` as props (or accept the hook's return directly).
4. Replace the inline JSX in `page.jsx` with `<ImproveTab ... />`.

---

### Task 6.4 — Extract `<SummarizeTab>` component

**What:** Same extraction for `dashMode === "summarize"` JSX.

**Where:** Create `app/dashboard/components/SummarizeTab.jsx`

---

### Task 6.5 — Repeat for `summary/[id]/page.jsx`

Apply the same decomposition approach:

- Create `app/summary/[id]/hooks/useChatState.js` for all chat-related state.
- Create `app/summary/[id]/hooks/useSlideDeckPanel.js` for slide deck panel state (already partially exists in `useSlideDecks.js` — extend it).
- Target: `page.jsx` should only render a layout shell and import feature components. Aim for under 400 lines.

**Verify (all Phase 6 tasks):**

- `wc -l app/dashboard/page.jsx` — should trend downward with each extraction.
- No regressions: all features (upload, summarize, improve, history, bulk delete) work as before.

---

## Phase 7 — Structured logging (~30 minutes)

### Task 7.1 — Create `lib/logger.js`

**How:**

1. Create `lib/logger.js`:

   ```js
   // lib/logger.js
   const isDev = process.env.NODE_ENV !== "production";

   function formatMsg(level, scope, msg, meta) {
     const ts = new Date().toISOString();
     if (isDev) {
       console[level](`[${ts}] [${scope}]`, msg, meta || "");
     } else {
       // structured JSON for log aggregation (Vercel, Datadog, etc.)
       console[level](JSON.stringify({ ts, level, scope, msg, ...meta }));
     }
   }

   export const logger = {
     info: (scope, msg, meta) => formatMsg("log", scope, msg, meta),
     warn: (scope, msg, meta) => formatMsg("warn", scope, msg, meta),
     error: (scope, msg, meta) => formatMsg("error", scope, msg, meta),
   };
   ```

2. In `lib/apiHandler.js`, replace `console.error(...)` with:
   ```js
   import { logger } from "@/lib/logger";
   // ...
   logger.error("apiHandler", err?.message, {
     url: req.url,
     method: req.method,
   });
   ```
3. In `app/api/chat/route.js`, replace `console.warn(...)` and `console.error(...)` with `logger.warn` and `logger.error` calls, passing a scope string like `"chat"`.
4. Repeat for any other routes with bare `console.*` calls (60 total across the API layer).

**Verify:**

- `grep -rn "console\." app/api/` count decreases significantly (only intentional debug logs remain).
- In dev, logs still appear in the terminal with timestamp and scope.

---

## Completion checklist

| Phase | Task                                                 | Done |
| ----- | ---------------------------------------------------- | ---- |
| 1     | `lib/extractDocumentText.js` created                 | ☐    |
| 1     | `lib/apiHandler.js` created                          | ☐    |
| 2     | All 6 unguarded routes wrapped                       | ☐    |
| 3     | `ChatThread` + `ChatMessage` in Prisma schema        | ☐    |
| 3     | All 6 raw SQL blocks replaced in `chat/route.js`     | ☐    |
| 4     | Auth pattern standardized + public routes documented | ☐    |
| 5     | SWR installed                                        | ☐    |
| 5     | `fetchHistory` replaced with `useSWR`                | ☐    |
| 5     | `fetchPrevUploads` replaced with `useSWR`            | ☐    |
| 6     | `useDocumentManager` hook extracted                  | ☐    |
| 6     | `useImproveState` hook extracted                     | ☐    |
| 6     | `<ImproveTab>` component extracted                   | ☐    |
| 6     | `<SummarizeTab>` component extracted                 | ☐    |
| 6     | `summary/[id]/page.jsx` decomposed                   | ☐    |
| 7     | `lib/logger.js` created and adopted                  | ☐    |
