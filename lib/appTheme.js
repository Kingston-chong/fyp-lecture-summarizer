/** @typedef {'light' | 'dark'} AppTheme */

export const APP_THEME_STORAGE_KEY = "slide2notes-theme";
export const APP_THEME_COOKIE = "slide2notes-theme";

/**
 * @param {unknown} value
 * @returns {AppTheme}
 */
export function normalizeAppTheme(value) {
  return value === "light" || value === "dark" ? value : "dark";
}

/**
 * @returns {AppTheme | null}
 */
export function readAppThemeFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(APP_THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Apply theme to DOM, localStorage, and cookie (client only).
 * @param {unknown} theme
 * @returns {AppTheme}
 */
export function persistAppTheme(theme) {
  const next = normalizeAppTheme(theme);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
    document.cookie = `${APP_THEME_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
  }
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * Blocking script for layout <head> — runs before first paint.
 */
export const APP_THEME_INIT_SCRIPT = `(function(){try{var k='${APP_THEME_STORAGE_KEY}',c='${APP_THEME_COOKIE}',s=localStorage.getItem(k);if(s!=='light'&&s!=='dark')s='dark';document.documentElement.setAttribute('data-theme',s);document.cookie=c+'='+s+';path=/;max-age=31536000;SameSite=Lax';}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
