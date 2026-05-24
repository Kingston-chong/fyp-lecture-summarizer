# OCR Feature Plan — Image Text Detection in PPTX / PDF

## Problem

The current parse pipeline (`/api/improve-ppt/parse` → `parsePptxBufferToSlides` / `parsePdfBufferToSlides` in `@/lib/improvePptParse`) extracts text only from proper text-layer elements. Any text embedded **inside images** on a slide — screenshots, scanned pages, diagrams with labels, infographic callouts — is silently dropped. The LLM in the improve/generate pipeline never sees it.

---

## Goal

For each slide in a PPTX or PDF, detect whether it contains image-embedded text and, if so, merge that text into the slide's `lines` / `notes` fields before the data reaches the LLM.

---

## Approach: Vision-based OCR via existing LLM infrastructure

The codebase already calls a vision-capable LLM in `theme-search/route.js` (passing base64 images to `runChat`). We reuse the exact same pattern — no new OCR library or third-party service needed.

The flow per slide:

```
Slide buffer (PPTX/PDF)
  → render slide to PNG (LibreOffice headless or pdf2pic)
  → send PNG as base64 to runChat (vision prompt)
  → LLM returns extracted text
  → merge into slide.lines / slide.notes
```

This runs only when the structural parser finds a slide with **no text** (or very little text) compared to a rendered version that clearly contains visual content.

---

## Architecture

### New files to create

```
lib/
  ocrSlide.js              # Core: render a single slide → base64, call LLM vision, return text
  ocrPptxSlides.js         # PPTX: extract per-slide images using pptx2img or LibreOffice
  ocrPdfSlides.js          # PDF:  render pages to PNG using pdf2pic or pdfjs-dist canvas
  ocrMerge.js              # Merge OCR text into the existing slides[] array
```

### Files to modify

```
lib/improvePptParse.js        # Add OCR post-pass after structural parse
app/api/improve-ppt/parse/route.js   # Pass ocr=true flag through from client
app/dashboard/page.jsx        # (optional) UI toggle — "Deep scan images"
```

---

## Step-by-step Implementation

### Step 1 — Render slides to images

**PPTX** — Use LibreOffice headless (already available in the Vercel/server environment via the existing `scripts/office/soffice.py` wrapper referenced in the codebase) to convert the PPTX to a PDF, then render each PDF page to PNG via `pdf2pic`.

```js
// lib/ocrPptxSlides.js
import { execFile } from "child_process";
import { promisify } from "util";
import { fromBuffer } from "pdf2pic";
import fs from "fs/promises";
import os from "os";
import path from "path";

const exec = promisify(execFile);

/**
 * Render each slide of a PPTX buffer to a PNG base64 string.
 * Returns string[] — one entry per slide, in order.
 */
export async function pptxSlidesToBase64Images(pptxBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-pptx-"));
  const pptxPath = path.join(tmpDir, "input.pptx");
  const pdfPath = path.join(tmpDir, "input.pdf");

  await fs.writeFile(pptxPath, pptxBuffer);

  // Convert PPTX → PDF via LibreOffice headless
  await exec("soffice", [
    "--headless", "--convert-to", "pdf",
    "--outdir", tmpDir, pptxPath,
  ]);

  const pdfBuffer = await fs.readFile(pdfPath);
  return pdfBufferToBase64Images(pdfBuffer);
}
```

**PDF** — Render directly via `pdf2pic`:

```js
// lib/ocrPdfSlides.js
import { fromBuffer } from "pdf2pic";

export async function pdfBufferToBase64Images(pdfBuffer) {
  const converter = fromBuffer(pdfBuffer, {
    density: 150,        // 150 DPI — good quality, reasonable size
    format: "png",
    width: 1280,
    height: 720,
  });

  // pdf2pic pageCount comes from the buffer metadata
  const { pageCount } = await converter.bulk(-1, { responseType: "base64" });
  // Returns [{ base64: "..." }, ...]
  return pageCount.map((p) => p.base64);
}
```

**Dependency to add:**

```bash
npm install pdf2pic
# pdf2pic requires graphicsmagick + ghostscript on the server:
# apt-get install -y graphicsmagick ghostscript
```

---

### Step 2 — Vision OCR per slide

Reuse the exact base64 → `runChat` pattern from `theme-search/route.js`:

```js
// lib/ocrSlide.js
import { runChat } from "@/lib/llmServer";

const SYSTEM = "You are an OCR assistant. Output only the extracted text, nothing else.";

const PROMPT = `Extract ALL text visible in this slide image.
Include: titles, bullet points, labels, captions, diagram annotations, table content, footer text.
Exclude: decorative shapes with no readable text.
Output plain text only — no JSON, no markdown, no commentary.
If there is no readable text, output exactly: [no text]`;

/**
 * @param {string} modelKey  - e.g. "gemini-1.5-flash"
 * @param {string} base64Png - raw base64, no data URL prefix
 * @returns {Promise<string>} extracted text, or "" if none
 */
export async function ocrSlideImage(modelKey, base64Png) {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64Png },
        },
        { type: "text", text: PROMPT },
      ],
    },
  ];

  const raw = await runChat(modelKey, null, SYSTEM, messages, { maxTokens: 1024 });
  const text = (raw || "").trim();
  return text === "[no text]" ? "" : text;
}
```

---

### Step 3 — Merge OCR text into slide objects

