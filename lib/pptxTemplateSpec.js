/**
 * pptxTemplateSpec.js
 *
 * AI-generated template specs for pptxGenerate.js.
 *
 * HOW IT WORKS
 * ─────────────
 * Each template is a plain JSON spec (no code) that describes:
 *   - Decorative shapes (rect, ellipse, roundRect, line) with normalized
 *     0–1 coordinates relative to slide dimensions
 *   - Text zone positions (title, subtitle, body, footer)
 *   - Color token references: "accent" | "accent_light" | "accent_dark" |
 *     "accent_mid" | "text" | "bg" | "panel"
 *   - Font faces and sizes
 *   - Image placement zone
 *
 * At render time, resolveSpec(spec, theme) converts token references to
 * real hex colors and normalized coords to inches, then pptxGenerate.js
 * calls standard pptxgenjs addShape / addText calls.
 *
 * WHY JSON SPECS (not generated JS code)
 * ───────────────────────────────────────
 * Generating code and eval-ing it is dangerous and unpredictable.
 * A JSON spec is:
 *   - Safe to parse and validate
 *   - Easy for the LLM to produce correctly
 *   - Easy to preview / debug
 *   - Trivially extendable
 *
 * The LLM generates a spec object; the renderer executes it. Clean separation.
 */

import { mixHex } from "@/lib/themeColors";

// ── Slide dimensions (inches, 16:9) ──────────────────────────────────────────
export const W = 10; // slide width
export const H = 5.625; // slide height
const MIN_ZONE_SIZE = 0.02;

const DEFAULT_TEMPLATE_ZONES = {
  cover: {
    title: { x: 0.08, y: 0.24, w: 0.74, h: 0.34 },
    subtitle: { x: 0.08, y: 0.6, w: 0.7, h: 0.18 },
    badge: { x: 0.08, y: 0.87, w: 0.3, h: 0.06 },
  },
  content: {
    title: { x: 0.07, y: 0.1, w: 0.88, h: 0.16 },
    title_img: { x: 0.07, y: 0.1, w: 0.56, h: 0.16 },
    body: { x: 0.07, y: 0.27, w: 0.88, h: 0.64 },
    body_img: { x: 0.07, y: 0.27, w: 0.56, h: 0.64 },
    footer: { x: 0.07, y: 0.935, w: 0.4, h: 0.05 },
  },
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function toFiniteNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeAxis(value, axisLength) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const ratio = Number(trimmed.slice(0, -1));
      return Number.isFinite(ratio) ? ratio / 100 : null;
    }
  }
  const n = toFiniteNumber(value);
  if (n == null) return null;
  // Heuristic: values > 1 are likely inch-based absolute coords from legacy specs.
  return n > 1 ? n / axisLength : n;
}

function normalizeRectLike(rect, fallback, allowBleed = false) {
  const xRaw = normalizeAxis(rect?.x, W);
  const yRaw = normalizeAxis(rect?.y, H);
  const wRaw = normalizeAxis(rect?.w, W);
  const hRaw = normalizeAxis(rect?.h, H);

  const x =
    xRaw == null
      ? fallback.x
      : allowBleed
        ? clamp(xRaw, -0.5, 1)
        : clamp(xRaw, 0, 0.98);
  const y =
    yRaw == null
      ? fallback.y
      : allowBleed
        ? clamp(yRaw, -0.5, 1)
        : clamp(yRaw, 0, 0.98);
  const w = wRaw == null ? fallback.w : clamp(wRaw, MIN_ZONE_SIZE, 2);
  const h = hRaw == null ? fallback.h : clamp(hRaw, MIN_ZONE_SIZE, 2);

  const maxW = allowBleed ? 2 : 1 - x;
  const maxH = allowBleed ? 2 : 1 - y;

  return {
    x,
    y,
    w: clamp(w, MIN_ZONE_SIZE, Math.max(MIN_ZONE_SIZE, maxW)),
    h: clamp(h, MIN_ZONE_SIZE, Math.max(MIN_ZONE_SIZE, maxH)),
  };
}

