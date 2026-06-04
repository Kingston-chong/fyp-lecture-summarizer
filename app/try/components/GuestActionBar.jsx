"use client";

import Button from "@/app/components/ui/Button";
import {
  FlashcardsIco,
  PdfIco,
  QuizIco,
  SlidesIco,
} from "@/app/components/icons";

export default function GuestActionBar({ hasSummary, onRequireAuth }) {
  const lock = (feature, label, icon, variant) => (
    <Button
      key={feature}
      type="button"
      variant={variant}
      className="guest-action-btn"
      onClick={() => onRequireAuth(feature)}
      title={`Sign up to ${label}`}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );

  return (
    <div className="guest-action-bar" role="toolbar" aria-label="Summary actions">
      {lock("quiz", "Generate quiz", <QuizIco />, "quiz")}
      {lock("flashcards", "Flashcards", <FlashcardsIco />, "flashcard")}
      {lock(
        "revision",
        "Revision sheet",
        <PdfIco />,
        "revision",
      )}
      {lock("slides", "Generate slides", <SlidesIco />, "slides")}
      <span className="guest-action-hint">
        {hasSummary
          ? "Copy your summary below. Register to save and unlock tools."
          : "Complete a summary to copy text."}
      </span>
    </div>
  );
}
