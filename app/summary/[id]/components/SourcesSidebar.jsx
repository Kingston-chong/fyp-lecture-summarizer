"use client";

import { SaveIco, Spinner } from "@/app/components/icons";
import SourcesListPanel from "./SourcesListPanel";
import SlideDecksPanel from "./SlideDecksPanel";
import SavedQuizzesPanel from "./SavedQuizzesPanel";
import HighlightsPanel from "./HighlightsPanel";
import ReferencesPanel from "./ReferencesPanel";
import CollapsibleSidebarSection from "./CollapsibleSidebarSection";

export default function SourcesSidebar({
  sourcesWidth,
  onSplitterMouseDown,
  summary,
  extraSources,
  onSourcePreview,
  referencesProps,
  slideDecksProps,
  quizSetsProps,
  highlightsProps,
}) {
  const showReferences =
    summary?.summarizeFor === "lecturer" && referencesProps != null;

  const baseFiles = summary?.files || [];
  const extraFiles = (extraSources || []).filter(
    (es) => !baseFiles.some((f) => f.id === es.id),
  );
  const fileCount = baseFiles.length + extraFiles.length;
  const refCount = referencesProps?.references?.length ?? 0;
  const deckCount = slideDecksProps?.slideDecks?.length ?? 0;
  const quizCount = quizSetsProps?.quizSets?.length ?? 0;
  const hlCount =
    (highlightsProps?.highlights?.length ?? 0) +
    (highlightsProps?.pendingHighlights?.length ?? 0);

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
          <span className="src-title">Sources</span>
        </div>

        <div className="sources-scroll">
          <CollapsibleSidebarSection
            id="files"
            title="Attached files"
            badge={fileCount || null}
            defaultOpen
          >
            <SourcesListPanel
              summary={summary}
              extraSources={extraSources}
              onPreview={onSourcePreview}
              listClassName="src-list src-list--section"
            />
          </CollapsibleSidebarSection>

          {showReferences && (
            <CollapsibleSidebarSection
              id="references"
              title="References"
              badge={refCount || null}
              defaultOpen
            >
              <ReferencesPanel {...referencesProps} embedded />
            </CollapsibleSidebarSection>
          )}

          <CollapsibleSidebarSection
            id="slideDecks"
            title="Slide decks"
            badge={deckCount || null}
            defaultOpen={false}
            actions={
              <button
                type="button"
                className="sd-refresh-btn"
                title="Refresh slide decks"
                disabled={slideDecksProps?.slideDecksLoading}
                onClick={slideDecksProps?.onRefresh}
              >
                {slideDecksProps?.slideDecksLoading ? (
                  <Spinner size={11} />
                ) : (
                  "↻"
                )}
              </button>
            }
          >
            <SlideDecksPanel
              {...slideDecksProps}
              embedded
              panelClassName="hl-panel sd-panel hl-panel--embedded"
            />
          </CollapsibleSidebarSection>

          <CollapsibleSidebarSection
            id="quizzes"
            title={quizSetsProps?.isLecturer ? "Class quizzes" : "Saved quizzes"}
            badge={quizCount || null}
            defaultOpen={false}
            actions={
              <button
                type="button"
                className="sd-refresh-btn"
                title="Refresh saved quizzes"
                disabled={quizSetsProps?.quizSetsLoading}
                onClick={quizSetsProps?.onRefresh}
              >
                {quizSetsProps?.quizSetsLoading ? (
                  <Spinner size={11} />
                ) : (
                  "↻"
                )}
              </button>
            }
          >
            <SavedQuizzesPanel
              {...quizSetsProps}
              embedded
              panelClassName="hl-panel sd-panel hl-panel--embedded"
            />
          </CollapsibleSidebarSection>

          <CollapsibleSidebarSection
            id="highlights"
            title="Highlights"
            badge={hlCount || null}
            defaultOpen={false}
            actions={
              <button
                type="button"
                className="hl-save-btn"
                title={
                  highlightsProps?.pendingHighlights?.length
                    ? `Save ${highlightsProps.pendingHighlights.length} highlight(s)`
                    : "No unsaved highlights"
                }
                disabled={
                  !highlightsProps?.pendingHighlights?.length ||
                  highlightsProps?.hlSaving ||
                  highlightsProps?.hlLoading
                }
                onClick={highlightsProps?.onSave}
                aria-label="Save highlights"
              >
                {highlightsProps?.hlSaving ? (
                  <Spinner size={12} />
                ) : (
                  <SaveIco size={14} />
                )}
              </button>
            }
          >
            <HighlightsPanel
              {...highlightsProps}
              embedded
              panelClassName="hl-panel hl-panel--embedded"
            />
          </CollapsibleSidebarSection>
        </div>
      </aside>
    </>
  );
}
