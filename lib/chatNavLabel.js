/**
 * Short label for chat thread navigator (user prompts only).
 * @param {{ content?: string; references?: { text?: string }[] }} message
 */
export function getUserMessageNavLabel(message) {
  let text = typeof message?.content === "string" ? message.content.trim() : "";

  if (text.startsWith('{"v":1') && text.includes('"t"')) {
    try {
      const o = JSON.parse(text);
      text = typeof o.t === "string" ? o.t.trim() : "";
    } catch {
      /* keep raw */
    }
  }

  const refLine = message?.references?.[0]?.text?.trim();
  if (!text && refLine) text = refLine;

  text = text.replace(/\s+/g, " ");
  if (!text) return "Message";

  const max = 72;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * @param {Array<{ id: unknown; role: string; content?: string; streaming?: boolean; error?: boolean; references?: unknown[] }>} messages
 */
export function getChatNavItems(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m.role === "user" &&
        !m.streaming &&
        !m.error &&
        (Boolean((m.content || "").trim()) ||
          (Array.isArray(m.references) && m.references.length > 0)),
    )
    .map((m, index) => ({
      id: m.id,
      index,
      label: getUserMessageNavLabel(m),
    }));
}