export function normalizeTemplateSpec(input) {
  if (!input || typeof input !== "object")
    return { ok: false, spec: null, reason: "not_object" };

  const coverIn =
    input.cover && typeof input.cover === "object" ? input.cover : {};
  const contentIn =
    input.content && typeof input.content === "object" ? input.content : {};
  const coverShapes = Array.isArray(coverIn.shapes) ? coverIn.shapes : [];
  const contentShapes = Array.isArray(contentIn.shapes) ? contentIn.shapes : [];

  const normalizeShape = (shape) => {
    const zone = normalizeRectLike(shape, { x: 0, y: 0, w: 0.1, h: 0.1 }, true);
    return {
      ...shape,
      type: ["rect", "ellipse", "roundRect", "line", "triangle"].includes(
        shape?.type,
      )
        ? shape.type
        : "rect",
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
      opacity:
        shape?.opacity == null
          ? undefined
          : clamp(toFiniteNumber(shape.opacity) ?? 1, 0, 1),
      rot:
        shape?.rot == null
          ? undefined
          : clamp(toFiniteNumber(shape.rot) ?? 0, -360, 360),
    };
  };

  const spec = {
    ...input,
    name: String(input.name || "Custom Template").slice(0, 120),
    description: String(input.description || "").slice(0, 300),
    image_placement: String(input.image_placement || "right"),
    fonts: {
      title: String(input?.fonts?.title || "Calibri").slice(0, 60),
      body: String(input?.fonts?.body || "Calibri").slice(0, 60),
    },
    cover: {
      ...coverIn,
      shapes: coverShapes.map(normalizeShape),
      title: {
        ...coverIn.title,
        ...normalizeRectLike(coverIn.title, DEFAULT_TEMPLATE_ZONES.cover.title),
      },
      subtitle: {
        ...coverIn.subtitle,
        ...normalizeRectLike(
          coverIn.subtitle,
          DEFAULT_TEMPLATE_ZONES.cover.subtitle,
        ),
      },
      badge: {
        ...coverIn.badge,
        ...normalizeRectLike(coverIn.badge, DEFAULT_TEMPLATE_ZONES.cover.badge),
      },
    },
    content: {
      ...contentIn,
      shapes: contentShapes.map(normalizeShape),
      title: {
        ...contentIn.title,
        ...normalizeRectLike(
          contentIn.title,
          DEFAULT_TEMPLATE_ZONES.content.title,
        ),
      },
      title_img: {
        ...contentIn.title_img,
        ...normalizeRectLike(
          contentIn.title_img,
          DEFAULT_TEMPLATE_ZONES.content.title_img,
        ),
      },
      body: {
        ...contentIn.body,
        ...normalizeRectLike(
          contentIn.body,
          DEFAULT_TEMPLATE_ZONES.content.body,
        ),
      },
      body_img: {
        ...contentIn.body_img,
        ...normalizeRectLike(
          contentIn.body_img,
          DEFAULT_TEMPLATE_ZONES.content.body_img,
        ),
      },
      footer: {
        ...contentIn.footer,
        ...normalizeRectLike(
          contentIn.footer,
          DEFAULT_TEMPLATE_ZONES.content.footer,
        ),
      },
    },
  };

  const ok =
    spec.cover.shapes.length >= 0 &&
    spec.content.shapes.length >= 0 &&
    spec.cover.title.w > 0 &&
    spec.content.title.w > 0 &&
    spec.content.body.h > 0;

  return { ok, spec, reason: ok ? null : "invalid_zones" };
}

// ── Color token resolver ──────────────────────────────────────────────────────

/**
 * Given a theme {background, accent, text, panel} (all "#RRGGBB"),
 * return a map from token name → 6-char hex (no #).
 */
