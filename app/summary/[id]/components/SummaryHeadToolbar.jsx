"use client";

import {
  Chevron,
  CopyIco,
  HighlightIco,
  SaveIco,
  Spinner,
} from "@/app/components/icons";
import { HIGHLIGHT_PRESETS } from "../helpers";

export default function SummaryHeadToolbar({
  className = "",
  showButtonLabels = false,
  summaryLoading,
  hasSummaryOutput,
  summaryCopied,
  onCopySummary,
  hlModeActive,
  onToggleHlMode,
  hlColorMenuOpen,
  onToggleHlColorMenu,
  hlToolbarRef,
  hlColorHex,
  onHlColorPick,
  pendingHighlightsCount = 0,
  hlSaving = false,
  onSaveHighlights,
  onOpenMobileMore,
}) {
  return (
    <div
      className={`sum-head-actions${showButtonLabels ? " sum-head-actions--labeled" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className={`sum-copy-btn ${summaryCopied ? "copied" : ""}`}
        title={summaryCopied ? "Copied!" : "Copy summary"}
        onClick={onCopySummary}
        disabled={summaryLoading || !hasSummaryOutput}
        aria-label="Copy summary"
      >
        {summaryCopied ? (
          <span className="sum-copy-txt">Copied</span>
        ) : (
          <CopyIco size={12} />
        )}
      </button>
      <div
        className="sum-hl-wrap"
        ref={hlToolbarRef}
        style={{ "--hl-pick": hlColorHex }}
      >
        <button
          type="button"
          className={`sum-hl-main ${hlModeActive ? "on" : ""}`}
          title={
            hlModeActive
              ? "Highlight on — drag to select text in the summary, then save highlights in the sidebar"
              : "Highlight — turn on, pick a color, select text in the summary to mark it"
          }
          aria-pressed={hlModeActive}
          aria-label={
            hlModeActive
              ? "Highlight mode on; select text in the summary"
              : "Turn on highlight mode to mark text in the summary"
          }
          disabled={summaryLoading || !hasSummaryOutput}
          onClick={onToggleHlMode}
        >
          <HighlightIco size={13} />
          <span className="sum-hl-main-txt">Highlight</span>
        </button>
        <button
          type="button"
          className={`sum-hl-chevron ${hlColorMenuOpen ? "open" : ""}`}
          title="Highlight color"
          aria-expanded={hlColorMenuOpen}
          aria-haspopup="true"
          disabled={summaryLoading || !hasSummaryOutput}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleHlColorMenu}
        >
          <Chevron open={hlColorMenuOpen} />
        </button>
        {hlColorMenuOpen && (
          <div className="sum-hl-menu" role="menu" aria-label="Highlight colors">
            <div className="sum-hl-menu-label">Color</div>
            <div className="sum-hl-swatch-row">
              {HIGHLIGHT_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  role="menuitem"
                  title={p.label}
                  className={`sum-hl-swatch ${hlColorHex === p.hex ? "cur" : ""}`}
                  style={{ backgroundColor: p.hex }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onHlColorPick(p.hex)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {pendingHighlightsCount > 0 && (
        <button
          type="button"
          className="sum-hl-save-btn"
          title={
            hlSaving
              ? "Saving highlights..."
              : `Save ${pendingHighlightsCount} highlight(s)`
          }
          aria-label={`Save ${pendingHighlightsCount} pending highlights`}
          onClick={onSaveHighlights}
          disabled={summaryLoading || !hasSummaryOutput || hlSaving}
          style={{ "--hl-pick": hlColorHex }}
        >
          {hlSaving ? <Spinner size={12} /> : <SaveIco size={12} />}
          <span className="sum-hl-save-count">{pendingHighlightsCount}</span>
        </button>
      )}
      <button
        type="button"
        className="mob-more-btn"
        title="More — sources, slide decks, quizzes, highlights"
        aria-label="More options"
        onClick={onOpenMobileMore}
        disabled={summaryLoading || !hasSummaryOutput}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
        <span className="mob-more-txt">More</span>
      </button>
    </div>
  );
}
