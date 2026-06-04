"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CollapseAllIcon, SaveIco, SidebarHideIcon, Spinner } from "@/app/components/icons";
import SourcesListPanel from "./SourcesListPanel";
import SlideDecksPanel from "./SlideDecksPanel";
import SavedQuizzesPanel from "./SavedQuizzesPanel";
import FlashcardsPanel from "./FlashcardsPanel";
import HighlightsPanel from "./HighlightsPanel";
import ReferencesPanel from "./ReferencesPanel";
import CollapsibleSidebarSection, {
  readSidebarSectionsStored,
  writeSidebarSectionsStored,
} from "./CollapsibleSidebarSection";

function mergeSectionOpen(ids, stored, value) {
  const next = { ...stored };
  for (const id of ids) next[id] = value;
  return next;
}

export default function SourcesSidebar({
  sourcesWidth,
  onSplitterMouseDown,
  onCollapse,
  summary,
  extraSources,
  onSourcePreview,
  referencesProps,
  slideDecksProps,
  quizSetsProps,
  flashcardSetsProps,
  highlightsProps,
}) {
  const searchParams = useSearchParams();
  const refCount = referencesProps?.references?.length ?? 0;
  const isLecturer = summary?.summarizeFor === "lecturer";
  const showReferences =
    isLecturer &&
    referencesProps != null &&
    (referencesProps.loading || refCount > 0);

  const sectionIds = useMemo(() => {
    const ids = ["files", "slideDecks", "quizzes"];
    if (!isLecturer) ids.push("flashcards");
    ids.push("highlights");
    if (showReferences) ids.splice(1, 0, "references");
    return ids;
  }, [showReferences, isLecturer]);

  const sectionDefaults = useMemo(
    () => ({
      files: true,
      references: true,
      slideDecks: false,
      quizzes: false,
      flashcards: false,
      highlights: false,
    }),
    [],
  );

  const [sectionOpen, setSectionOpen] = useState(() => ({
    ...sectionDefaults,
    ...readSidebarSectionsStored(),
  }));

  const isSectionOpen = useCallback(
    (id) => {
      if (typeof sectionOpen[id] === "boolean") return sectionOpen[id];
      return sectionDefaults[id] ?? false;
    },
    [sectionOpen, sectionDefaults],
  );

  const setSection = useCallback((id, open) => {
    setSectionOpen((prev) => {
      const next = { ...prev, [id]: open };
      writeSidebarSectionsStored(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const sources = searchParams?.get("sources");
    if (!sources || !["files", "slideDecks", "quizzes"].includes(sources)) {
      return;
    }
    setSectionOpen((prev) => {
      const next = { ...prev, [sources]: true };
      writeSidebarSectionsStored(next);
      return next;
    });
  }, [searchParams]);

  const collapseAll = useCallback(() => {
    setSectionOpen((prev) => {
      const next = mergeSectionOpen(sectionIds, prev, false);
      writeSidebarSectionsStored(next);
      return next;
    });
  }, [sectionIds]);

  const baseFiles = summary?.files || [];
  const extraFiles = (extraSources || []).filter(
    (es) => !baseFiles.some((f) => f.id === es.id),
  );
  const fileCount = baseFiles.length + extraFiles.length;
  const deckCount = slideDecksProps?.slideDecks?.length ?? 0;
  const quizCount = quizSetsProps?.quizSets?.length ?? 0;
  const flashcardCount = flashcardSetsProps?.flashcardSets?.length ?? 0;
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
          <div className="src-header-actions">
            <button
              type="button"
              className="src-sections-collapse-btn"
              title="Collapse all sections"
              aria-label="Collapse all sections"
              onClick={collapseAll}
            >
              <CollapseAllIcon size={14} />
            </button>
            {onCollapse ? (
              <button
                type="button"
                className="src-panel-hide-btn"
                title="Hide sources panel"
                aria-label="Hide sources panel"
                onClick={onCollapse}
              >
                <SidebarHideIcon size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="sources-scroll">
          <CollapsibleSidebarSection
            id="files"
            title="Attached files"
            badge={fileCount || null}
            open={isSectionOpen("files")}
            onOpenChange={(v) => setSection("files", v)}
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
              open={isSectionOpen("references")}
              onOpenChange={(v) => setSection("references", v)}
            >
              <ReferencesPanel {...referencesProps} embedded />
            </CollapsibleSidebarSection>
          )}

          <CollapsibleSidebarSection
            id="slideDecks"
            title="Slide decks"
            badge={deckCount || null}
            open={isSectionOpen("slideDecks")}
            onOpenChange={(v) => setSection("slideDecks", v)}
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
            title={
              quizSetsProps?.isLecturer ? "Class quizzes" : "Saved quizzes"
            }
            badge={quizCount || null}
            open={isSectionOpen("quizzes")}
            onOpenChange={(v) => setSection("quizzes", v)}
            actions={
              <button
                type="button"
                className="sd-refresh-btn"
                title="Refresh saved quizzes"
                disabled={quizSetsProps?.quizSetsLoading}
                onClick={quizSetsProps?.onRefresh}
              >
                {quizSetsProps?.quizSetsLoading ? <Spinner size={11} /> : "↻"}
              </button>
            }
          >
            <SavedQuizzesPanel
              {...quizSetsProps}
              embedded
              panelClassName="hl-panel sd-panel hl-panel--embedded"
            />
          </CollapsibleSidebarSection>

          {!isLecturer && (
            <CollapsibleSidebarSection
              id="flashcards"
              title="Flashcards"
              badge={flashcardCount || null}
              open={isSectionOpen("flashcards")}
              onOpenChange={(v) => setSection("flashcards", v)}
              actions={
                <button
                  type="button"
                  className="sd-refresh-btn"
                  title="Refresh saved flashcards"
                  disabled={flashcardSetsProps?.flashcardSetsLoading}
                  onClick={flashcardSetsProps?.onRefresh}
                >
                  {flashcardSetsProps?.flashcardSetsLoading ? (
                    <Spinner size={11} />
                  ) : (
                    "↻"
                  )}
                </button>
              }
            >
              <FlashcardsPanel
                {...flashcardSetsProps}
                embedded
                panelClassName="hl-panel sd-panel hl-panel--embedded"
              />
            </CollapsibleSidebarSection>
          )}

          <CollapsibleSidebarSection
            id="highlights"
            title="Highlights"
            badge={hlCount || null}
            open={isSectionOpen("highlights")}
            onOpenChange={(v) => setSection("highlights", v)}
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