export function buildColorMap(theme) {
  const strip = (h) =>
    String(h || "")
      .replace(/^#/, "")
      .slice(0, 6) || "888888";
  const bg = strip(theme.background);
  const acc = strip(theme.accent);
  const txt = strip(theme.text);
  const pan = strip(theme.panel || theme.background);

  return {
    accent: acc,
    accent_light: strip(mixHex(`#${acc}`, "#ffffff", 0.4)),
    accent_dark: strip(mixHex(`#${acc}`, "#000000", 0.35)),
    accent_mid: strip(mixHex(`#${acc}`, `#${bg}`, 0.4)),
    text: txt,
    text_muted: strip(mixHex(`#${txt}`, `#${bg}`, 0.35)),
    bg: bg,
    panel: pan,
    white: "FFFFFF",
    black: "111111",
  };
}

/**
 * Resolve a color token or raw hex to a 6-char hex string.
 */
function resolveColor(token, colorMap) {
  if (!token) return colorMap.text;
  const t = String(token).toLowerCase().trim();
  if (colorMap[t]) return colorMap[t];
  // Raw hex passthrough
  return t.replace(/^#/, "").slice(0, 6) || colorMap.text;
}

// ── Shape spec interpreter ────────────────────────────────────────────────────

/**
 * Convert a shape spec into pptxgenjs addShape() arguments.
 * Coords are 0–1 normalized (fraction of slide W/H).
 *
 * Shape spec fields:
 *   type      "rect" | "ellipse" | "roundRect" | "line" | "triangle"
 *   x, y      0–1 (fraction of W, H). May be negative (bleeding off edge).
 *   w, h      0–1 (fraction of W, H)
 *   fill      color token or "#RRGGBB"
 *   opacity   0–1 (default 1.0)
 *   rot       degrees (default 0)
 *   gradient  { color2: token, angle: degrees } — makes a linear gradient
 *   radius    roundRect corner radius 0–1 fraction of h (default 0.08)
 *   border    color token for stroke; omit for no border
 *   borderW   stroke width in pt (default 0)
 *   zIndex    lower = drawn first (behind content). Default 0.
 */
export function shapeSpecToArgs(shapeSpec, colorMap, ST) {
  const fill = resolveColor(shapeSpec.fill, colorMap);
  const alpha =
    shapeSpec.opacity != null
      ? Math.round((1 - Math.min(1, Math.max(0, shapeSpec.opacity))) * 100)
      : 0; // pptxgenjs transparency: 0 = opaque, 100 = fully transparent

  const fillArg = shapeSpec.gradient
    ? {
        type: "linear",
        angle: shapeSpec.gradient.angle ?? 135,
        stops: [
          { position: 0, color: fill, transparency: alpha },
          {
            position: 100,
            color: resolveColor(shapeSpec.gradient.color2, colorMap),
            transparency: Math.min(99, alpha + 30),
          },
        ],
      }
    : { color: fill, transparency: alpha };

  const lineArg = shapeSpec.border
    ? {
        color: resolveColor(shapeSpec.border, colorMap),
        width: shapeSpec.borderW ?? 0.75,
      }
    : { width: 0 };

  const geomMap = {
    rect: ST.rect,
    ellipse: ST.ellipse,
    roundRect: ST.roundRect,
    line: ST.line,
    triangle: ST.isocelesTri ?? ST.rect,
  };

  return {
    type: geomMap[shapeSpec.type] ?? ST.rect,
    opts: {
      x: (shapeSpec.x ?? 0) * W,
      y: (shapeSpec.y ?? 0) * H,
      w: (shapeSpec.w ?? 0.1) * W,
      h: (shapeSpec.h ?? 0.1) * H,
      fill: fillArg,
      line: lineArg,
      rotate: shapeSpec.rot ?? 0,
      rectRadius: shapeSpec.radius != null ? shapeSpec.radius * H : undefined,
    },
  };
}

/**
 * Render all background shapes for a slide zone ("cover" or "content").
 * Shapes are sorted by zIndex (lower = behind).
 */
export function renderShapes(slide, shapeSpecs, colorMap, ST) {
  const sorted = [...(shapeSpecs || [])].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
  );
  for (const spec of sorted) {
    const { type, opts } = shapeSpecToArgs(spec, colorMap, ST);
    slide.addShape(type, opts);
  }
}

// ── Text zone resolver ────────────────────────────────────────────────────────

/**
 * Convert a text zone spec to pptxgenjs coords.
 * Zone spec: { x, y, w, h } all 0–1 normalized.
 */
export function resolveZone(zone) {
  return {
    x: (zone.x ?? 0) * W,
    y: (zone.y ?? 0) * H,
    w: (zone.w ?? 1) * W,
    h: (zone.h ?? 0.2) * H,
  };
}

// ── Built-in AI-generated template specs ─────────────────────────────────────
// Each spec was "generated" by prompting an AI with the design goal and
// palette, then tuned. The system can also call the LLM at runtime to
// generate a custom spec for unusual requests.

export const BUILTIN_SPECS = {
  // ────────────────────────────────────────────────────────────────────────────
  diagonal_burst: {
    name: "Diagonal Burst",
    description:
      "Bold diagonal accent band, circular blobs, left-aligned text — modern tech/startup feel",
    image_placement: "right",
    fonts: { title: "Calibri", body: "Calibri" },

    cover: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1, h: 0.075, fill: "accent" },
        {
          type: "rect",
          x: 0,
          y: 0.925,
          w: 1,
          h: 0.075,
          fill: "accent",
          opacity: 0.55,
        },
        {
          type: "ellipse",
          x: 0.68,
          y: -0.18,
          w: 0.58,
          h: 0.9,
          fill: "accent",
          opacity: 0.13,
        },
        {
          type: "ellipse",
          x: 0.8,
          y: 0.55,
          w: 0.38,
          h: 0.65,
          fill: "accent_light",
          opacity: 0.09,
        },
        {
          type: "rect",
          x: 0.55,
          y: -0.35,
          w: 0.65,
          h: 1.9,
          fill: "accent",
          opacity: 0.06,
          rot: -14,
        },
        {
          type: "ellipse",
          x: -0.08,
          y: 0.7,
          w: 0.25,
          h: 0.45,
          fill: "accent_mid",
          opacity: 0.18,
        },
      ],
      title: {
        x: 0.07,
        y: 0.25,
        w: 0.6,
        h: 0.35,
        fontSize: 38,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.07,
        y: 0.58,
        w: 0.58,
        h: 0.17,
        fontSize: 16,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.07,
        y: 0.87,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1, h: 0.052, fill: "accent" },
        {
          type: "rect",
          x: 0,
          y: 0.052,
          w: 0.02,
          h: 0.948,
          fill: "accent",
          opacity: 0.55,
        },
        {
          type: "ellipse",
          x: 0.82,
          y: 0.72,
          w: 0.3,
          h: 0.55,
          fill: "accent",
          opacity: 0.07,
        },
        {
          type: "ellipse",
          x: 0.88,
          y: 0.1,
          w: 0.18,
          h: 0.32,
          fill: "accent_light",
          opacity: 0.08,
        },
      ],
      panel: {
        fill: "panel",
        opacity: 0.22,
        border: "accent",
        borderW: 0.75,
        radius: 0.06,
      },
      title: {
        x: 0.07,
        y: 0.1,
        w: 0.88,
        h: 0.16,
        fontSize: 21,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.07,
        y: 0.1,
        w: 0.55,
        h: 0.16,
        fontSize: 21,
        color: "accent",
        bold: true,
      },
      body: { x: 0.07, y: 0.27, w: 0.88, h: 0.64, fontSize: 13, color: "text" },
      body_img: {
        x: 0.07,
        y: 0.27,
        w: 0.55,
        h: 0.64,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.07, y: 0.935, fontSize: 9, color: "accent" },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  botanical_organic: {
    name: "Botanical Organic",
    description:
      "Soft ellipse blobs in corners, thin edge stripe, warm and natural",
    image_placement: "right",
    fonts: { title: "Georgia", body: "Calibri" },

    cover: {
      shapes: [
        {
          type: "ellipse",
          x: 0.68,
          y: -0.3,
          w: 0.72,
          h: 0.8,
          fill: "accent",
          opacity: 0.18,
        },
        {
          type: "ellipse",
          x: 0.82,
          y: 0.55,
          w: 0.48,
          h: 0.7,
          fill: "accent_light",
          opacity: 0.13,
        },
        {
          type: "ellipse",
          x: -0.1,
          y: 0.62,
          w: 0.42,
          h: 0.62,
          fill: "accent",
          opacity: 0.15,
        },
        {
          type: "rect",
          x: 0,
          y: 0,
          w: 0.01,
          h: 1.0,
          fill: "accent",
          opacity: 0.85,
        },
        {
          type: "rect",
          x: 0,
          y: 0.92,
          w: 1.0,
          h: 0.012,
          fill: "accent",
          opacity: 0.4,
        },
      ],
      title: {
        x: 0.08,
        y: 0.22,
        w: 0.6,
        h: 0.4,
        fontSize: 36,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.08,
        y: 0.6,
        w: 0.58,
        h: 0.18,
        fontSize: 15,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.08,
        y: 0.87,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        {
          type: "ellipse",
          x: 0.8,
          y: -0.22,
          w: 0.42,
          h: 0.6,
          fill: "accent",
          opacity: 0.12,
        },
        {
          type: "ellipse",
          x: 0.88,
          y: 0.7,
          w: 0.28,
          h: 0.5,
          fill: "accent_light",
          opacity: 0.1,
        },
        {
          type: "ellipse",
          x: -0.06,
          y: 0.68,
          w: 0.24,
          h: 0.45,
          fill: "accent",
          opacity: 0.1,
        },
        {
          type: "rect",
          x: 0,
          y: 0,
          w: 0.01,
          h: 1.0,
          fill: "accent",
          opacity: 0.85,
        },
        {
          type: "rect",
          x: 0,
          y: 0.935,
          w: 0.5,
          h: 0.009,
          fill: "accent",
          opacity: 0.45,
        },
      ],
      panel: {
        fill: "panel",
        opacity: 0.2,
        border: "accent",
        borderW: 0.75,
        radius: 0.08,
      },
      title: {
        x: 0.06,
        y: 0.09,
        w: 0.9,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.06,
        y: 0.09,
        w: 0.56,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      body: { x: 0.06, y: 0.27, w: 0.9, h: 0.64, fontSize: 13, color: "text" },
      body_img: {
        x: 0.06,
        y: 0.27,
        w: 0.56,
        h: 0.64,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.06, y: 0.935, fontSize: 9, color: "accent" },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  geometric_grid: {
    name: "Geometric Grid",
    description:
      "Left thick bar + top strip, right-side accent lines — corporate, structured",
    image_placement: "right",
    fonts: { title: "Calibri", body: "Calibri" },

    cover: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 0.055, h: 1.0, fill: "accent" },
        {
          type: "rect",
          x: 0.055,
          y: 0,
          w: 0.945,
          h: 0.072,
          fill: "accent",
          opacity: 0.3,
        },
        {
          type: "rect",
          x: 0.055,
          y: 0.928,
          w: 0.945,
          h: 0.072,
          fill: "accent",
          opacity: 0.25,
        },
        {
          type: "rect",
          x: 0.9,
          y: 0.1,
          w: 0.008,
          h: 0.55,
          fill: "accent",
          opacity: 0.2,
        },
        {
          type: "rect",
          x: 0.92,
          y: 0.15,
          w: 0.008,
          h: 0.45,
          fill: "accent",
          opacity: 0.12,
        },
        {
          type: "rect",
          x: 0.94,
          y: 0.2,
          w: 0.008,
          h: 0.35,
          fill: "accent",
          opacity: 0.07,
        },
      ],
      title: {
        x: 0.12,
        y: 0.26,
        w: 0.75,
        h: 0.36,
        fontSize: 38,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.12,
        y: 0.6,
        w: 0.72,
        h: 0.16,
        fontSize: 15,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.12,
        y: 0.86,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 0.035, h: 1.0, fill: "accent" },
        {
          type: "rect",
          x: 0.035,
          y: 0,
          w: 0.965,
          h: 0.055,
          fill: "accent",
          opacity: 0.28,
        },
        {
          type: "rect",
          x: 0.88,
          y: 0.08,
          w: 0.007,
          h: 0.5,
          fill: "accent",
          opacity: 0.18,
        },
        {
          type: "rect",
          x: 0.9,
          y: 0.12,
          w: 0.007,
          h: 0.4,
          fill: "accent",
          opacity: 0.1,
        },
        {
          type: "rect",
          x: 0.92,
          y: 0.16,
          w: 0.007,
          h: 0.3,
          fill: "accent",
          opacity: 0.06,
        },
        {
          type: "rect",
          x: 0.035,
          y: 0.935,
          w: 0.5,
          h: 0.007,
          fill: "accent",
          opacity: 0.35,
        },
      ],
      panel: {
        fill: "panel",
        opacity: 0.22,
        border: "accent",
        borderW: 0.75,
        radius: 0.05,
      },
      title: {
        x: 0.09,
        y: 0.09,
        w: 0.86,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.09,
        y: 0.09,
        w: 0.56,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      body: { x: 0.09, y: 0.27, w: 0.86, h: 0.64, fontSize: 13, color: "text" },
      body_img: {
        x: 0.09,
        y: 0.27,
        w: 0.56,
        h: 0.64,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.09, y: 0.935, fontSize: 9, color: "accent" },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  gradient_wash: {
    name: "Gradient Wash",
    description:
      "Full-bleed gradient halos, dot grid, glow bottom bar — neon/cyberpunk/aurora",
    image_placement: "right",
    fonts: { title: "Calibri", body: "Calibri" },

    cover: {
      shapes: [
        // Halo top-right
        {
          type: "ellipse",
          x: 0.5,
          y: -0.55,
          w: 0.9,
          h: 1.1,
          fill: "accent",
          opacity: 0.13,
          gradient: { color2: "bg", angle: 180 },
        },
        // Halo bottom-left
        {
          type: "ellipse",
          x: -0.18,
          y: 0.55,
          w: 0.6,
          h: 0.8,
          fill: "accent",
          opacity: 0.09,
          gradient: { color2: "bg", angle: 0 },
        },
        // Bottom glow bar
        {
          type: "rect",
          x: 0,
          y: 0.92,
          w: 1.0,
          h: 0.08,
          fill: "accent",
          opacity: 0.4,
        },
        // Dot grid - encoded as small spaced ellipses
        ...[0, 1, 2, 3, 4].flatMap((col) =>
          [0, 1, 2].map((row) => ({
            type: "ellipse",
            x: 0.06 + col * 0.048,
            y: 0.08 + row * 0.11,
            w: 0.012,
            h: 0.019,
            fill: "accent",
            opacity: 0.18,
          })),
        ),
      ],
      title: {
        x: 0.08,
        y: 0.3,
        w: 0.68,
        h: 0.38,
        fontSize: 40,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.08,
        y: 0.67,
        w: 0.66,
        h: 0.17,
        fontSize: 16,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.08,
        y: 0.86,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        {
          type: "ellipse",
          x: 0.6,
          y: -0.35,
          w: 0.7,
          h: 0.8,
          fill: "accent",
          opacity: 0.09,
          gradient: { color2: "bg", angle: 180 },
        },
        {
          type: "ellipse",
          x: -0.12,
          y: 0.6,
          w: 0.4,
          h: 0.6,
          fill: "accent",
          opacity: 0.07,
          gradient: { color2: "bg", angle: 0 },
        },
        {
          type: "rect",
          x: 0,
          y: 0.93,
          w: 1.0,
          h: 0.07,
          fill: "accent",
          opacity: 0.38,
        },
        ...[0, 1, 2, 3].flatMap((col) =>
          [0, 1].map((row) => ({
            type: "ellipse",
            x: 0.04 + col * 0.038,
            y: 0.06 + row * 0.1,
            w: 0.01,
            h: 0.017,
            fill: "accent",
            opacity: 0.16,
          })),
        ),
      ],
      panel: {
        fill: "panel",
        opacity: 0.25,
        border: "accent",
        borderW: 0.75,
        radius: 0.06,
      },
      title: {
        x: 0.06,
        y: 0.1,
        w: 0.9,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.06,
        y: 0.1,
        w: 0.56,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      body: { x: 0.06, y: 0.28, w: 0.9, h: 0.63, fontSize: 13, color: "text" },
      body_img: {
        x: 0.06,
        y: 0.28,
        w: 0.56,
        h: 0.63,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.06, y: 0.932, fontSize: 9, color: "accent" },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  warm_academic: {
    name: "Warm Academic",
    description:
      "Top thick rule, left margin rule, corner ornaments — scholarly and refined",
    image_placement: "right",
    fonts: { title: "Georgia", body: "Georgia" },

    cover: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1.0, h: 0.09, fill: "accent" },
        {
          type: "rect",
          x: 0,
          y: 0.91,
          w: 1.0,
          h: 0.004,
          fill: "accent",
          opacity: 0.55,
        },
        // left margin
        {
          type: "rect",
          x: 0.095,
          y: 0.09,
          w: 0.004,
          h: 0.82,
          fill: "accent",
          opacity: 0.3,
        },
        // corner ornament top-right (nested squares)
        {
          type: "rect",
          x: 0.88,
          y: 0.11,
          w: 0.085,
          h: 0.13,
          fill: "accent",
          opacity: 0.18,
        },
        {
          type: "rect",
          x: 0.898,
          y: 0.13,
          w: 0.085,
          h: 0.11,
          fill: "accent",
          opacity: 0.1,
        },
        {
          type: "rect",
          x: 0.916,
          y: 0.15,
          w: 0.085,
          h: 0.09,
          fill: "accent",
          opacity: 0.06,
        },
        // right vertical accent
        {
          type: "rect",
          x: 0.962,
          y: 0.09,
          w: 0.018,
          h: 0.82,
          fill: "accent",
          opacity: 0.08,
        },
      ],
      title: {
        x: 0.13,
        y: 0.25,
        w: 0.72,
        h: 0.38,
        fontSize: 36,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.13,
        y: 0.62,
        w: 0.7,
        h: 0.18,
        fontSize: 15,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.13,
        y: 0.85,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1.0, h: 0.06, fill: "accent" },
        {
          type: "rect",
          x: 0.06,
          y: 0.06,
          w: 0.004,
          h: 0.875,
          fill: "accent",
          opacity: 0.28,
        },
        {
          type: "rect",
          x: 0.06,
          y: 0.935,
          w: 0.94,
          h: 0.004,
          fill: "accent",
          opacity: 0.35,
        },
        {
          type: "rect",
          x: 0.968,
          y: 0.06,
          w: 0.012,
          h: 0.875,
          fill: "accent",
          opacity: 0.07,
        },
        // corner detail
        {
          type: "rect",
          x: 0.87,
          y: 0.07,
          w: 0.055,
          h: 0.09,
          fill: "accent",
          opacity: 0.14,
        },
      ],
      panel: {
        fill: "panel",
        opacity: 0.18,
        border: "accent",
        borderW: 0.75,
        radius: 0.04,
      },
      title: {
        x: 0.1,
        y: 0.1,
        w: 0.86,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.1,
        y: 0.1,
        w: 0.56,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      body: { x: 0.1, y: 0.28, w: 0.86, h: 0.63, fontSize: 13, color: "text" },
      body_img: {
        x: 0.1,
        y: 0.28,
        w: 0.56,
        h: 0.63,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.1, y: 0.935, fontSize: 9, color: "accent" },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  minimal_edge: {
    name: "Minimal Edge",
    description:
      "Thin top/left/bottom rules, extreme whitespace — ultra clean and modern",
    image_placement: "right",
    fonts: { title: "Calibri", body: "Calibri" },

    cover: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1.0, h: 0.012, fill: "accent" },
        {
          type: "rect",
          x: 0,
          y: 0.012,
          w: 0.028,
          h: 0.976,
          fill: "accent",
          opacity: 0.12,
        },
        {
          type: "rect",
          x: 0,
          y: 0.988,
          w: 1.0,
          h: 0.012,
          fill: "accent",
          opacity: 0.45,
        },
        {
          type: "rect",
          x: 0.97,
          y: 0.012,
          w: 0.01,
          h: 0.976,
          fill: "accent",
          opacity: 0.18,
        },
      ],
      title: {
        x: 0.09,
        y: 0.28,
        w: 0.8,
        h: 0.36,
        fontSize: 40,
        color: "accent",
        bold: true,
        align: "left",
      },
      subtitle: {
        x: 0.09,
        y: 0.63,
        w: 0.78,
        h: 0.16,
        fontSize: 15,
        color: "text",
        bold: false,
        align: "left",
      },
      badge: {
        x: 0.09,
        y: 0.87,
        w: 0.3,
        h: 0.06,
        fontSize: 10,
        color: "accent",
      },
    },

    content: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: 1.0, h: 0.012, fill: "accent" },
        {
          type: "rect",
          x: 0,
          y: 0.012,
          w: 0.02,
          h: 0.976,
          fill: "accent",
          opacity: 0.1,
        },
        {
          type: "rect",
          x: 0,
          y: 0.988,
          w: 1.0,
          h: 0.012,
          fill: "accent",
          opacity: 0.38,
        },
        {
          type: "rect",
          x: 0.98,
          y: 0.012,
          w: 0.01,
          h: 0.976,
          fill: "accent",
          opacity: 0.15,
        },
      ],
      panel: {
        fill: "panel",
        opacity: 0.15,
        border: "accent",
        borderW: 0.5,
        radius: 0.04,
      },
      title: {
        x: 0.07,
        y: 0.09,
        w: 0.9,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      title_img: {
        x: 0.07,
        y: 0.09,
        w: 0.57,
        h: 0.17,
        fontSize: 22,
        color: "accent",
        bold: true,
      },
      body: { x: 0.07, y: 0.27, w: 0.9, h: 0.66, fontSize: 13, color: "text" },
      body_img: {
        x: 0.07,
        y: 0.27,
        w: 0.57,
        h: 0.66,
        fontSize: 13,
        color: "text",
      },
      footer: { x: 0.07, y: 0.932, fontSize: 9, color: "accent" },
    },
  },
};

