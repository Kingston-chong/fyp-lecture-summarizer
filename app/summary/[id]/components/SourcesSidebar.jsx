"use client";

import SourcesListPanel from "./SourcesListPanel";
import SlideDecksPanel from "./SlideDecksPanel";
import SavedQuizzesPanel from "./SavedQuizzesPanel";
import HighlightsPanel from "./HighlightsPanel";

export default function SourcesSidebar({
  sourcesWidth,
  onSplitterMouseDown,
  summary,
  extraSources,
  onSourcePreview,
  slideDecks,
  slideDecksProps,
  quizSetsProps,
  highlightsProps,
}) {
  return (
    <>
      <div
        className="sum-splitter"
        onMouseDown={onSplitterMouseDown}
        role="separator"
        aria-label="Resize sources panel"
      />
      <aside
        className="sources"
        aria-label="Sources"
        style={{ width: sourcesWidth }}
      >
        <div className="src-header">
          <span className="src-title">SOURCES</span>
        </div>
        <SourcesListPanel
          summary={summary}
          extraSources={extraSources}
          onPreview={onSourcePreview}
        />
        <SlideDecksPanel {...slideDecksProps} />
        <SavedQuizzesPanel {...quizSetsProps} />
        <HighlightsPanel {...highlightsProps} />
      </aside>
    </>
  );
}
