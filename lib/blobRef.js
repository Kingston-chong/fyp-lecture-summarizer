/**
 * Normalize slide-deck / document blob identifiers for @vercel/blob get() and del().
 * We store pathname (preferred). Legacy rows may still hold a full blob URL.
 */
export function toBlobRef(stored) {
  const s = String(stored || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return s;
  try {
    const pathname = new URL(s).pathname.replace(/^\/+/, "");
    if (pathname) return pathname;
  } catch {
    // fall through
  }
  return s;
}

/** Fields safe to return to the browser for a slide deck list item. */
export function publicSlideDeckFields(deck) {
  if (!deck) return deck;
  const { pptxUrl, pdfUrl, ...rest } = deck;
  return rest;
}
