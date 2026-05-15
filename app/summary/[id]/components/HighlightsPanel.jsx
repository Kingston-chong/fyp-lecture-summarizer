"use client";

import { SaveIco, Spinner } from "@/app/components/icons";
import { DEFAULT_HL_HEX } from "../helpers";

export default function HighlightsPanel({
  highlights,
  pendingHighlights,
  hlLoading,
  hlSaving,
  onSave,
  onRemovePending,
  onDelete,
  onScrollTo,
  panelClassName = "hl-panel hl-panel--sources",
  onHighlightClick,
}) {
  const handleClick = (id) => {
    onScrollTo(id);
    onHighlightClick?.();
  };

  return (
    <div className={panelClassName} aria-label="Highlights">
      <div className="hl-head-row">
        <div className="hl-head">HIGHLIGHTS</div>
        <button
          type="button"
          className="hl-save-btn"
          title={
            pendingHighlights.length
              ? `Save ${pendingHighlights.length} highlight(s) to the server`
              : "No unsaved highlights"
          }
          disabled={pendingHighlights.length === 0 || hlSaving || hlLoading}
          onClick={onSave}
          aria-label="Save highlights"
        >
          {hlSaving ? <Spinner size={12} /> : <SaveIco size={14} />}
        </button>
      </div>
      {pendingHighlights.length > 0 && (
        <div className="hl-sub">
          {pendingHighlights.length} unsaved — click save. Leaving this page may
          prompt you if you have not saved.
        </div>
      )}
      {hlLoading ? (
        <div className="hl-empty">
          <Spinner size={12} /> Loading…
        </div>
      ) : highlights.length === 0 && pendingHighlights.length === 0 ? (
        <div className="hl-empty">
          Turn on the highlighter, pick a color, select text in the summary,
          then save here.
        </div>
      ) : (
        <>
          {pendingHighlights.map((p) => (
            <div
              key={p.clientId}
              className="hl-item pending"
              style={{
                ["--hl-accent"]:
                  p.color && /^#[0-9a-f]{6}$/i.test(p.color)
                    ? p.color
                    : DEFAULT_HL_HEX,
              }}
              onClick={() => handleClick(p.clientId)}
              title={p.quote}
            >
              <span className="hl-color-dot" />
              <div className="hl-quote">
                {p.quote.length > 140 ? `${p.quote.slice(0, 140)}…` : p.quote}
              </div>
              <button
                type="button"
                className="hl-x"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePending(p.clientId);
                }}
                aria-label="Remove unsaved highlight"
              >
                ×
              </button>
            </div>
          ))}
          {highlights.map((h) => (
            <div
              key={h.id}
              className="hl-item"
              style={{
                ["--hl-accent"]:
                  h.color && /^#[0-9a-f]{6}$/i.test(h.color)
                    ? h.color
                    : DEFAULT_HL_HEX,
              }}
              onClick={() => handleClick(h.id)}
              title={h.quote}
            >
              <span className="hl-color-dot" />
              <div className="hl-quote">
                {h.quote.length > 140 ? `${h.quote.slice(0, 140)}…` : h.quote}
              </div>
              <button
                type="button"
                className="hl-x"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(h.id);
                }}
                aria-label="Remove highlight"
              >
                ×
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
