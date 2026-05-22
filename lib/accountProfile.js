/** @param {string} raw */
export function normalizeUsername(raw) {
  return String(raw ?? "").trim();
}

/** @returns {{ ok: true, username: string } | { ok: false, error: string }} */
export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, error: "Username cannot be empty." };
  }
  if (username.length < 2 || username.length > 32) {
    return { ok: false, error: "Username must be between 2 and 32 characters." };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      error: "Username may only contain letters, numbers, dots, underscores, and hyphens.",
    };
  }
  return { ok: true, username };
}

/** @param {string | null | undefined} passwordHash */
export function authProviderFromPasswordHash(passwordHash) {
  return passwordHash === "google-oauth" ? "google" : "credentials";
}
