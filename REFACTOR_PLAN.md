# Refactor Plan: `summarize`, `generate-slides`, `improve-ppt`

> **For GitHub Copilot / AI-assisted editing.**
> Work through each step in order. Each step is self-contained and safe to commit independently.
> Files referenced are relative to the project root.

---

## Overview

| Step | File(s) touched | What changes | Risk |
|------|----------------|--------------|------|
| 1 | `app/api/summarize/route.js` | Extract `resolveGeminiCandidates` to kill duplicate loop | Low |
| 2 | `app/api/summarize/route.js` | Extract `callAI` + `callAIStream` to `lib/llmDispatch.js` | Medium |
| 3 | `app/api/summarize/route.js` | Extract streaming handler to `lib/summarizeStream.js` | Medium |
| 4 | `app/api/summarize/route.js` | Replace `makeFinalizers` closure factory with plain helper | Low |
| 5 | `app/api/improve-ppt/generate/route.js` | Remove all `// FIX:` comments, replace with JSDoc | Low |
| 6 | `app/api/improve-ppt/generate/route.js` | Remove unreachable `provider` null-guard | Low |
| 7 | `app/api/improve-ppt/generate/route.js` | Extract `buildAlaiInputText` to `lib/alaiInputBuilder.js` | Low |
| 8 | `app/api/improve-ppt/generate/route.js` | Extract theme resolution to `lib/resolveEffectiveTheme.js` | Low |
| 9 | `app/api/generate-slides/route.js` | No structural changes — add JSDoc to both builder functions | Low |
| 10 | All three routes | Add missing JSDoc to exported `POST` handlers | Low |

---

## Step 1 — Extract `resolveGeminiCandidates` helper

**File:** `app/api/summarize/route.js`

**Problem:** The Gemini model fallback list is copy-pasted verbatim inside both `callAI` and `callAIStream`. Any change to the list or dedup logic must be made twice.

**What to do:**

1. Before `callAI`, add this function:

```js
/**
 * Returns a deduplicated list of Gemini model names to try, in priority order.
 * @param {string | null | undefined} modelVariant - User-supplied variant, if any.
 * @returns {string[]}
 */
function resolveGeminiCandidates(modelVariant) {
  const candidates = modelVariant
    ? [modelVariant]
    : [
        process.env.GEMINI_MODEL,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-1.5-pro",
      ].filter(Boolean);

  const seen = new Set();
  return candidates.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}
```

2. In `callAI` → Gemini branch, replace the inline candidate-building block with:

```js
const uniqueCandidates = resolveGeminiCandidates(modelVariant);
```

3. Do the same replacement inside `callAIStream` → Gemini branch.

4. Delete the now-redundant inline candidate-building code from both functions.

**Verify:** `grep -n "seen.add" app/api/summarize/route.js` should return exactly **one** match (inside `resolveGeminiCandidates`).

---

## Step 2 — Extract LLM dispatch to `lib/llmDispatch.js`

**Files:** `app/api/summarize/route.js` → new `lib/llmDispatch.js`

**Problem:** `callAI` and `callAIStream` are ~120 combined lines living inside the route file. They are general-purpose LLM dispatch utilities that other routes (`improve-ppt`, etc.) duplicate independently via `lib/llmServer.js` and `lib/runChat.js`.

**What to do:**

1. Create `lib/llmDispatch.js` and move the following into it:
   - `openRouterModelSlug(model, modelVariant)`
   - `isOpenRouterModelNotFound(err)`
   - `callOpenRouter(model, modelVariant, fullPrompt)` ← rename to `dispatchOpenRouter`
   - `callOpenRouterStream(model, modelVariant, fullPrompt)` ← rename to `dispatchOpenRouterStream`
   - `callAI(model, modelVariant, systemPrompt, documentText)` ← rename to `dispatchLlm`
   - `callAIStream(model, modelVariant, systemPrompt, documentText)` ← rename to `dispatchLlmStream`
   - `resolveGeminiCandidates` (from Step 1)

2. Move the four client instantiations to `lib/llmDispatch.js`:

```js
// lib/llmDispatch.js
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
// ... deepseekClient, geminiClient, openrouterClient
```

3. Export named functions from `lib/llmDispatch.js`:

```js
export { dispatchLlm, dispatchLlmStream };
```

