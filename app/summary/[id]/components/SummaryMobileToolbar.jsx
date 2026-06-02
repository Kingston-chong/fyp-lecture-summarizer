"use client";

import {
  ActionsMenuIco,
  Chevron,
  ChevronDownIcon,
  DotsIcon,
  HighlightIco,
} from "@/app/components/icons";
import { HIGHLIGHT_PRESETS } from "../helpers";

/**
 * Mobile summary toolbar: Highlight, More, Actions — uniform chips.
 */
export default function SummaryMobileToolbar({
  summaryLoading,
  hasSummaryOutput,
  hlModeActive,
  onToggleHlMode,
  hlColorMenuOpen,
  onToggleHlColorMenu,
  hlToolbarRef,
  hlColorHex,
  onHlColorPick,
  onOpenMore,
  onOpenActions,
}) {
  return (
    <div className="sum-chrome-mobile-block">
    <div className="sum-chrome-toolbar sum-chrome-toolbar--fill sum-head-actions sum-head-actions--labeled">
      <div
        className="sum-chrome-chip-group sum-hl-wrap"
        ref={hlToolbarRef}
        style={{ "--hl-pick": hlColorHex }}
      >
        <button
          type="button"
          className={`sum-chrome-chip sum-chrome-chip--hl sum-hl-main ${hlModeActive ? "on" : ""}`}
          aria-pressed={hlModeActive}
          disabled={summaryLoading || !hasSummaryOutput}
          onClick={onToggleHlMode}
        >
          <HighlightIco size={13} />
          <span className="sum-chrome-chip-txt">Highlight</span>
        </button>
        <button
          type="button"
          className={`sum-chrome-chip sum-chrome-chip--hl-chev sum-hl-chevron ${hlColorMenuOpen ? "open" : ""}`}
          aria-expanded={hlColorMenuOpen}
          aria-label="Highlight color"
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

      <button
        type="button"
        className="sum-chrome-chip sum-chrome-chip--more"
        title="Sources, decks, quizzes, highlights"
        onClick={onOpenMore}
        disabled={summaryLoading || !hasSummaryOutput}
      >
        <DotsIcon size={14} />
        <span className="sum-chrome-chip-txt">More</span>
      </button>

      <button
        type="button"
        className="sum-chrome-chip sum-chrome-chip--actions"
        title="Generate quiz, slides, PDF, and more"
        onClick={onOpenActions}
        disabled={summaryLoading || !hasSummaryOutput}
      >
        <ActionsMenuIco size={14} />
        <span className="sum-chrome-chip-txt">Actions</span>
        <ChevronDownIcon size={11} />
      </button>
    </div>
    {!summaryLoading && hasSummaryOutput ? (
      <p className="sum-chrome-more-hint">
        Tap <strong>More</strong> for files, decks, and quizzes. Unsaved
        highlights can be saved or cancelled beside the tags below.
      </p>
    ) : null}
    </div>
  );
}
