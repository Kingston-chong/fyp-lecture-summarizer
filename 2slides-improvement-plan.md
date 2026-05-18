# 2slides Integration — Fix & Improvement Plan

## Overview

The current 2slides provider integration is functional but significantly under-utilises the API compared to the Alai provider. This plan addresses the identified issues in priority order, from quick fixes to larger feature additions.

---

## Priority 1 — Fix Broken / Missing Core Behaviour

### Fix 1.1 — Wire up the Themes Endpoint for 2slides

**File:** `app/api/themes/route.js`

**Problem:** `GET /api/themes?provider=2slides` returns an empty array. Users cannot browse or select a 2slides theme, yet a `themeId` is *required* to generate slides — making the provider unusable without hardcoding a known ID.

**Fix:** Add a `provider === "2slides"` branch that calls `GET https://2slides.com/api/v1/themes/search` and returns normalised results.

```js
if (provider === "2slides") {
  const query = url.searchParams.get("query") || "";
  const res = await fetch(
    `https://2slides.com/api/v1/themes/search?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}` }, cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ themes: data.themes ?? [] });
}
```

**Acceptance criteria:** The theme picker populates correctly when `provider=2slides` is selected.

---

### Fix 1.2 — Correct Slide Count Mapping

**File:** `app/api/generate-slides/route.js` → `buildTwoSlidesInputText` / `submitTwoSlidesGeneration`

**Problem:** `toSlideRange()` converts `maxSlides` into an Alai-style range string (`"6-10"`, `"11-15"`, etc.) which is then embedded as text in the `inputText` blob. The 2slides API accepts a plain numeric `page` field (0 = auto, 1–100).

**Fix:** Pass `maxSlides` directly as `page` in the payload to `submitTwoSlidesGeneration`, bypassing `toSlideRange()`.

```js
const result = await submitTwoSlidesGeneration({
  inputText: twoSlidesInput,
  themeId,
  page: Number.isFinite(Number(body?.maxSlides)) ? Math.max(0, Number(body.maxSlides)) : 0,
});
```

Update `submitTwoSlidesGeneration` to forward `page` in its request body.

**Acceptance criteria:** Requesting 8 slides produces approximately 8 slides, not a random count.

---

### Fix 1.3 — Surface Preview / PDF URL in Status Response

**File:** `app/api/generate-slides/[id]/route.js`

**Problem:** The 2slides status branch hardcodes `preview_url: null`. The job status response from `pollTwoSlidesGeneration` already contains a `downloadUrl` that can serve as a preview link.

**Fix:** Replace the hardcoded `null` with the available URL:

```js
return NextResponse.json({
  status: "completed",
  download_url: downloadEndpoint,
  remote_download_url: result.downloadUrl,
  preview_url: result.downloadUrl ?? null,   // was hardcoded null
});
```

**Acceptance criteria:** The front-end can render an inline preview for 2slides-generated decks.

---

### Fix 1.4 — Re-fetch Job Status on Every Download (Prevent Stale URL 502s)

**File:** `app/api/generate-slides/[id]/download/route.js`

**Problem:** Download URLs returned by 2slides expire after 1 hour. If the result of `pollTwoSlidesGeneration` is cached anywhere between the status check and the download request, users will hit a 502 when the URL has aged out.

**Fix:** Ensure `pollTwoSlidesGeneration` always makes a live network request and never returns a cached result. Add a comment in the download handler to document this requirement:

```js
// Always re-poll; 2slides download URLs expire after 1 hour.
const result = await pollTwoSlidesGeneration(id); // must NOT use cached data
```

Consider adding a `?t=Date.now()` cache-buster to the upstream fetch inside `pollTwoSlidesGeneration` if the implementation uses any HTTP-level caching.

**Acceptance criteria:** Downloads succeed even when triggered >30 minutes after the status check.

---

## Priority 2 — Structured Parameter Improvements

### Improvement 2.1 — Pass `responseLanguage` as a Proper API Field

**File:** `app/api/generate-slides/route.js`

**Problem:** Language instructions are currently embedded as plain text inside `inputText`. The 2slides API has a dedicated `responseLanguage` field that is more reliable.

**Fix:** Detect the language from `body.responseLanguage` (or derive it from `body.summarizeFor` / locale), map it to a supported code, and pass it as a top-level field:

```js
const result = await submitTwoSlidesGeneration({
  inputText: twoSlidesInput,
  themeId,
  page,
  responseLanguage: body?.responseLanguage || "Auto",
});
```

Supported values: `Auto`, `English`, `Spanish`, `Arabic`, `Portuguese`, `Indonesian`, `Japanese`, `Russian`, `Hindi`, `French`, `German`, `Greek`, `Vietnamese`, `Turkish`, `Thai`, `Polish`, `Italian`, `Korean`, `Simplified Chinese`, `Traditional Chinese`.

**Acceptance criteria:** A deck generated from a French summary is output in French without language instructions being embedded in the content.

---

### Improvement 2.2 — Enforce Recommended Poll Interval

**Files:** Client-side polling logic / `useSlideDecks.js`

**Problem:** The 2slides API documentation recommends polling every 20–30 seconds (generation takes 1–3 minutes). Aggressive polling wastes credits and risks rate limiting.

**Fix:** Add a minimum interval of 20 seconds for 2slides polls, independently of the Alai poll cadence:

```js
const POLL_INTERVAL_MS = provider === "2slides" ? 20_000 : 5_000;
```

**Acceptance criteria:** 2slides status is polled no more than 3 times per minute.

---

## Priority 3 — New Capability: `create-pdf-slides` Path

### Improvement 3.1 — Add "Custom Design" Generation Mode

**Files:** `app/api/generate-slides/route.js`, `submitTwoSlidesGeneration`

**Problem:** Only `/api/v1/slides/generate` (Fast PPT) is used. The `/api/v1/slides/create-pdf-slides` endpoint supports a free-form `designStyle` prompt and produces richer Nano Banana Pro slides.

**Plan:**
1. Add a `twoSlidesMode` field to the POST body (`"fast-ppt"` | `"custom-design"`).
2. When `twoSlidesMode === "custom-design"`, route to `/api/v1/slides/create-pdf-slides` instead.
3. Repurpose `body.slideUserPrompt` as `designStyle` in this mode (e.g. "dark tech aesthetic with bold typography").
4. Always use `mode: "async"` for this endpoint.

```js
const endpoint = twoSlidesMode === "custom-design"
  ? "/api/v1/slides/create-pdf-slides"
  : "/api/v1/slides/generate";

