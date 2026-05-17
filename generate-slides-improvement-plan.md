# Generate Slides — Improvement Plan

## Problem Summary

The ALAI-generated slides are bland because the current integration barely uses the Alai API's
capabilities. Almost all user preferences (theme, slide count, tone, density) are converted into
plain English prose and stuffed into `input_text`, which Alai treats as content — not design
instructions. Meanwhile, the actual structured fields Alai provides (`theme_id`, `slide_range`,
`additional_instructions`, `image_options`) are either unused or missing entirely.

---

## Root Cause Breakdown

| Issue                                             | Location                            | Impact                                      |
| ------------------------------------------------- | ----------------------------------- | ------------------------------------------- |
| All style/role guidance crammed into `input_text` | `buildInstructions()` in `route.js` | Alai ignores design intent in content field |
| `additional_instructions` field never used        | `route.js` payload                  | Correct field for guidance is unused        |
| `theme_id` never sent to Alai                     | `route.js` payload                  | Alai falls back to default bland theme      |
| `maxSlides` sent as prose, not `slide_range` enum | `route.js` payload                  | Slide count not enforced                    |
| `image_options` never set                         | `route.js` payload                  | Image quality/style left to Alai defaults   |
| Alai theme picker not wired in UI                 | `GenerateSlidesModal.jsx`           | Users can't select real Alai themes         |

---

## Improvement 1 — Fix the Payload Structure

**File:** `app/api/generate-slides/route.js`

**Change:** Separate content from instructions, and use the correct Alai API fields.

### Before

```js
const payload = {
  input_text: instructions, // ← mixes content + style guidance
  export_formats: ["link", "ppt"],
  presentation_options: body?.title ? { title: String(body.title) } : undefined,
};
```

### After

```js
const payload = {
  input_text: body.summaryText, // ← raw content only
  additional_instructions: instructions, // ← style, tone, audience guidance
  export_formats: ["link", "ppt"],
  presentation_options: {
    ...(body?.title && { title: String(body.title) }),
    ...(body?.themeId && { theme_id: String(body.themeId) }),
    slide_range: toSlideRange(body?.maxSlides),
  },
  image_options: {
    include_ai_images: true,
    include_web_images: true,
    style: "auto",
  },
};
```

### Add slide range mapper

```js
function toSlideRange(maxSlides) {
  const n = Number.parseInt(maxSlides, 10);
  if (!n || n < 1) return "auto";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  if (n <= 10) return "6-10";
  if (n <= 15) return "11-15";
  if (n <= 20) return "16-20";
  if (n <= 25) return "21-25";
  return "26-50";
}
```

### Strip design fields from `buildInstructions()`

Remove these lines from `buildInstructions()` since they're now handled via structured fields:

- `Preferred Template/Style: ...`
- `Layout density / whitespace: ...`
- `Relative font size preference for body text: ...`
- `Max Slides Limit: ...`

Keep: audience mode, role guidance, tone/text style, fidelity strictness, formatting flags
(highlightDefs, boldKeywords, speakerNotes), and the user's custom prompt.

---

## Improvement 2 — Alai Theme Picker

**Files:** New `app/api/themes/route.js` + update `GenerateSlidesModal.jsx`

**Change:** Add a backend proxy for Alai themes and wire it into the existing theme picker UI.

### New API route: `GET /api/themes?provider=alai`

```js
// app/api/themes/route.js
export async function GET(req) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") || "alai";

  if (provider === "alai") {
    const alaiKey = getAlaiApiKey();
    if (!alaiKey) return NextResponse.json({ themes: [] });

    const res = await fetch("https://slides-api.getalai.com/api/v1/themes", {
      headers: { Authorization: `Bearer ${alaiKey}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ themes: data?.themes || [] });
  }

  return NextResponse.json({ themes: [] });
}
```

### UI changes in `GenerateSlidesModal.jsx`

- When provider is `"alai"`, fetch `/api/themes?provider=alai` on mount
- Populate the theme dropdown with real Alai theme names + UUIDs
- Store the selected UUID in `selectedThemeId` (already wired to the payload)
- Show a fallback message if no themes are returned (e.g. API key not configured)

---

## Improvement 3 — Expose Image Style Options for Alai

**File:** `GenerateSlidesModal.jsx` + `route.js`

**Change:** Add an image style selector in the UI when provider is `alai`.

Alai supports: `auto`, `realistic`, `artistic`, `cartoon`, `three_d`, `custom`

```jsx
// New state
const [imageStyle, setImageStyle] = useState("auto");

