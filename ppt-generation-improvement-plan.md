# PPT generation improvement plan — Slide2Notes

> **For Cursor agent.** Work through tasks in order. Each task has a
> `Verify` section — run it before moving to the next task.
> Stack: Next.js 14 App Router · Prisma · Vercel Blob · TypeScript/JSX

---

## Context & current architecture

```
User clicks "Generate Slides"
        ↓
GenerateSlidesModal.jsx          ← modal UI (two tabs: Create | Improve)
        ↓
POST /api/generate-slides        ← proxies to Alai only, hardcoded
        ↓
GET  /api/generate-slides/:id    ← polls Alai status
        ↓
GET  /api/generate-slides/:id/download  ← proxies PPTX download
        ↓
POST /api/summary/:id/slide-decks       ← saves deck to Vercel Blob + DB
```

**What currently exists:**

- Alai generation is fully wired end-to-end (submit → poll → preview → download → save)
- 2slides is used only for theme search (`/api/improve-ppt/theme-search`) — there is no 2slides slide generation yet
- `pptxgenjs` is not imported anywhere in the codebase; only 5 stale comment strings remain
- `GenerateSlidesModal.jsx` has a "Create" tab and an "Improve" tab sharing one large file
- `app/components/generateSlides/CreateSlidesForm.jsx` renders all Create-tab options
- `app/components/generateSlides/ui.jsx` holds shared primitives (Dropdown, SectionHead, FieldLabel, etc.)
- `AlaiSlidesPreviewModal.jsx` shows Office Online embed after generation completes

**What this plan adds:**

1. Clean up 5 dead pptxgenjs comment strings
2. Add 2slides as a real generation provider alongside Alai
3. Rebuild `CreateSlidesForm` into the redesigned modal UI (provider picker + clean option groups)
4. Add speaker notes toggle (new option, missing from current API)
5. Wire `GenerateSlidesModal` to route to the correct provider at generation time
6. Persist `provider` field on `SlideDeck` so saved decks show which API made them

---

## Phase 0 — Clean up dead pptxgenjs references (5 min)

### Task 0.1 — Remove stale comments

**Files to edit:**

**`app/components/GenerateSlidesModal.jsx` line ~1288**

```jsx
// BEFORE
using pptxGenJS.

// AFTER
the AI generator will try to match this style.
```

**`app/api/improve-ppt/theme-search/route.js` — 4 occurrences**

Find and replace every instance of these strings:

| Find                                                                  | Replace with                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pptxGenJS-compatible style spec`                                     | `AI-compatible style spec`                                      |
| `a pptxGenJS-compatible style spec: colors, layout type, font style.` | `an AI-compatible style spec: colors, layout type, font style.` |
| `can use it to drive pptxGenJS.`                                      | `can use it to drive the AI generator.`                         |
| `so pptxGenJS can approximate this design.`                           | `so the AI generator can approximate this design.`              |
| `pptxGenJS can't replicate every`                                     | `AI generators can't replicate every`                           |

**Verify:**

```bash
grep -rn "pptxGen\|pptxJS" app/
# Should return 0 results
```

---

## Phase 1 — Add `provider` to Prisma schema (10 min)

The `SlideDeck` model currently only stores `alaiGenerationId`. We need to know which provider generated each deck.

### Task 1.1 — Update `prisma/schema.prisma`

Find the `SlideDeck` model and add two fields:

```prisma
model SlideDeck {
  // ... existing fields ...
  provider          String?  @db.VarChar(32)   // "alai" | "2slides"
  providerDeckId    String?  @db.VarChar(256)  // generation ID from whichever provider
  // keep alaiGenerationId as-is for backwards compatibility — do not remove it
}
```

Run the migration:

```bash
npx prisma migrate dev --name add_slidedeck_provider
npx prisma generate
```

**Verify:**

```bash
npx prisma validate
# exits 0
```

---

## Phase 2 — Add 2slides generation API route (45 min)

2slides has a presentation generation endpoint: `POST https://2slides.com/api/v1/presentations/generate`

