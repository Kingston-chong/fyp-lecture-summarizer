/** Create or refresh a public chat share link for a summary. */

export function buildPublicChatShareUrl(shareToken) {
  if (typeof window === "undefined" || !shareToken) return "";
  return `${window.location.origin}/chat/share/${shareToken}`;
}

/**
 * @param {number | string} summaryId
 * @returns {Promise<{ url: string; shareToken: string; published: boolean; unchanged: boolean }>}
 */
export async function publishPublicChatShare(summaryId) {
  const res = await fetch(`/api/summary/${summaryId}/chat/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not create share link");
  }
  const shareToken = data.shareToken;
  if (!shareToken) throw new Error("No share token returned");
  return {
    url: buildPublicChatShareUrl(shareToken),
    shareToken,
    published: Boolean(data.published),
    unchanged: Boolean(data.unchanged),
  };
}

/** @returns {Promise<boolean>} whether copy succeeded */
export async function copyTextToClipboard(text) {
  if (typeof window === "undefined") return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (navigator.share) {
    await navigator.share({ url: text });
    return true;
  }
  window.prompt("Copy this link:", text);
  return true;
}
