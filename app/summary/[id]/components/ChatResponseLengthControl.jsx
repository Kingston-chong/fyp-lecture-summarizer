"use client";

import { Chevron } from "@/app/components/icons";
import { CHAT_RESPONSE_LENGTHS } from "../constants";

/** Response length dropdown — shown above the chat compose row. */
export default function ChatResponseLengthControl({
  chatResponseLength,
  onSelectLength,
  lengthOpen,
  onToggleLengthOpen,
  onCloseLength,
  disabled = false,
  labelId = "chat-response-length-label",
}) {
  return (
    <div className="chat-control-labeled chat-control-labeled--pref">
      <span className="chat-control-label" id={labelId}>
        Text response length:
      </span>
      <div className="mdl-wrap">
        <button
          type="button"
          className={`mdl-btn ${lengthOpen ? "open" : ""}`}
          title="How long the AI reply should be"
          aria-labelledby={labelId}
          onClick={onToggleLengthOpen}
          onBlur={() => setTimeout(() => onCloseLength(), 150)}
          disabled={disabled}
        >
          {CHAT_RESPONSE_LENGTHS.find((o) => o.id === chatResponseLength)
            ?.label || "Medium"}{" "}
          <Chevron open={lengthOpen} />
        </button>
        {lengthOpen && (
          <div className="mdl-menu">
            {CHAT_RESPONSE_LENGTHS.map((o) => (
              <div
                key={o.id}
                className={`mdl-opt ${chatResponseLength === o.id ? "on" : ""}`}
                onMouseDown={() => onSelectLength(o.id)}
              >
                {o.label} {chatResponseLength === o.id && "✓"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