const payload = twoSlidesMode === "custom-design"
  ? { userInput: twoSlidesInput, designStyle: body.slideUserPrompt, page, responseLanguage, mode: "async" }
  : { themeId, userInput: twoSlidesInput, page, responseLanguage, mode: "async" };
```

**Acceptance criteria:** A `twoSlidesMode: "custom-design"` request generates a visually distinct, non-template deck.

---

### Improvement 3.2 — Add "Create Like This" Mode for Document-Based Generation

**Files:** `app/api/generate-slides/route.js`

**Problem:** The app processes uploaded documents but doesn't leverage the document's visual identity when generating slides.

**Plan:**
1. Add a `referenceImageUrl` optional field to the POST body.
2. When provided and `provider === "2slides"`, call `/api/v1/slides/create-like-this`.
3. Surface this in the UI as "Match my document's style" — useful when users upload branded PDFs or reports.

```js
if (body.referenceImageUrl && provider === "2slides") {
  const payload = {
    userInput: twoSlidesInput,
    referenceImageUrl: body.referenceImageUrl,
    page,
    responseLanguage,
    mode: "async",
  };
  // call /api/v1/slides/create-like-this
}
```

**Acceptance criteria:** A deck generated with a reference image visually resembles the reference style.

---

## File Change Summary

| File | Change |
|------|--------|
| `app/api/themes/route.js` | Add 2slides branch — call `/api/v1/themes/search` |
| `app/api/generate-slides/route.js` | Pass `page`, `responseLanguage`; add `twoSlidesMode` routing |
| `app/api/generate-slides/[id]/route.js` | Surface `preview_url` from `downloadUrl` |
| `app/api/generate-slides/[id]/download/route.js` | Document + enforce live re-poll |
| `lib/twoSlidesGenerate.js` | Accept `page`, `responseLanguage`, `designStyle`, `referenceImageUrl`; add endpoint selection |
| Client polling logic | Set 20s minimum poll interval for 2slides |

---

## Out of Scope (This Iteration)

- Voice narration (`/api/v1/slides/generate-narration`) — requires a separate UX flow
- Pages/voices ZIP export (`/api/v1/slides/download-slides-pages-voices`)
- Credit estimation UI for custom-design mode (100–200 credits/slide vs 10 for Fast PPT)
