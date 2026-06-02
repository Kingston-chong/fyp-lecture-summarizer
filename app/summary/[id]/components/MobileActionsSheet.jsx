"use client";

import {
  FlashcardsIco,
  ManualCardsIco,
  PdfIco,
  QuizIco,
  SlidesIco,
  Spinner,
} from "@/app/components/icons";

export default function MobileActionsSheet({
  open,
  onClose,
  isLecturerSummary,
  pdfLoading,
  hasSummary,
  onQuiz,
  onGenerateFlashcards,
  onCreateFlashcardsManually,
  onSavePdf,
  onGenerateSlides,
}) {
  if (!open) return null;

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
    if (action.disabled) return;
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
      <div className="mob-more-sheet mob-actions-sheet" onClick={(e) => e.stopPropagation()}>
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
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                className={`mob-actions-item mob-actions-item--${action.variant}`}
                disabled={action.disabled}
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