// In UI (show only when provider === "alai")
<Dropdown
  label="Image Style"
  value={imageStyle}
  onChange={setImageStyle}
  options={["auto", "realistic", "artistic", "cartoon", "three_d"]}
/>;
```

Pass it through the API call body and use in `route.js`:

```js
image_options: {
  include_ai_images: true,
  include_web_images: true,
  style: body?.imageStyle || "auto",
},
```

---

## Improvement 4 — Vibe Support (Optional / Phase 2)

**Files:** New `app/api/vibes/route.js` + `GenerateSlidesModal.jsx` + `route.js`

Alai's `vibe_id` controls the visual aesthetic (mood, palette, illustration style). This is a
powerful differentiator for creative presentations.

- Add `GET /api/vibes?provider=alai` proxy (same pattern as themes endpoint above, hitting
  `GET https://slides-api.getalai.com/api/v1/vibes`)
- Add a Vibe picker in the UI (optional, collapsed by default — show as "Advanced Styling")
- When a vibe is selected, automatically set `image_options.num_image_variants` to `1`
  (required by Alai when `vibe_id` is set)
- Pass `vibe_id` through the payload

> Note: `num_image_variants > 0` increases credit cost — surface this clearly in the UI.

---

## Improvement 5 — Fix `highlightDefs` Default

**File:** `GenerateSlidesModal.jsx`

The current default is:

```js
const [highlightDefs, setHighlightDefs] = useState(false);
```

But the request in question had `highlightDefs: true`. For Academic/Lecturer mode, definitions
are the primary visual differentiation. Consider defaulting to `true` when `summarizeFor` is
`"lecturer"` or `"student"`:

```js
const [highlightDefs, setHighlightDefs] = useState(
  ["lecturer", "student"].includes(summarizeFor),
);
```

---

## Improvement 6 — Smarter `buildInstructions` for Alai

The current instructions builder produces a flat text blob. For Alai's `additional_instructions`
field, a tighter and more directive format works better:

```
Audience: Lecturer. Academic tone. Strict fidelity to source.
Formatting: Call out important definitions and technical terms on slides.
Slide length: Short summary format.
Text density: Compact. Font size: Normal.
```

This is shorter and cleaner than the current multi-line format, which includes lines Alai has
no way to act on (like font size preference in a prose sentence).

---

## Implementation Order

| Priority | Task                                                                    | Effort  |
| -------- | ----------------------------------------------------------------------- | ------- |
| 🔴 P0    | Fix payload: use `additional_instructions` + `theme_id` + `slide_range` | Small   |
| 🔴 P0    | Add `toSlideRange()` helper                                             | Trivial |
| 🔴 P0    | Strip design fields from `buildInstructions()`                          | Small   |
| 🟠 P1    | Add `GET /api/themes?provider=alai` proxy endpoint                      | Small   |
| 🟠 P1    | Wire Alai themes into theme picker in UI                                | Medium  |
| 🟡 P2    | Add image style selector in UI                                          | Small   |
| 🟡 P2    | Default `highlightDefs` based on role                                   | Trivial |
| 🟢 P3    | Vibe picker + `/api/vibes` proxy                                        | Medium  |
| 🟢 P3    | Tighten `buildInstructions` output format                               | Small   |

---

## Expected Outcome

After P0 + P1 changes:

- Alai receives a proper `theme_id` → slides use the correct colors, fonts, and layout
- Style/audience guidance reaches Alai via the correct field (`additional_instructions`)
- Slide count is enforced via `slide_range` enum rather than ignored prose
- Users can browse and select Alai themes from the existing UI

After P2 + P3 changes:

- Image aesthetic is controllable (realistic vs. artistic vs. cartoon)
- Vibes unlock creative, mood-driven presentations for non-academic use cases