4. In `app/api/summarize/route.js`, replace the moved code with:

```js
import { dispatchLlm, dispatchLlmStream } from "@/lib/llmDispatch";
```

5. Replace all internal calls to `callAI(...)` with `dispatchLlm(...)` and `callAIStream(...)` with `dispatchLlmStream(...)`.

**Verify:** `wc -l app/api/summarize/route.js` should drop by roughly 130 lines.

---

## Step 3 — Extract streaming handler to `lib/summarizeStream.js`

**Files:** `app/api/summarize/route.js` → new `lib/summarizeStream.js`

**Problem:** The `if (streamOutput)` branch is ~90 lines inside the `POST` handler. It creates a `ReadableStream` with an async `start()` callback that does: context prep → prompt build → SSE streaming → DB persisting → finalization. This is too much logic inline.

**What to do:**

1. Create `lib/summarizeStream.js` and move the stream-building block into an exported function:

```js
/**
 * Builds a Server-Sent Events ReadableStream that streams summary output
 * and persists results to the database.
 *
 * @param {{
 *   documents: { id: number, name: string, url: string, type: string }[];
 *   existingSummary: import("@prisma/client").Summary | null;
 *   user: { id: string };
 *   normalizedRole: string;
 *   roleProfile: object;
 *   effectiveModel: string;
 *   effectiveVariant: string | null;
 *   effectivePrompt: string;
 *   effectiveYearRange: object;
 *   isLecturer: boolean;
 *   makeFinalizers: Function;
 * }} params
 * @returns {ReadableStream}
 */
export function buildSummarizeStream(params) {
  // Move the existing `new ReadableStream({ async start(controller) { ... } })` block here.
}
```

2. Back in `app/api/summarize/route.js`, replace the `if (streamOutput) { ... return new NextResponse(...) }` block with:

```js
if (streamOutput) {
  const body = buildSummarizeStream({
    documents, existingSummary, user,
    normalizedRole, roleProfile,
    effectiveModel, effectiveVariant, effectivePrompt,
    effectiveYearRange, isLecturer,
    makeFinalizers,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

3. Add the import at the top:

```js
import { buildSummarizeStream } from "@/lib/summarizeStream";
```

**Verify:** `wc -l app/api/summarize/route.js` should drop by a further ~80 lines. The route handler should now be under 200 lines.

---

## Step 4 — Replace `makeFinalizers` closure factory with plain helpers

**File:** `app/api/summarize/route.js`

**Problem:** `makeFinalizers` is a factory function that returns two closures (`finalizeLecturerOutput`, `finalizeOutput`) which close over `referenceCatalog` and `referenceCatalogMeta`. The factory pattern obscures what is actually simple argument passing.

**What to do:**

1. Delete the `makeFinalizers` function entirely.

2. Replace every call site that does:

```js
const { finalizeLecturerOutput, finalizeOutput } = makeFinalizers(
  referenceCatalog,
  referenceCatalogMeta,
);
```

with direct helper calls, passing the catalog values as arguments where needed. For example, inline call sites now become:

```js
// Non-streaming path:
const output = isLecturer
  ? await finalizeLecturerOutput(rawOutput, existingSummary.id, referenceCatalog, referenceCatalogMeta)
  : finalizeOutput(rawOutput, referenceCatalog, referenceCatalogMeta, isLecturer);
```

3. Define `finalizeLecturerOutput` and `finalizeOutput` as module-level functions (or move them to `lib/referenceUtils.js` alongside `clampInvalidCitations`):

```js
/**
 * Finalizes lecturer summary output: clamps citations, builds reference list, persists to DB.
 * @param {string} raw
 * @param {number | null} summaryId
 * @param {object[]} referenceCatalog
 * @param {{ maxMarker: number }} referenceCatalogMeta
 * @returns {Promise<string>}
 */
async function finalizeLecturerOutput(raw, summaryId, referenceCatalog, referenceCatalogMeta) { ... }

/**
 * Finalizes standard summary output (non-lecturer).
 * @param {string} raw
 * @param {boolean} isLecturer
 * @param {object[]} referenceCatalog
 * @param {{ maxMarker: number }} referenceCatalogMeta
 * @returns {string}
 */
