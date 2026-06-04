"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/app/components/ui/Button";
import {
  ChevronDownIcon,
  FlashcardsIco,
  ManualCardsIco,
  PdfIco,
  QuizIco,
  SlidesIco,
  Spinner,
} from "@/app/components/icons";

export default function SummaryActionBar({
  mode = "full",
  isLecturerSummary,
  pdfLoading,
  hasSummary,
  onQuiz,
  onGenerateFlashcards,
  onCreateFlashcardsManually,
  onSavePdf,
  onGenerateRevisionSheet = () => {},
  revisionSheetLoading = false,
  onGenerateSlides,
  shareAction = null,
}) {
  const showDesktopButtons = mode === "full" || mode === "desktop";
  const showMobileMenu = mode === "full" || mode === "mobile";
  const isCompactMenu = mode === "mobile";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  const actions = useMemo(() => {
    const items = [
      {
        id: "quiz",
        label: isLecturerSummary ? "Generate class quiz" : "Generate quiz",
        icon: QuizIco,
        variant: "quiz",
        onClick: onQuiz,
        disabled: false,
      },
    ];
    if (!isLecturerSummary) {
      items.push(
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
      );
    }
    items.push(
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
    );
    return items;
  }, [
    isLecturerSummary,
    onQuiz,
    onGenerateFlashcards,
    onCreateFlashcardsManually,
    onGenerateRevisionSheet,
    revisionSheetLoading,
    onSavePdf,
    onGenerateSlides,
    pdfLoading,
    hasSummary,
  ]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const runAction = useCallback(
    (action) => {
      if (action.disabled) return;
      closeMenu();
      action.onClick();
    },
    [closeMenu],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    const onPointerDown = (e) => {
      if (menuWrapRef.current?.contains(e.target)) return;
      closeMenu();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, closeMenu]);

  return (
    <div
      className={`act-bar${mode === "desktop" ? " act-bar--desktop-only" : ""}${mode === "mobile" ? " act-bar--mobile-inline" : ""}`}
    >
      {showDesktopButtons && (
      <div className="act-bar-btns act-bar-btns--desktop">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              className="act-bar-btn"
              variant={action.variant}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.loading ? <Spinner size={13} /> : <Icon />}
              {action.label}
            </Button>
          );
        })}
        {shareAction}
      </div>
      )}

      {showMobileMenu && (
      <div
        className="act-bar-menu-wrap"
        ref={menuWrapRef}
        data-open={menuOpen ? "" : undefined}
      >
        <Button
          type="button"
          className={`act-bar-menu-trigger${isCompactMenu ? " act-bar-menu-trigger--compact" : ""}`}
          variant="default"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span>Actions</span>
          <ChevronDownIcon size={isCompactMenu ? 10 : 12} />
        </Button>
        {menuOpen && (
          <div className="act-bar-menu" role="menu" aria-label="Summary actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  className={`act-bar-menu-item act-bar-menu-item--${action.variant}`}
                  disabled={action.disabled}
                  onClick={() => runAction(action)}
                >
                  <span className="act-bar-menu-item-ico" aria-hidden>
                    {action.loading ? <Spinner size={14} /> : <Icon />}
                  </span>
                  <span className="act-bar-menu-item-label">{action.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