// ── LLM spec generator ────────────────────────────────────────────────────────

/**
 * System prompt for the LLM to generate a custom template spec.
 * The LLM returns a JSON object matching the BUILTIN_SPECS structure.
 */
export const TEMPLATE_SPEC_SYSTEM_PROMPT = `You are a presentation template designer.
You generate JSON template specs for PowerPoint slides built with pptxgenjs.
Output ONLY valid JSON — no markdown, no explanation.`;

export function buildTemplateSpecPrompt(instructions, theme) {
  return `Design a unique slide template for this request: "${instructions}"

Theme colors:
  background: ${theme.background}
  accent: ${theme.accent}
  text: ${theme.text}

The template JSON must match this EXACT structure (copy field names exactly):

{
  "name": "Template Name",
  "description": "One line describing the aesthetic",
  "image_placement": "right",
  "fonts": { "title": "Calibri", "body": "Calibri" },

  "cover": {
    "shapes": [
      {
        "type": "rect|ellipse|roundRect",
        "x": 0.0, "y": 0.0,   <- 0-1 fraction of slide width/height
        "w": 1.0, "h": 0.08,  <- 0-1 fraction of slide width/height
        "fill": "accent|accent_light|accent_dark|accent_mid|text|bg|panel|white|black",
        "opacity": 0.85,       <- 0-1 (default 1.0)
        "rot": 0,              <- degrees (optional)
        "gradient": { "color2": "bg", "angle": 135 }  <- optional gradient
      }
    ],
    "title":    { "x": 0.07, "y": 0.28, "w": 0.62, "h": 0.35, "fontSize": 38, "color": "accent", "bold": true, "align": "left" },
    "subtitle": { "x": 0.07, "y": 0.60, "w": 0.60, "h": 0.17, "fontSize": 16, "color": "text",   "bold": false, "align": "left" },
    "badge":    { "x": 0.07, "y": 0.87, "w": 0.30, "h": 0.06, "fontSize": 10, "color": "accent" }
  },

  "content": {
    "shapes": [ ...same shape format... ],
    "panel":    { "fill": "panel", "opacity": 0.22, "border": "accent", "borderW": 0.75, "radius": 0.06 },
    "title":    { "x": 0.07, "y": 0.10, "w": 0.88, "h": 0.16, "fontSize": 22, "color": "accent", "bold": true },
    "title_img":{ "x": 0.07, "y": 0.10, "w": 0.55, "h": 0.16, "fontSize": 22, "color": "accent", "bold": true },
    "body":     { "x": 0.07, "y": 0.27, "w": 0.88, "h": 0.64, "fontSize": 13, "color": "text" },
    "body_img": { "x": 0.07, "y": 0.27, "w": 0.55, "h": 0.64, "fontSize": 13, "color": "text" },
    "footer":   { "x": 0.07, "y": 0.935, "fontSize": 9, "color": "accent" }
  }
}

RULES:
1. Use 4-8 shapes per zone for interesting but not cluttered layouts
2. All x/y/w/h values are 0-1 fractions of slide dimensions (10" wide × 5.625" tall)
3. Shapes may bleed off edges (x/y slightly negative, x+w slightly > 1)
4. Keep title/body zones well inside the slide (x >= 0.05, y+h <= 0.97)
5. "title_img" and "body_img" must be narrower (w <= 0.60) to leave room for image
6. Vary the aesthetic based on the request — don't always use the same shapes
7. Be creative with shape combinations: diagonal rects, overlapping blobs, grid lines, etc.
8. font options: "Calibri", "Georgia", "Arial", "Verdana", "Trebuchet MS"`;
}