function finalizeOutput(raw, isLecturer, referenceCatalog, referenceCatalogMeta) { ... }
```

**Verify:** `grep -n "makeFinalizers" app/api/summarize/route.js` should return zero results.

---

## Step 5 — Remove `// FIX:` comments in `improve-ppt/generate/route.js`

**File:** `app/api/improve-ppt/generate/route.js`

**Problem:** There are 5 `// FIX:` comments scattered through the file. They describe implementation decisions that are already correctly implemented. They read like unresolved TODOs to anyone unfamiliar with the history, and some are misleading (e.g., "FIX: Per-model output token ceilings" — this is not a fix, it is correct design).

**What to do:**

Find every `// FIX:` line and convert it to a proper JSDoc or inline comment. Here are the exact replacements:

| Find | Replace with |
|------|-------------|
| `// ── FIX: Raise the serverless function timeout...` | `// Raise timeout: Tavily web enrichment + LLM can take 2–4 min on large decks.` |
| `// ── FIX: Per-model output token ceilings.` | `// Per-model token ceilings — 20-slide JSON output exceeds the global 4096 default.` |
| `// FIX: Resolve per-model max token limit` | `// Use per-model ceiling instead of global default (see IMPROVE_PPT_MAX_TOKENS above).` |
| `// FIX: Strengthen additive prompt so LLM adds content instead of cutting it` | `// Additive mode: instruct LLM to preserve originals and append only.` |
| `// 3. Call LLM — FIX: pass per-model maxTokens instead of global 4096` | `// 3. Call LLM with per-model token ceiling.` |

**Verify:** `grep -n "// FIX" app/api/improve-ppt/generate/route.js` should return zero results.

---

## Step 6 — Remove unreachable `provider` null-guard

**File:** `app/api/improve-ppt/generate/route.js`

**Problem:** The code near the provider-selection block reads:

```js
const provider =
  providerRaw === "2slides"
    ? "2slides"
    : providerRaw === "alai"
      ? "alai"
      : null;
if (!provider) {
  return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
}
```

This guard can never fire because `providerRaw` defaults to `"alai"` earlier:

```js
const providerRaw = String(body?.provider || "alai").toLowerCase();
```

Any unknown value becomes `null`, but `null` is then unreachable because the ternary catches everything else as `"alai"`.

**What to do:**

Replace the ternary + guard block with a simple validated parse:

```js
const VALID_PROVIDERS = new Set(["alai", "2slides"]);
const providerRaw = String(body?.provider || "alai").toLowerCase();
if (!VALID_PROVIDERS.has(providerRaw)) {
  return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
}
const provider = providerRaw; // "alai" | "2slides"
```

This achieves the same guard intent but makes the validation explicit and reachable.

**Verify:** `grep -n "provider === null" app/api/improve-ppt/generate/route.js` should return zero results.

---

## Step 7 — Extract `buildAlaiInputText` to `lib/alaiInputBuilder.js`

**File:** `app/api/improve-ppt/generate/route.js` → new `lib/alaiInputBuilder.js`

**Problem:** `buildAlaiInputText` is 80 lines of string construction. It has no dependency on request state and is purely a data transformation. It belongs in a lib file where it can be unit-tested in isolation.

**What to do:**

1. Create `lib/alaiInputBuilder.js`:

```js
/**
 * Builds the `input_text` payload sent to the Alai /generations endpoint
 * for the improve-ppt flow.
 *
 * @param {{
 *   instructions: string;
 *   title: string;
 *   subtitle: string;
 *   theme: { background: string; accent: string; text: string; panel: string };
 *   slides: { index: number; title: string; lines: string[]; notes: string }[];
 *   references: { title: string; url: string }[];
 *   templateHints: object | null;
 * }} params
 * @returns {string}
 */
export function buildAlaiInputText({ instructions, title, subtitle, theme, slides, references, templateHints }) {
  // Move the full function body here verbatim.
}
```

2. Also move the `capText` helper (used only by `buildAlaiInputText`) into the same file as a non-exported utility.

3. In `app/api/improve-ppt/generate/route.js`:

```js
import { buildAlaiInputText } from "@/lib/alaiInputBuilder";
```

4. Delete the now-empty `buildAlaiInputText` and `capText` definitions from the route file.

**Verify:** `grep -n "function buildAlaiInputText\|function capText" app/api/improve-ppt/generate/route.js` should return zero results.

---

