import { formatReplyExcerptLabel } from "@/lib/chatReplyDisplay";

/**
 * Compact reply context: ↳ excerpt label(s) + optional request pill (ChatGPT-style).
 * @param {{
 *   references: { id?: string | number; text: string }[];
 *   requestText?: string;
 *   onRemoveReference?: (id: string | number) => void;
 *   variant?: "composer" | "message";
 * }} props
 */
export default function ChatReplyQuote({
  references = [],
  requestText = "",
  onRemoveReference,
  variant = "composer",
}) {
  const refs = Array.isArray(references) ? references : [];
  if (refs.length === 0) return null;

  const request = String(requestText || "").trim();
  const isComposer = variant === "composer";

  return (
    <div
      className={`chat-reply-compact ${isComposer ? "chat-reply-compact--composer" : "chat-reply-compact--message"}`}
      aria-label="Reply context"
    >
      <div className="chat-reply-compact-body">
        <ul className="chat-reply-ref-list">
          {refs.map((r, i) => (
            <li key={r.id ?? `ref-${i}`} className="chat-reply-ref-line">
              <span className="chat-reply-arrow" aria-hidden>
                ↳
              </span>
              <span className="chat-reply-ref-label" title={r.text}>
                {formatReplyExcerptLabel(r.text)}
              </span>
              {isComposer && onRemoveReference && (
                <button
                  type="button"
                  className="chat-reply-ref-remove"
                  onClick={() => onRemoveReference(r.id)}
                  aria-label={`Remove quote ${i + 1}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {request ? (
          <span className="chat-reply-request-pill">{request}</span>
        ) : null}
      </div>
    </div>
  );
}
