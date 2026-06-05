"use client";

import { useEffect, useState } from "react";
import { SaveIco, Spinner } from "@/app/components/icons";
import SourcesListPanel from "./SourcesListPanel";
import SlideDecksPanel from "./SlideDecksPanel";
import SavedQuizzesPanel from "./SavedQuizzesPanel";
import FlashcardsPanel from "./FlashcardsPanel";
import HighlightsPanel from "./HighlightsPanel";
import ReferencesPanel from "./ReferencesPanel";
import CollapsibleSidebarSection from "./CollapsibleSidebarSection";

function withSheetClose(onClose, fn) {
  if (typeof fn !== "function") return fn;
  return (...args) => {
    onClose();
    return fn(...args);
  };
}

function buildSectionOpenState({ initialSection, showReferences, isLecturer }) {
  const ids = ["files"];
  if (showReferences) ids.push("references");
  ids.push("slideDecks", "quizzes");
  if (!isLecturer) ids.push("flashcards");
  ids.push("highlights");

  const next = {};
  for (const id of ids) {
    next[id] = initialSection ? id === initialSection : id === "files";
  }
  return next;
}

export default function MobileMoreSheet({
  open,
  onClose,
  initialSection = null,
  summary,
  extraSources,
  onSourcePreview,
  referencesProps,
  slideDecksProps,
  quizSetsProps,
  flashcardSetsProps,
  highlightsProps,
}) {
  if (!open) return null;

  const refCount = referencesProps?.references?.length ?? 0;
  const isLecturer = summary?.summarizeFor === "lecturer";
  const showReferences =
    isLecturer &&
    referencesProps != null &&
    (referencesProps.loading || refCount > 0);
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

  const [sectionOpen, setSectionOpen] = useState(() =>
    buildSectionOpenState({ initialSection, showReferences, isLecturer }),
  );

  useEffect(() => {
    if (!open) return;
    setSectionOpen(
      buildSectionOpenState({ initialSection, showReferences, isLecturer }),
    );
    if (!initialSection) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`mob-more-sec-${initialSection}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [open, initialSection, showReferences, isLecturer]);

  const setSection = (id, value) => {
    setSectionOpen((prev) => ({ ...prev, [id]: value }));
  };

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
        <div className="mob-more-body sources-scroll">
          <div id="mob-more-sec-files">
            <CollapsibleSidebarSection
              id="files"
              title="Attached files"
              badge={fileCount || null}
              open={sectionOpen.files ?? true}
              onOpenChange={(v) => setSection("files", v)}
              persist={false}
            >
              <SourcesListPanel
                summary={summary}
                extraSources={extraSources}
                onPreview={onSourcePreview}
                emptyMessage="No attached sources."
                listClassName="src-list src-list--section"
              />
            </CollapsibleSidebarSection>
          </div>

          {showReferences && (
            <div id="mob-more-sec-references">
              <CollapsibleSidebarSection
                id="references"
                title="References"
                badge={refCount || null}
                open={sectionOpen.references ?? false}
                onOpenChange={(v) => setSection("references", v)}
                persist={false}
              >
                <ReferencesPanel {...referencesProps} embedded />
              </CollapsibleSidebarSection>
            </div>
          )}

          <div id="mob-more-sec-slideDecks">
            <CollapsibleSidebarSection
              id="slideDecks"
              title="Slide decks"
              badge={deckCount || null}
              open={sectionOpen.slideDecks ?? false}
              onOpenChange={(v) => setSection("slideDecks", v)}
              persist={false}
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
                onPreview={withSheetClose(onClose, slideDecksProps?.onPreview)}
              />
            </CollapsibleSidebarSection>
          </div>

          <div id="mob-more-sec-quizzes">
            <CollapsibleSidebarSection
              id="quizzes"
              title={
                quizSetsProps?.isLecturer ? "Class quizzes" : "Saved quizzes"
              }
              badge={quizCount || null}
              open={sectionOpen.quizzes ?? false}
              onOpenChange={(v) => setSection("quizzes", v)}
              persist={false}
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
                showHelpText={false}
                onOpenSet={withSheetClose(onClose, quizSetsProps?.onOpenSet)}
                onOpenAttempt={withSheetClose(
                  onClose,
                  quizSetsProps?.onOpenAttempt,
                )}
              />
            </CollapsibleSidebarSection>
          </div>

          {!isLecturer && (
            <div id="mob-more-sec-flashcards">
              <CollapsibleSidebarSection
                id="flashcards"
                title="Flashcards"
                badge={flashcardCount || null}
                open={sectionOpen.flashcards ?? false}
                onOpenChange={(v) => setSection("flashcards", v)}
                persist={false}
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
                  showHelpText={false}
                  onOpenSet={withSheetClose(
                    onClose,
                    flashcardSetsProps?.onOpenSet,
                  )}
                  onEditSet={withSheetClose(
                    onClose,
                    flashcardSetsProps?.onEditSet,
                  )}
                />
              </CollapsibleSidebarSection>
            </div>
          )}

          <div id="mob-more-sec-highlights">
            <CollapsibleSidebarSection
              id="highlights"
              title="Highlights"
              badge={hlCount || null}
              open={sectionOpen.highlights ?? false}
              onOpenChange={(v) => setSection("highlights", v)}
              persist={false}
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
                onHighlightClick={onClose}
              />
            </CollapsibleSidebarSection>
          </div>
        </div>
      </div>
    </div>
  );
}
