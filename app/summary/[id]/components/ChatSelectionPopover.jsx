"use client";

export default function ChatSelectionPopover({ draft, onReply }) {
  if (!draft?.text) return null;
  return (
    <div
      className="chat-selection-popover"
      style={{ left: draft.x, top: draft.y }}
    >
      <button
        type="button"
        className="chat-selection-reply"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onReply}
        aria-label="Reply with selected text"
      >
        Reply
      </button>
    </div>
  );
}
