/**
 * Hex color helpers for slide themes (no external deps).
 */

function hexToRgb(hex) {
  const h = String(hex || "")
    .replace(/^#/, "")
    .slice(0, 6);
  if (h.length !== 6) return { r: 15, g: 23, b: 42 };
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(
    a.r + (b.r - a.r) * u,
    a.g + (b.g - a.g) * u,
    a.b + (b.b - a.b) * u,
  );
}

/** Slightly lighten a dark background for a card/panel fill. */
export function panelFromBackground(bgHex, accentHex) {
  return mixHex(bgHex, accentHex, 0.12);
}
