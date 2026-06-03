/**
 * Shared theme id persistence for slide / improve flows.
 */

export function themeListIds(themes) {
  return (themes || [])
    .map((t) => String(t?.id || t?.theme_id || "").trim())
    .filter(Boolean);
}

/**
 * Keep the user's theme when it is still in the list; otherwise first available.
 * @param {string | null | undefined} prevId
 * @param {unknown[]} themes
 */
export function pickThemeIdAfterListLoad(prevId, themes) {
  const ids = themeListIds(themes);
  if (!ids.length) return null;
  const prev = String(prevId || "").trim();
  if (prev && ids.includes(prev)) return prev;
  return ids[0];
}

const STORAGE_PREFIX = "fyp-theme-choice";

export function themeStorageKey(scope, provider) {
  return `${STORAGE_PREFIX}:${scope}:${String(provider || "alai").toLowerCase()}`;
}

export function readStoredThemeChoice(scope, provider) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(themeStorageKey(scope, provider));
    if (!raw) return null;
    const o = JSON.parse(raw);
    const id = String(o?.id || "").trim();
    if (!id) return null;
    return {
      id,
      name: String(o?.name || "").trim(),
      description: String(o?.description || "").trim(),
    };
  } catch {
    return null;
  }
}

export function writeStoredThemeChoice(scope, provider, theme) {
  if (typeof window === "undefined") return;
  const id = String(theme?.id || theme?.theme_id || "").trim();
  if (!id) return;
  try {
    sessionStorage.setItem(
      themeStorageKey(scope, provider),
      JSON.stringify({
        id,
        name: String(theme?.name || theme?.title || theme?.label || "").trim(),
        description: String(theme?.description || "").trim(),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

/**
 * Best-effort hex theme from improve-ppt templateSpec (2slides vision extract).
 * @param {Record<string, unknown> | null | undefined} spec
 */
export function themeFromTemplateSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || "").trim());

  const cover = spec.cover && typeof spec.cover === "object" ? spec.cover : {};
  const content =
    spec.content && typeof spec.content === "object" ? spec.content : {};

  let bg = isHex(cover.background)
    ? String(cover.background).trim()
    : isHex(content.background)
      ? String(content.background).trim()
      : null;

  const shapes = [
  ...(Array.isArray(cover.shapes) ? cover.shapes : []),
  ...(Array.isArray(content.shapes) ? content.shapes : []),
  ];

  let accent = null;
  let text = null;
  for (const s of shapes) {
    const fill = String(s?.fill || "").trim();
    if (!isHex(fill)) continue;
    const fillLower = fill.toLowerCase();
    const bgLower = bg?.toLowerCase();
    if (!accent && fillLower !== bgLower) accent = fill;
    else if (!text && fillLower !== bgLower && fillLower !== accent?.toLowerCase())
      text = fill;
  }

  const contentShapes = Array.isArray(content.shapes) ? content.shapes : [];
  const firstContentFill = String(contentShapes[0]?.fill || "").trim();

  const titleColor = isHex(cover?.title?.color)
    ? String(cover.title.color).trim()
    : isHex(content?.title?.color)
      ? String(content.title.color).trim()
      : null;
  const bodyColor = isHex(content?.body?.color)
    ? String(content.body.color).trim()
    : null;

  if (!bg && !accent && !titleColor) return null;

  return {
    background: bg || "#0f172a",
    accent: accent || titleColor || "#6366f1",
    text: bodyColor || titleColor || "#f1f5f9",
    panel: isHex(firstContentFill) ? firstContentFill : undefined,
  };
}

/**
 * Keep the selected theme visible in the picker grid after a filtered reload.
 * @param {unknown[]} themes
 * @param {string | null | undefined} themeId
 * @param {{ name?: string, description?: string, _themeName?: string, _summary?: string }} [meta]
 */
export function mergeSelectedThemeIntoList(themes, themeId, meta = {}) {
  const list = Array.isArray(themes) ? [...themes] : [];
  const id = String(themeId || "").trim();
  if (!id || list.some((t) => String(t?.id || t?.theme_id || "").trim() === id)) {
    return list;
  }
  const name = String(
    meta.name || meta._themeName || "Selected theme",
  ).trim();
  return [
    {
      id,
      name,
      description: String(meta.description || meta._summary || "").trim(),
      tags: null,
      themeURL: "",
    },
    ...list,
  ];
}
