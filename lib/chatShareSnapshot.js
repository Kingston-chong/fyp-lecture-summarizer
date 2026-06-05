/** @typedef {{ role: "user" | "assistant"; content: string; modelLabel?: string | null }} ShareMessage */

const SNAPSHOT_VERSION = 1;

/**
 * Normalize a persisted ChatMessage row for public snapshot display.
 * @param {{ role: string; content: string; modelLabel?: string | null }} row
 * @returns {ShareMessage | null}
 */
export function dbMessageToShareMessage(row) {
  const role = row.role === "assistant" ? "assistant" : "user";
  let content = typeof row.content === "string" ? row.content : "";

  if (
    role === "user" &&
    content.startsWith('{"v":1') &&
    content.includes('"t"')
  ) {
    try {
      const o = JSON.parse(content);
      content = typeof o.t === "string" ? o.t : "";
    } catch {
      /* keep raw */
    }
  }

  content = sanitizeShareText(content);
  if (!content.trim() && role === "user") return null;

  return {
    role,
    content,
    ...(role === "assistant" && row.modelLabel
      ? { modelLabel: String(row.modelLabel) }
      : {}),
  };
}

/**
 * @param {{ title?: string; model?: string; summarizeFor?: string; output?: string; createdAt?: Date | string }} summary
 * @param {ShareMessage[]} messages
 */
export function buildChatShareSnapshot(summary, messages) {
  const output =
    typeof summary?.output === "string"
      ? sanitizeShareText(summary.output)
      : "";

  return {
    v: SNAPSHOT_VERSION,
    title: String(summary?.title || "Slide2Notes conversation").slice(0, 500),
    model: String(summary?.model || ""),
    summarizeFor: String(summary?.summarizeFor || ""),
    summaryOutput: output,
    createdAt: summary?.createdAt
      ? new Date(summary.createdAt).toISOString()
      : null,
    sharedAt: new Date().toISOString(),
    messages: messages.filter(
      (m) => m && typeof m.content === "string" && m.content.trim(),
    ),
  };
}

/**
 * Whether a summary row (+ optional chat messages) can be published to a public link.
 * @param {{ output?: string } | null | undefined} summary
 * @param {ShareMessage[]} [messages]
 */
/**
 * Stable comparison of public share payload (ignores sharedAt / createdAt).
 * @param {unknown} a
 * @param {unknown} b
 */
export function shareSnapshotContentEqual(a, b) {
  return shareSnapshotContentKey(a) === shareSnapshotContentKey(b);
}

/** @param {unknown} snapshot */
function shareSnapshotContentKey(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const s = /** @type {Record<string, unknown>} */ (snapshot);
  const messages = Array.isArray(s.messages)
    ? s.messages.map((m) => {
        if (!m || typeof m !== "object") return null;
        const row = /** @type {Record<string, unknown>} */ (m);
        const role = row.role === "assistant" ? "assistant" : "user";
        const content = sanitizeShareText(String(row.content || ""));
        if (!content.trim()) return null;
        return {
          role,
          content,
          ...(role === "assistant" && row.modelLabel
            ? { modelLabel: String(row.modelLabel) }
            : {}),
        };
      })
    : [];
  const normalized = {
    v: s.v ?? SNAPSHOT_VERSION,
    title: String(s.title || "").trim(),
    model: String(s.model || ""),
    summarizeFor: String(s.summarizeFor || ""),
    summaryOutput:
      typeof s.summaryOutput === "string"
        ? sanitizeShareText(s.summaryOutput)
        : "",
    messages: messages.filter(Boolean),
  };
  return JSON.stringify(normalized);
}

export function canPublishSummaryShare(summary, messages = []) {
  const output =
    typeof summary?.output === "string" ? summary.output.trim() : "";
  const hasMessages =
    Array.isArray(messages) &&
    messages.some((m) => m && String(m.content || "").trim());
  return output.length > 0 || hasMessages;
}

/** @param {unknown} snapshot */
export function parsePublicChatSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = /** @type {Record<string, unknown>} */ (snapshot);
  if (s.v !== SNAPSHOT_VERSION) return null;
  const messages = Array.isArray(s.messages)
    ? s.messages
        .map((m) => {
          if (!m || typeof m !== "object") return null;
          const row = /** @type {Record<string, unknown>} */ (m);
          const role = row.role === "assistant" ? "assistant" : "user";
          const content = sanitizeShareText(String(row.content || ""));
          if (!content.trim()) return null;
          return {
            role,
            content,
            modelLabel:
              role === "assistant" && row.modelLabel
                ? String(row.modelLabel)
                : null,
          };
        })
        .filter(Boolean)
    : [];

  return {
    title: String(s.title || "Shared conversation"),
    model: String(s.model || ""),
    summarizeFor: String(s.summarizeFor || ""),
    summaryOutput:
      typeof s.summaryOutput === "string"
        ? sanitizeShareText(s.summaryOutput)
        : "",
    createdAt: typeof s.createdAt === "string" ? s.createdAt : null,
    sharedAt: typeof s.sharedAt === "string" ? s.sharedAt : null,
    messages,
  };
}

function sanitizeShareText(text) {
  return String(text)
    .replace(
      /https?:\/\/[^\s)]+\.vercel-storage\.com[^\s)"]*/gi,
      "[file removed]",
    )
    .slice(0, 200_000);
}