The request body takes `{ theme_id, input_text, options }` and returns `{ presentation_id }`.
Status polling is `GET https://2slides.com/api/v1/presentations/:id` which returns `{ status, download_url }`.
Statuses: `pending` | `processing` | `completed` | `failed`.

### Task 2.1 — Create `lib/twoSlidesGenerate.js`

Create `lib/twoSlidesGenerate.js`:

```js
// lib/twoSlidesGenerate.js

const TWOSLIDES_BASE = "https://2slides.com";

/**
 * Submit a new presentation generation job to 2slides.
 * @param {{ inputText: string, themeId?: string, title?: string }} opts
 * @returns {Promise<{ ok: boolean, presentationId?: string, error?: string }>}
 */
export async function submitTwoSlidesGeneration({ inputText, themeId, title }) {
  if (!process.env.TWOSLIDES_API_KEY) {
    return { ok: false, error: "TWOSLIDES_API_KEY is not configured." };
  }

  const body = {
    input_text: inputText,
    ...(themeId ? { theme_id: themeId } : {}),
    ...(title ? { options: { title } } : {}),
  };

  const res = await fetch(`${TWOSLIDES_BASE}/api/v1/presentations/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: data?.message || data?.error || `2slides error ${res.status}`,
    };
  }

  const presentationId = String(data?.presentation_id || data?.id || "").trim();
  if (!presentationId) {
    return { ok: false, error: "2slides returned no presentation ID." };
  }

  return { ok: true, presentationId };
}

/**
 * Poll the status of a 2slides presentation generation job.
 * @param {string} presentationId
 * @returns {Promise<{ status: string, downloadUrl?: string, error?: string }>}
 */
