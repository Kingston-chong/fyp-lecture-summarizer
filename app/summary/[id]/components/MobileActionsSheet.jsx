"use client";

import {
  FlashcardsIco,
  ManualCardsIco,
  PdfIco,
  QuizIco,
  SlidesIco,
  Spinner,
} from "@/app/components/icons";
import ShareChatButton from "./ShareChatButton";

export default function MobileActionsSheet({
  open,
  onClose,
  isLecturerSummary,
  pdfLoading,
  hasSummary,
  summaryId,
  summaryTitle = "",
  shareChatDisabled,
  shareChatDisabledTitle,
  onQuiz,
  onGenerateFlashcards,
  onCreateFlashcardsManually,
  onSavePdf,
  onGenerateRevisionSheet,
  revisionSheetLoading = false,
  onGenerateSlides,
  lockedFeatureIds = [],
}) {
  if (!open) return null;

  const locked = new Set(lockedFeatureIds);

  const actions = [
    {
      id: "quiz",
      label: isLecturerSummary ? "Generate class quiz" : "Generate quiz",
      icon: QuizIco,
      variant: "quiz",
      onClick: onQuiz,
      disabled: false,
    },
    ...(!isLecturerSummary
      ? [
          {
            id: "flashcards",
            label: "Generate flashcards",
            icon: FlashcardsIco,
            variant: "flashcard",
            onClick: onGenerateFlashcards,
            disabled: false,
          },
          {
            id: "flashcards-manual",
            label: "Create cards manually",
            icon: ManualCardsIco,
            variant: "flashcardManual",
            onClick: onCreateFlashcardsManually,
            disabled: false,
          },
          {
            id: "revision-sheet",
            label: revisionSheetLoading ? "Generating…" : "Revision sheet",
            icon: PdfIco,
            variant: "revision",
            onClick: onGenerateRevisionSheet,
            disabled: revisionSheetLoading || !hasSummary,
            loading: revisionSheetLoading,
          },
        ]
      : []),
    {
      id: "pdf",
      label: "Save as PDF",
      icon: PdfIco,
      variant: "pdf",
      onClick: onSavePdf,
      disabled: pdfLoading || !hasSummary,
      loading: pdfLoading,
    },
    {
      id: "slides",
      label: "Generate slides",
      icon: SlidesIco,
      variant: "slides",
      onClick: onGenerateSlides,
      disabled: false,
    },
  ];

  function run(action) {
    if (action.disabled && !locked.has(action.id)) return;
    onClose();
    action.onClick();
  }

  return (
    <div
      className="mob-more-overlay"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Summary actions"
    >
      <div
        className="mob-more-sheet mob-actions-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mob-more-handle" />
        <div className="mob-more-header">
          <span className="mob-more-title">Actions</span>
          <button
            type="button"
            className="mob-more-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mob-actions-body">
          {summaryId ? (
            <div className="mob-actions-share">
              <ShareChatButton
                variant="toolbar"
                summaryId={summaryId}
                summaryTitle={summaryTitle}
                disabled={shareChatDisabled}
                disabledTitle={shareChatDisabledTitle}
              />
            </div>
          ) : null}
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className={`mob-actions-item mob-actions-item--${action.variant}${locked.has(action.id) ? " mob-actions-item--locked" : ""}`}
                disabled={action.disabled && !locked.has(action.id)}
                onClick={() => run(action)}
              >
                <span className="mob-actions-item-ico" aria-hidden>
                  {action.loading ? <Spinner size={14} /> : <Icon />}
                </span>
                <span className="mob-actions-item-label">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
