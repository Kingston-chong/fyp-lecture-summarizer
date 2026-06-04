/**
 * Holds File[] between dashboard navigation and /summary/guest autostart (same-tab only).
 */

/** @type {{ files: File[]; options: object } | null} */
let pending = null;

/**
 * @param {File[]} files
 * @param {object} options
 */
export function setGuestPendingSummarize(files, options) {
  pending = { files: [...files], options: { ...options } };
}

/** @returns {{ files: File[]; options: object } | null} */
export function consumeGuestPendingSummarize() {
  const p = pending;
  pending = null;
  return p;
}
