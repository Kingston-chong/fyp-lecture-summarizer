"use client";

import SourcesListPanel from "./SourcesListPanel";
import SlideDecksPanel from "./SlideDecksPanel";
import SavedQuizzesPanel from "./SavedQuizzesPanel";
import HighlightsPanel from "./HighlightsPanel";

export default function MobileMoreSheet({
  open,
  onClose,
  summary,
  extraSources,
  onSourcePreview,
  slideDecksProps,
  quizSetsProps,
  highlightsProps,
}) {
  if (!open) return null;

  return (
    <div
      className="mob-more-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="More options"
    >
      <div className="mob-more-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mob-more-handle" />
        <div className="mob-more-header">
          <span className="mob-more-title">More</span>
          <button
            type="button"
            className="mob-more-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mob-more-body">
          <SourcesListPanel
            summary={summary}
            extraSources={extraSources}
            onPreview={onSourcePreview}
            emptyMessage="No attached sources."
            wrapInPanel
          />
          <SlideDecksPanel
            {...slideDecksProps}
            panelClassName="hl-panel sd-panel"
          />
          <SavedQuizzesPanel
            {...quizSetsProps}
            panelClassName="hl-panel sd-panel"
            showHelpText={false}
          />
          <HighlightsPanel
            {...highlightsProps}
            panelClassName="hl-panel"
            onHighlightClick={onClose}
          />
        </div>
      </div>
    </div>
  );
}