// ── Template selector ─────────────────────────────────────────────────────────

/**
 * Pick the best built-in spec key for a given theme, or return null to trigger LLM generation.
 */
export function selectBuiltinSpec(theme, instructions = "") {
  const lower = instructions.toLowerCase();

  // Keyword matches to built-ins
  if (/green|botanical|nature|forest|eco|plant|leaf|organic/.test(lower))
    return "botanical_organic";
  if (/minimal|clean|simple|white|light|arctic|slate|corporate/.test(lower))
    return "minimal_edge";
  if (/academic|scholar|university|paper|parchment|warm|terracotta/.test(lower))
    return "warm_academic";
  if (/cyber|neon|aurora|glow|dark tech|futur|matrix|hacker/.test(lower))
    return "gradient_wash";
  if (/geometric|grid|blue|navy|ocean|teal|professional|tech/.test(lower))
    return "geometric_grid";

  // Auto-select by theme luminance + hue
  const acc = parseHexForSelect(theme.accent);
  const bg = parseHexForSelect(theme.background);
  if (!acc || !bg) return "diagonal_burst";

  const bgLum =
    0.2126 * (bg.r / 255) + 0.7152 * (bg.g / 255) + 0.0722 * (bg.b / 255);
  const { h: hue } = rgbToHsl(acc);

  if (hue >= 90 && hue <= 165) return "botanical_organic"; // greens
  if (bgLum > 0.55) {
    return hue >= 20 && hue <= 55 ? "warm_academic" : "minimal_edge";
  }
  const accLum =
    0.2126 * (acc.r / 255) + 0.7152 * (acc.g / 255) + 0.0722 * (acc.b / 255);
  if (accLum > 0.45) return "gradient_wash"; // bright neon accents
  if (hue >= 195 && hue <= 265) return "geometric_grid"; // blue/purple range
  return "diagonal_burst";
}

function parseHexForSelect(hex) {
  const h = String(hex || "").replace(/^#/, "");
  if (h.length < 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) h = (((g - b) / d + 6) % 6) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h };
}