export async function pollTwoSlidesGeneration(presentationId) {
  if (!process.env.TWOSLIDES_API_KEY) {
    return { status: "failed", error: "TWOSLIDES_API_KEY is not configured." };
  }

  const res = await fetch(
    `${TWOSLIDES_BASE}/api/v1/presentations/${encodeURIComponent(presentationId)}`,
    {
      headers: { Authorization: `Bearer ${process.env.TWOSLIDES_API_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      status: "failed",
      error: data?.message || data?.error || `2slides poll error ${res.status}`,
    };
  }

  const status = String(data?.status || "processing").toLowerCase();
  const downloadUrl =
    String(data?.download_url || data?.pptx_url || "").trim() || undefined;

  return { status, downloadUrl };
}
```

**Verify:** File exists and exports `submitTwoSlidesGeneration` and `pollTwoSlidesGeneration`.

---

### Task 2.2 — Update `app/api/generate-slides/route.js` to support both providers

Replace the entire file with the version below. Key changes:

- Accept `provider` field in request body (`"alai"` or `"2slides"`, default `"alai"`)
- Route to the correct upstream API
- Return `{ generation_id, provider }` so the polling route knows which API to call

```js
// app/api/generate-slides/route.js
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/apiAuth";
import { getRoleProfile, normalizeSummarizeRole } from "@/lib/roleProfiles";
import { submitTwoSlidesGeneration } from "@/lib/twoSlidesGenerate";

const parsedMaxPrompt = Number.parseInt(
  process.env.SLIDES_MAX_USER_PROMPT_CHARS || "4000",
  10,
);
const MAX_SLIDE_USER_PROMPT_CHARS =
  Number.isFinite(parsedMaxPrompt) && parsedMaxPrompt > 0
    ? parsedMaxPrompt
    : 4000;

/** Build the instruction string sent to whichever provider. */
function buildInstructions(body, roleProfile, summarizeRole) {
  let instructions = `Create a presentation based on this summary text.\n`;
  instructions += `Audience Mode: ${roleProfile.label}\n`;
  instructions += `Role guidance:\n${roleProfile.slideInstructions
    .map((line) => `- ${line}`)
    .join("\n")}\n`;

  if (body.title) instructions += `Title: ${body.title}\n`;
  if (body.slideLength) instructions += `Length/Detail: ${body.slideLength}\n`;
  if (body.template)
    instructions += `Preferred Template/Style: ${body.template}\n`;
  if (body.textStyle) instructions += `Tone/Text Style: ${body.textStyle}\n`;
  if (body.maxSlides) instructions += `Max Slides Limit: ${body.maxSlides}\n`;
  if (body.strictness)
    instructions += `Fidelity to source summary: ${String(body.strictness)}\n`;

  if (body.highlightDefs === true)
    instructions +=
      "Formatting: Call out important definitions and technical terms on slides.\n";
  if (body.boldKeywords === true)
    instructions +=
      "Formatting: Bold or otherwise emphasize essential keywords.\n";
  if (body.speakerNotes === true)
    instructions +=
      "Include detailed speaker notes for every slide (minimum 2 sentences each).\n";

  const bl = String(body?.bulletLimit ?? "").trim();
  if (bl)
    instructions += `Bullet budget: aim for at most ${bl} bullet points per slide.\n`;
  if (body.fontSize)
    instructions += `Relative font size preference for body text: ${String(body.fontSize)}\n`;
  if (body.textDensity)
    instructions += `Layout density / whitespace: ${String(body.textDensity)}\n`;

  const userExtra = String(body?.slideUserPrompt || body?.userPrompt || "")
    .trim()
    .slice(0, MAX_SLIDE_USER_PROMPT_CHARS);
  if (userExtra)
    instructions += `\nAdditional instructions from the user:\n${userExtra}\n`;

  instructions += `\nSummary:\n${body.summaryText}`;
  return instructions;
}

export async function POST(req) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const summaryText = String(body?.summaryText || "").trim();
    if (!summaryText) {
      return NextResponse.json(
        { error: "Summary text is required" },
        { status: 400 },
      );
    }

    const provider = String(body?.provider || "alai").toLowerCase();
    if (!["alai", "2slides"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const summarizeRole = normalizeSummarizeRole(body?.summarizeFor);
    const roleProfile = getRoleProfile(summarizeRole);
    const instructions = buildInstructions(
      { ...body, summaryText },
      roleProfile,
      summarizeRole,
    );

    // ── Route to Alai ────────────────────────────────────────────────────────
    if (provider === "alai") {
      if (!process.env.ALAI_API_KEY) {
        return NextResponse.json(
          { error: "ALAI_API_KEY is not configured on the server." },
          { status: 500 },
        );
      }

      const payload = {
        input_text: instructions,
        export_formats: ["ppt", "link", "pdf"],
        presentation_options: body?.title
          ? { title: String(body.title) }
          : undefined,
      };

      const res = await fetch(
        "https://slides-api.getalai.com/api/v1/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ALAI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error || data.message || "Alai generation failed" },
          { status: res.status },
        );
      }

      const generationId = data.id || data.generation_id;
      return NextResponse.json({
        generation_id: generationId,
        provider: "alai",
      });
    }

    // ── Route to 2slides ─────────────────────────────────────────────────────
    const result = await submitTwoSlidesGeneration({
      inputText: instructions,
      themeId: body?.themeId || undefined,
      title: body?.title || undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      generation_id: result.presentationId,
      provider: "2slides",
    });
  } catch (err) {
    console.error("generate-slides POST:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
```

**Verify:** `POST /api/generate-slides` with `{ provider: "alai", summaryText: "..." }` still returns `{ generation_id, provider: "alai" }`.

---

### Task 2.3 — Update `app/api/generate-slides/[id]/route.js` to support both providers

The polling route currently calls Alai unconditionally. Update it to accept a `?provider=` query param and route accordingly.

At the top of the GET handler, add:

```js
const url = new URL(req.url);
const provider = String(
  url.searchParams.get("provider") || "alai",
).toLowerCase();
```

Then branch:

```js
// ── 2slides polling branch ───────────────────────────────────────
if (provider === "2slides") {
  const { pollTwoSlidesGeneration } = await import("@/lib/twoSlidesGenerate");
  const result = await pollTwoSlidesGeneration(id);

  if (result.status === "failed") {
    return NextResponse.json(
      { status: "failed", error: result.error || "2slides generation failed." },
      { status: 500 },
    );
  }

  if (result.status === "completed" && result.downloadUrl) {
    const base = new URL(req.url);
    const downloadEndpoint = `${base.origin}/api/generate-slides/${encodeURIComponent(id)}/download?provider=2slides`;
    return NextResponse.json({
      status: "completed",
      download_url: downloadEndpoint,
      remote_download_url: result.downloadUrl,
      preview_url: null, // 2slides does not return a live preview URL
    });
  }

  return NextResponse.json({ status: result.status, progress: 0 });
}
// ── (existing Alai branch follows unchanged) ──────────────────────
```

**Verify:** `GET /api/generate-slides/test-id?provider=2slides` returns a valid JSON response (will return `failed` or `processing` for a fake ID — that is fine).

---

### Task 2.4 — Update `app/api/generate-slides/[id]/download/route.js`

The download route proxies Alai's signed URL. It needs to handle 2slides too.

At the top of the handler, read the provider:

```js
const url = new URL(req.url);
const provider = String(
  url.searchParams.get("provider") || "alai",
).toLowerCase();
```

Add a 2slides branch before the existing Alai block:

```js
if (provider === "2slides") {
  if (!process.env.TWOSLIDES_API_KEY) {
    return new Response(
      JSON.stringify({ error: "TWOSLIDES_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { pollTwoSlidesGeneration } = await import("@/lib/twoSlidesGenerate");
  const result = await pollTwoSlidesGeneration(id);

  if (result.status !== "completed" || !result.downloadUrl) {
    return new Response(
      JSON.stringify({ error: `Not ready (status: ${result.status})` }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const fileRes = await fetch(result.downloadUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to download PPTX from 2slides." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  // (same filename logic as the existing Alai block below)
  const titleParam = (url.searchParams.get("title") || "presentation").trim();
  const safeBase =
    titleParam
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "presentation";

  const headers = new Headers();
  headers.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  headers.set("Content-Disposition", `attachment; filename="${safeBase}.pptx"`);
  const len = fileRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new Response(fileRes.body, { status: 200, headers });
}
```

---

### Task 2.5 — Update `app/api/summary/[id]/slide-decks/route.js` POST to accept `provider`

The save endpoint currently only accepts `alaiGenerationId`. Add support for `provider` and `providerDeckId`.

In the POST handler, after parsing `alaiGenerationId`:

```js
const provider = String(body?.provider || "alai").toLowerCase();
const providerDeckId = String(
  body?.providerDeckId || alaiGenerationId || "",
).trim();
```

In the `prisma.slideDeck.create` call, add the new fields:

```js
data: {
  userId: user.id,
  summaryId,
  title,
  alaiGenerationId: alaiGenerationId.slice(0, 128) || null,
  provider: provider.slice(0, 32),
  providerDeckId: providerDeckId.slice(0, 256),
  pptxUrl: storedPptxUrl,
  pdfUrl: storedPdfUrl,
},
```

For 2slides decks, the PPTX download URL comes from the `download_url` returned by the polling endpoint — no Alai fetch needed. Add this branch before the existing Alai download logic:

```js
// 2slides: download_url is already a direct PPTX link
if (provider === "2slides") {
  const remotePptxUrl = String(body?.remotePptxUrl || "").trim();
  if (!/^https?:\/\//i.test(remotePptxUrl)) {
    return NextResponse.json(
      { error: "remotePptxUrl is required for 2slides decks" },
      { status: 400 },
    );
  }
  dl = await downloadPptxBuffer(remotePptxUrl);
}
```

---

## Phase 3 — Rebuild `CreateSlidesForm.jsx` (45 min)

Replace `app/components/generateSlides/CreateSlidesForm.jsx` with the redesigned version.

### Task 3.1 — Add `provider` and `speakerNotes` to `GenerateSlidesModal.jsx` state

Open `app/components/GenerateSlidesModal.jsx`. Add two new state variables alongside the other `useState` declarations:

```jsx
const [provider, setProvider] = useState("alai"); // "alai" | "2slides"
const [speakerNotes, setSpeakerNotes] = useState(false);
```

Pass both down to `CreateSlidesForm`:

```jsx
<CreateSlidesForm
  // ... existing props ...
  provider={provider}
  setProvider={setProvider}
  speakerNotes={speakerNotes}
  setSpeakerNotes={setSpeakerNotes}
/>
```

---

### Task 3.2 — Pass `provider` and `speakerNotes` to the generate API call

In `GenerateSlidesModal.jsx`, find the `fetch("/api/generate-slides", ...)` call (around line 344). Add `provider` and `speakerNotes` to the request body:

```js
const res = await fetch("/api/generate-slides", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    // ... existing fields ...
    provider,
    speakerNotes,
  }),
});
```

Also update the polling URL to pass `provider`:

```js
const pollRes = await fetch(
  `/api/generate-slides/${genId}?provider=${encodeURIComponent(provider)}`,
);
```

And update the download URL similarly:

```js
const downloadUrl = `${base.origin}/api/generate-slides/${encodeURIComponent(id)}/download?provider=${provider}&title=${...}`;
```

And when saving the deck to `/api/summary/:id/slide-decks`, include:

```js
body: JSON.stringify({
  alaiGenerationId: genId,   // keep for Alai backwards compat
  provider,
  providerDeckId: genId,
  remotePptxUrl: ...,
  title: ...,
})
```

---

### Task 3.3 — Rewrite `CreateSlidesForm.jsx`

Replace the full file content with the redesigned form. The new form has these sections in order:

1. **Provider picker** — two option cards (Alai / 2slides) with a brief capability line each
2. **Basic options row** — title input + max slides input side by side
3. **Slide length** — pill selector: Short / Standard / Detailed
4. **Tone** — pill selector: Academic / Professional / Simple / Technical
5. **Fidelity** — pill selector: Strict / Flexible, with a one-line explainer
6. **Formatting extras** — three checkboxes: Highlight definitions · Bold keywords · Add speaker notes
7. **Extra instructions** — small textarea (existing `slideUserPrompt`), keep quick-preset chips above it
8. **Advanced section** (collapsed by default, toggled by a chevron button labeled "Advanced options"):
   - Template style dropdown
   - Font size dropdown
   - Text density dropdown
   - Bullet limit input

```jsx
"use client";

import { useState } from "react";
import { FieldLabel, SectionHead, Divider } from "./ui.jsx";

const PILL_ROW = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 12,
};

function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: "5px 13px",
        borderRadius: 99,
        border: active
          ? "2px solid #818cf8"
          : "1px solid rgba(255,255,255,.18)",
        background: "transparent",
        color: active ? "#a5b4fc" : "rgba(255,255,255,.45)",
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

function ProviderCard({ id, label, desc, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        border: selected
          ? "2px solid #818cf8"
          : "1px solid rgba(255,255,255,.18)",
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "border-color .15s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>
          {label}
        </span>
        {selected && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 7px",
              borderRadius: 99,
              background: "rgba(129,140,248,.2)",
              color: "#a5b4fc",
              fontWeight: 500,
            }}
          >
            selected
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,.38)" }}>
        {desc}
      </p>
    </div>
  );
}

export default function CreateSlidesForm({
  // provider
  provider,
  setProvider,
  // basic
  title,
  setTitle,
  maxSlides,
  setMaxSlides,
  slideLength,
  setSlideLength,
  textStyle,
  setTextStyle,
  strictness,
  setStrictness,
  // formatting extras
  highlightDefs,
  setHighlightDefs,
  boldKeywords,
  setBoldKeywords,
  speakerNotes,
  setSpeakerNotes,
  // instructions
  slideUserPrompt,
  setSlideUserPrompt,
  quickInstructionPresets,
  applyQuickInstruction,
  scrollQuickRequests,
  quickRequestsRef,
  // advanced
  template,
  setTemplate,
  fontSize,
  setFontSize,
  textDensity,
  setTextDensity,
  bulletLimit,
  setBulletLimit,
  // status
  generateErr,
  generateProgress,
  archiveNote,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <>
      {/* ── Provider picker ─────────────────────────────────── */}
      <div style={{ gridColumn: "1 / -1", marginBottom: 4 }}>
        <SectionHead>Generator</SectionHead>
        <div style={{ display: "flex", gap: 8 }}>
          <ProviderCard
            id="alai"
            label="Alai"
            desc="AI-designed slides, in-browser preview before download"
            selected={provider === "alai"}
            onClick={() => setProvider("alai")}
          />
          <ProviderCard
            id="2slides"
            label="2slides"
            desc="Template-based generation, fast output"
            selected={provider === "2slides"}
            onClick={() => setProvider("2slides")}
          />
        </div>
      </div>

      {/* ── Two-column layout below provider picker ──────────── */}
      <div className="col-left">
        <SectionHead>Basics</SectionHead>
        <FieldLabel>Presentation title (optional)</FieldLabel>
        <input
          className="txt-inp"
          placeholder="Auto from summary…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <FieldLabel style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
            Max slides (optional):
          </FieldLabel>
          <input
            className="num-inp"
            type="number"
            min={3}
            max={40}
            placeholder="Auto"
            value={maxSlides}
            onChange={(e) => setMaxSlides(e.target.value)}
          />
        </div>

        <Divider />
        <SectionHead>Slide length</SectionHead>
        <div style={PILL_ROW}>
          {["Short (summary)", "Medium (lecture-ready)", "Long (detailed)"].map(
            (opt) => (
              <Pill
                key={opt}
                label={opt}
                active={slideLength === opt}
                onClick={() => setSlideLength(opt)}
              />
            ),
          )}
        </div>

        <SectionHead>Tone</SectionHead>
        <div style={PILL_ROW}>
          {["Academic", "Professional", "Simple", "Technical"].map((opt) => (
            <Pill
              key={opt}
              label={opt}
              active={textStyle === opt}
              onClick={() => setTextStyle(opt)}
            />
          ))}
        </div>

        <SectionHead>Fidelity to summary</SectionHead>
        <div style={PILL_ROW}>
          {["Strict", "Flexible"].map((opt) => (
            <Pill
              key={opt}
              label={opt}
              active={strictness === opt}
              onClick={() => setStrictness(opt)}
            />
          ))}
        </div>
        <FieldLabel style={{ marginTop: -6, marginBottom: 12 }}>
          Strict = slides only use what's in the summary. Flexible = AI may add
          relevant context.
        </FieldLabel>
      </div>

      <div className="col-right">
        <SectionHead>Formatting extras</SectionHead>
        {[
          {
            label: "Highlight key definitions",
            val: highlightDefs,
            set: setHighlightDefs,
          },
          {
            label: "Bold important keywords",
            val: boldKeywords,
            set: setBoldKeywords,
          },
          {
            label: "Add speaker notes",
            val: speakerNotes,
            set: setSpeakerNotes,
          },
        ].map(({ label, val, set }) => (
          <label key={label} className="chk-row" onClick={() => set((v) => !v)}>
            <div className={`chk-box ${val ? "on" : ""}`}>
              {val && <span className="chk-tick">✓</span>}
            </div>
            {label}
          </label>
        ))}

        <Divider />

        <SectionHead>Extra instructions (optional)</SectionHead>
        <div className="quick-requests-wrap">
          <button
            type="button"
            className="quick-requests-nav"
            onClick={() => scrollQuickRequests("left")}
          >
            ‹
          </button>
          <div className="quick-requests" ref={quickRequestsRef}>
            {quickInstructionPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="quick-request-chip"
                onClick={() => applyQuickInstruction(preset)}
                title={preset}
              >
                {preset}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quick-requests-nav"
            onClick={() => scrollQuickRequests("right")}
          >
            ›
          </button>
        </div>
        <textarea
          className="create-prompt-area"
          rows={3}
          maxLength={4000}
          placeholder='e.g. "focus on diagrams", "add a recap slide at the end", "assume first-year students"'
          value={slideUserPrompt}
          onChange={(e) => setSlideUserPrompt(e.target.value)}
        />
        <div className="create-prompt-hint">
          {slideUserPrompt.length} / 4000
        </div>

        <Divider />

        {/* ── Advanced toggle ─────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,.45)",
            fontSize: 11.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            marginBottom: advancedOpen ? 10 : 0,
          }}
        >
          <span
            style={{
              transform: advancedOpen ? "rotate(90deg)" : "none",
              display: "inline-block",
              transition: "transform .15s",
            }}
          >
            ›
          </span>
          Advanced options
        </button>

        {advancedOpen && (
          <>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <FieldLabel>Template:</FieldLabel>
                <select
                  className="txt-inp"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  style={{ width: 110 }}
                >
                  {[
                    "Academic",
                    "Professional",
                    "Creative",
                    "Minimal",
                    "Corporate",
                  ].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Font size:</FieldLabel>
                <select
                  className="txt-inp"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  style={{ width: 90 }}
                >
                  {["Small", "Normal", "Large"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Text density:</FieldLabel>
                <select
                  className="txt-inp"
                  value={textDensity}
                  onChange={(e) => setTextDensity(e.target.value)}
                  style={{ width: 100 }}
                >
                  {["Compact", "Balanced", "Spacious"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Bullet limit/slide:</FieldLabel>
                <input
                  className="num-inp"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="—"
                  value={bulletLimit}
                  onChange={(e) => setBulletLimit(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {generateErr && (
          <div className="improve-err" style={{ marginTop: 12 }}>
            {generateErr}
          </div>
        )}
        {generateProgress && (
          <div style={{ fontSize: 11.5, color: "#a5b4fc", marginTop: 12 }}>
            {generateProgress}
          </div>
        )}
        {archiveNote && <div className="archive-note">{archiveNote}</div>}
      </div>
    </>
  );
}
```

**Verify:** Open the Generate Slides modal — the provider cards appear at the top, the three main option groups are visible without scrolling, and the Advanced section is hidden by default behind the toggle.

---

## Phase 4 — 2slides preview handling (20 min)

2slides does not return a live browser preview URL. Handle this gracefully in the modal.

### Task 4.1 — Suppress preview modal for 2slides, go straight to download

In `GenerateSlidesModal.jsx`, find where `setAlaiPreviewOpen(true)` is called after polling completes. Wrap it:

```jsx
if (provider === "alai" && previewUrl) {
  setAlaiPreviewOpen(true);
  setAlaiPreviewUrl(previewUrl);
  setAlaiRemotePptUrl(remotePptxUrl);
} else {
  // 2slides or Alai without preview — offer direct download
  setGenerateProgress("Slides are ready. Downloading…");
  // trigger the download directly
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${safeFilename}.pptx`;
  a.click();
}
```

### Task 4.2 — Show provider badge in `AlaiSlidesPreviewModal.jsx`

In `AlaiSlidesPreviewModal.jsx`, update the `subtitle` prop handling to accept an optional `provider` prop and show a small badge in the header:

```jsx
// Add to props:
provider = "alai",

// In the header JSX, beside the title:
{provider === "2slides" && (
  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(99,153,34,.2)", color: "#97c459", marginLeft: 8 }}>
    2slides
  </span>
)}
{provider === "alai" && (
  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(129,140,248,.2)", color: "#a5b4fc", marginLeft: 8 }}>
    Alai
  </span>
)}
```

---

## Phase 5 — Final cleanup (15 min)

### Task 5.1 — Remove `aiModel` from the Create tab

The `aiModel` dropdown (ChatGPT / DeepSeek / Gemini) in `CreateSlidesForm` was a remnant of the pptxgenjs era — it controlled which LLM was used to write slide content before sending to a renderer. Now the provider (Alai or 2slides) handles everything end-to-end; this dropdown has no effect on either API.

In `GenerateSlidesModal.jsx`:

- Remove the `aiModel` / `setAiModel` state variable (or keep it only for the Improve tab if it's still used there — check before deleting)
- Remove the `aiModel` prop from `CreateSlidesForm`

In `CreateSlidesForm.jsx`:

- Remove the "AI model" dropdown entirely (the new form above doesn't include it)

**Check before deleting:** `aiModel` is also used in the Improve tab (improve-ppt flow). If so, keep the state variable in `GenerateSlidesModal.jsx` but simply don't pass it to `CreateSlidesForm` anymore.

### Task 5.2 — Update `.env.example` (or wherever env vars are documented)

Add the following entry if not already present:

```
# Used for 2slides theme search AND slide generation
TWOSLIDES_API_KEY=your_key_here

# Used for Alai slide generation
ALAI_API_KEY=your_key_here
```

### Task 5.3 — Update the hint text in `CreateSlidesForm`

The existing hint reads:

> "Slides are generated by Alai from your summary and the options here."

Replace with:

> "Slides are generated by the selected provider from your summary. Use the Improve tab to add images to an existing deck."

---

## Completion checklist

| Phase | Task                                                             | Done |
| ----- | ---------------------------------------------------------------- | ---- |
| 0     | 5 pptxgenjs comment strings removed                              | ☐    |
| 1     | `provider` + `providerDeckId` added to `SlideDeck` schema        | ☐    |
| 1     | Migration run and Prisma client regenerated                      | ☐    |
| 2     | `lib/twoSlidesGenerate.js` created                               | ☐    |
| 2     | `generate-slides/route.js` routes to both providers              | ☐    |
| 2     | `generate-slides/[id]/route.js` polls both providers             | ☐    |
| 2     | `generate-slides/[id]/download/route.js` downloads from both     | ☐    |
| 2     | `slide-decks` save route accepts `provider` + `providerDeckId`   | ☐    |
| 3     | `provider` + `speakerNotes` state added to `GenerateSlidesModal` | ☐    |
| 3     | `provider` + `speakerNotes` sent in generate API call            | ☐    |
| 3     | `CreateSlidesForm.jsx` rewritten with new layout                 | ☐    |
| 4     | 2slides skips preview modal, triggers direct download            | ☐    |
| 4     | Provider badge shown in `AlaiSlidesPreviewModal`                 | ☐    |
| 5     | `aiModel` removed from Create tab only                           | ☐    |
| 5     | `.env.example` updated                                           | ☐    |
| 5     | Hint text updated in `CreateSlidesForm`                          | ☐    |

---

## Files touched summary

| File                                                 | Change type                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `app/components/GenerateSlidesModal.jsx`             | Add `provider`, `speakerNotes` state; update API calls                |
| `app/components/generateSlides/CreateSlidesForm.jsx` | Full rewrite                                                          |
| `app/components/AlaiSlidesPreviewModal.jsx`          | Add `provider` badge prop                                             |
| `app/api/generate-slides/route.js`                   | Add provider routing, extract `buildInstructions`, add `speakerNotes` |
| `app/api/generate-slides/[id]/route.js`              | Add `?provider=` param, 2slides polling branch                        |
| `app/api/generate-slides/[id]/download/route.js`     | Add `?provider=` param, 2slides download branch                       |
| `app/api/summary/[id]/slide-decks/route.js`          | Accept `provider`, `providerDeckId`; 2slides PPTX download            |
| `app/api/improve-ppt/theme-search/route.js`          | Comment cleanup only                                                  |
| `lib/twoSlidesGenerate.js`                           | New file                                                              |
| `prisma/schema.prisma`                               | Add `provider`, `providerDeckId` to `SlideDeck`                       |