## Step 8 — Extract theme resolution to `lib/resolveEffectiveTheme.js`

**File:** `app/api/improve-ppt/generate/route.js` → new `lib/resolveEffectiveTheme.js`

**Problem:** `normalizeContentTheme` is a 25-line pure function with no side effects. Its logic for choosing between the override theme, additive light default, and LLM-generated theme is subtle enough that it deserves to live in a testable lib file with a descriptive name.

**What to do:**

1. Create `lib/resolveEffectiveTheme.js`:

```js
import { panelFromBackground } from "@/lib/themeColors";

const DEFAULT_THEME = {
  background: "#0f172a",
  accent: "#6366f1",
  text: "#f1f5f9",
};

/**
 * Resolves the final theme color set from the LLM output, user override, or additive default.
 *
 * Priority order:
 *  1. `overrideTheme` — user picked a design template; apply it exactly.
 *  2. `additiveImprove` — preserve-original mode uses a neutral light palette.
 *  3. LLM-generated theme `t` — fall through with hex validation.
 *
 * @param {object | null} t - Raw theme object from LLM output.
 * @param {{ additiveImprove?: boolean; overrideTheme?: object | null }} options
 * @returns {{ background: string; accent: string; text: string; panel: string }}
 */
export function resolveEffectiveTheme(t, { additiveImprove = false, overrideTheme } = {}) {
  // Move the body of `normalizeContentTheme` here verbatim, renamed to match.
}
```

2. In `app/api/improve-ppt/generate/route.js`:

```js
import { resolveEffectiveTheme } from "@/lib/resolveEffectiveTheme";
```

3. Replace every call to `normalizeContentTheme(...)` with `resolveEffectiveTheme(...)`.

4. Delete `normalizeContentTheme` and the duplicate `DEFAULT_THEME` constant from the route file.

**Verify:** `grep -n "normalizeContentTheme\|DEFAULT_THEME" app/api/improve-ppt/generate/route.js` should return zero results.

---

## Step 9 — Add JSDoc to builder functions in `generate-slides/route.js`

**File:** `app/api/generate-slides/route.js`

**Problem:** `buildAlaiAdditionalInstructions` and `buildTwoSlidesInputText` both have `@param` JSDoc stubs but no `@returns` tag, and the `body` parameter type (`Record<string, unknown>`) is not descriptive enough for a reader unfamiliar with the request schema.

**What to do:**

Replace the existing JSDoc stubs on both functions with typed definitions that name the known fields:

```js
/**
 * Builds the `additional_instructions` string for the Alai generate-slides API.
 *
 * @param {{
 *   textStyle?: string;
 *   strictness?: "Strict" | "Flexible";
 *   slideLength?: string;
 *   highlightDefs?: boolean;
 *   boldKeywords?: boolean;
 *   speakerNotes?: boolean;
 *   bulletLimit?: string | number;
 *   slideUserPrompt?: string;
 *   userPrompt?: string;
 * }} body - Parsed request body fields relevant to slide instructions.
 * @param {ReturnType<typeof getRoleProfile>} roleProfile
 * @returns {string}
 */
function buildAlaiAdditionalInstructions(body, roleProfile) { ... }

/**
 * Builds the `userInput` text block for the 2slides Fast PPT API.
 *
 * @param {{
 *   title?: string;
 *   maxSlides?: number | string;
 *   slideUserPrompt?: string;
 *   userPrompt?: string;
 *   summaryText?: string;
 * }} body
 * @param {ReturnType<typeof getRoleProfile>} roleProfile
 * @returns {string}
 */
function buildTwoSlidesInputText(body, roleProfile) { ... }
```

No logic changes — only documentation.

**Verify:** `grep -n "@returns" app/api/generate-slides/route.js` should return at least 2 results.

---

## Step 10 — Add JSDoc to all three exported `POST` handlers

**Files:** All three route files.

**Problem:** None of the exported `POST` functions have JSDoc. This makes it harder for Copilot and other tooling to provide useful completions, and harder for new contributors to understand the contract at a glance.

**What to do:**

Add the following JSDoc immediately above each `export async function POST(req)`:

### `app/api/summarize/route.js`