```js
// lib/ocrMerge.js

/**
 * Merge OCR-extracted text into the parsed slides array.
 * OCR text is appended to slide.lines only if it adds new content
 * not already captured by the structural parser.
 *
 * @param {object[]} slides     - output of parsePptxBufferToSlides / parsePdfBufferToSlides
 * @param {string[]} ocrTexts   - one OCR string per slide, same order
 * @returns {object[]}          - enriched slides array
 */
export function mergeOcrIntoSlides(slides, ocrTexts) {
  return slides.map((slide, i) => {
    const ocr = (ocrTexts[i] || "").trim();
    if (!ocr) return slide;

    // Deduplicate: skip OCR lines already present in structured text
    const existingText = [
      slide.title || "",
      ...(slide.lines || []),
      slide.notes || "",
    ]
      .join(" ")
      .toLowerCase();

    const newLines = ocr
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !existingText.includes(l.toLowerCase()));

    if (newLines.length === 0) return slide;

    return {
      ...slide,
      lines: [...(slide.lines || []), ...newLines],
      // Flag so the LLM prompt can mention these came from image OCR
      _ocrLines: newLines,
    };
  });
}
```

---

### Step 4 — Wire into `improvePptParse.js`

Add an optional `ocr` parameter to both parse functions:

```js
// lib/improvePptParse.js  (additions only)
import { pptxSlidesToBase64Images } from "./ocrPptxSlides";
import { pdfBufferToBase64Images }  from "./ocrPdfSlides";
import { ocrSlideImage }            from "./ocrSlide";
import { mergeOcrIntoSlides }       from "./ocrMerge";

/**
 * @param {Buffer} buf
 * @param {{ ocr?: boolean, modelKey?: string }} opts
 */
export async function parsePptxBufferToSlides(buf, opts = {}) {
  // existing structural parse (unchanged)
  const slides = await _existingPptxParse(buf);

  if (!opts.ocr) return slides;

  const images = await pptxSlidesToBase64Images(buf);
  const modelKey = opts.modelKey || "gemini-1.5-flash";
  const ocrTexts = await Promise.all(images.map((img) => ocrSlideImage(modelKey, img)));

  return mergeOcrIntoSlides(slides, ocrTexts);
}

// Same pattern for parsePdfBufferToSlides
```

---

### Step 5 — Expose via the parse API route

```js
// app/api/improve-ppt/parse/route.js  (addition)

// After reading body / file, before calling parse:
const enableOcr = json?.ocr === true || form.get("ocr") === "true";
const modelKey  = String(json?.ocrModel || "gemini-1.5-flash");

const slides = isPdf
  ? await parsePdfBufferToSlides(buf,  { ocr: enableOcr, modelKey })
  : await parsePptxBufferToSlides(buf, { ocr: enableOcr, modelKey });
```

---

### Step 6 — (Optional) UI toggle in `dashboard/page.jsx`

Add a checkbox under the file selector in the Improve panel:

```jsx
// Near the improve-slot-row in dashboard/page.jsx
const [enableOcr, setEnableOcr] = useState(false);

// In the parse fetch call:
formData.append("ocr", enableOcr ? "true" : "false");

// UI:
<label className="improve-ocr-toggle">
  <input
    type="checkbox"
    checked={enableOcr}
    onChange={(e) => setEnableOcr(e.target.checked)}
  />
  Deep scan images (OCR) — slower
</label>
```

---

## Data Flow Summary

```
User uploads PPTX/PDF
        │
        ▼
POST /api/improve-ppt/parse  { ocr: true }
        │
        ├─ parsePptxBufferToSlides(buf)   ← structural parse (existing, unchanged)
        │       └─ slides[]  { index, title, lines[], notes }
        │
        ├─ pptxSlidesToBase64Images(buf)  ← NEW: LibreOffice → pdf2pic
        │       └─ base64Png[]
        │
        ├─ ocrSlideImage(modelKey, png)   ← NEW: vision LLM call per slide
        │       └─ ocrText[]
        │
        └─ mergeOcrIntoSlides(slides, ocrText)  ← NEW: deduplicated merge
                └─ enrichedSlides[]

        ▼
POST /api/improve-ppt/generate  { slides: enrichedSlides[] }
        │
        └─ LLM sees full slide content including image-embedded text
```

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| Render latency (LibreOffice) | Run LibreOffice once per file, not per slide; reuse PDF output |
| Vision API cost (N slides × LLM call) | Only OCR slides where structural text is below a threshold (e.g. `lines.length < 2`) |
| Vercel timeout | OCR runs server-side; set `export const maxDuration = 60` in the parse route (already done in generate route) |
| Large presentations | Cap OCR at first 20 slides; log a warning for the rest |
| Duplicate noise | `ocrMerge.js` deduplicates against existing structured text before merging |

---

## Recommended Model for OCR

The vision call in `theme-search` already uses whichever `modelKey` is selected by the user. For OCR, prefer:

- **`gemini-1.5-flash`** — fast, cheap, strong OCR, already in the model picker
- **`gpt-4o`** — highest accuracy for dense diagrams and tables
- Avoid DeepSeek for vision — weaker on English slide OCR

---

## Files Changed / Created Summary

| File | Action |
|---|---|
| `lib/ocrSlide.js` | **Create** — vision LLM call |
| `lib/ocrPptxSlides.js` | **Create** — PPTX → PNG renderer |
| `lib/ocrPdfSlides.js` | **Create** — PDF → PNG renderer |
| `lib/ocrMerge.js` | **Create** — dedup + merge |
| `lib/improvePptParse.js` | **Modify** — add `ocr` option to both parse functions |
| `app/api/improve-ppt/parse/route.js` | **Modify** — read `ocr` flag, pass to parse |
| `app/dashboard/page.jsx` | **Modify** (optional) — UI toggle |
| `package.json` | **Modify** — add `pdf2pic` |

---

## Out of Scope (for now)

- Caching OCR results per document (could be added to the `Document` Prisma model as a `ocrCache` JSON field)
- Table structure preservation (OCR extracts raw text; structured table parsing would need a separate pass)
- Handwriting recognition (out of scope for slide decks)