```js
/**
 * POST /api/summarize
 *
 * Summarizes one or more documents using a configurable AI model.
 *
 * Supports two response modes:
 * - `stream: true`  → SSE stream of `status`, `meta`, `chunk`, `done`, and `error` events.
 * - `stream: false` → JSON `{ success: true, summaryId: number }`.
 *
 * Key body fields:
 * @param {Request} req
 * @param {object}  req.body
 * @param {number[]}  [req.body.documentIds]     - IDs of documents to summarize (new flow).
 * @param {number}    [req.body.summaryId]        - Existing summary to re-generate (live stream flow).
 * @param {string}    req.body.model              - Provider key: "chatgpt" | "deepseek" | "gemini".
 * @param {string}    [req.body.modelVariant]     - Specific model id override.
 * @param {string}    req.body.summarizeFor       - Audience role: "student" | "lecturer" | etc.
 * @param {string}    [req.body.prompt]           - Additional user instructions.
 * @param {boolean}   [req.body.stream]           - Stream SSE output (default: false).
 * @param {boolean}   [req.body.initOnly]         - Create a pending summary row only; no AI call.
 */
export async function POST(req) { ... }
```

### `app/api/generate-slides/route.js`

```js
/**
 * POST /api/generate-slides
 *
 * Submits a slide-generation job to either Alai or 2slides.
 * Returns a `generation_id` the client polls via GET /api/generate-slides/[id].
 *
 * @param {Request} req
 * @param {object}  req.body
 * @param {string}  req.body.summaryText       - Source text for the deck.
 * @param {string}  [req.body.provider]        - "alai" (default) | "2slides".
 * @param {string}  [req.body.summarizeFor]    - Audience role for slide instructions.
 * @param {string}  [req.body.themeId]         - Required for 2slides; optional for Alai.
 * @param {number}  [req.body.maxSlides]       - Target slide count.
 * @param {string}  [req.body.imageStyle]      - Alai image style: "auto"|"realistic"|etc.
 */
export async function POST(req) { ... }
```

### `app/api/improve-ppt/generate/route.js`

```js
/**
 * POST /api/improve-ppt/generate
 *
 * Improves an existing slide deck using an LLM and re-renders via Alai or 2slides.
 * Accepts either JSON body or multipart/form-data (for direct PPTX file upload).
 * Returns a PPTX binary (`Content-Type: application/vnd.openxmlformats-officedocument...`).
 *
 * @param {Request} req
 * @param {object}  req.body
 * @param {string}  req.body.instructions      - User editing instructions.
 * @param {object[]} req.body.slides           - Planned slide array from /api/improve-ppt/plan.
 * @param {string}  [req.body.model]           - LLM label: "Gemini" | "ChatGPT" | "DeepSeek".
 * @param {string}  [req.body.provider]        - PPTX renderer: "alai" (default) | "2slides".
 * @param {boolean} [req.body.additiveImprove] - Preserve original bullets, only append (default: true).
 * @param {string}  [req.body.detailLevel]     - "concise" | "lecture" | "deep".
 * @param {number}  [req.body.documentId]      - Blob-stored source document ID.
 * @param {string}  [req.body.themeId]         - Design template ID (required for 2slides).
 */
export async function POST(req) { ... }
```

**Verify:** `grep -B1 "export async function POST" app/api/summarize/route.js` should show a `*/` closing a JSDoc block on the line immediately above.

---

## Final Checklist

After all steps are complete, run:

```bash
# 1. No FIX comments remain
grep -rn "// FIX" app/api/

# 2. No duplicate Gemini candidate loops
grep -n "seen.add" app/api/summarize/route.js

# 3. Route file sizes have shrunk
wc -l app/api/summarize/route.js
wc -l app/api/improve-ppt/generate/route.js

# 4. New lib files exist
ls lib/llmDispatch.js lib/summarizeStream.js lib/alaiInputBuilder.js lib/resolveEffectiveTheme.js

# 5. Smoke-test the three endpoints still work
# (run your existing integration/e2e tests here)
```

---

## Notes for Copilot

- **Do not change any business logic.** Every step above is a structural move or documentation addition only.
- **Commit after each step.** Each step is independently safe to merge.
- **Steps 2 and 3 touch the same file.** Complete Step 2 fully before starting Step 3.
- **Steps 7 and 8 are independent** of each other and of Steps 1–4. They can be done in any order relative to each other.
- **Step 5 is safe to do at any point** — it is comments only.
