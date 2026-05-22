"use client";

import { useCallback } from "react";
import GenerateSlidesModal from "@/app/components/GenerateSlidesModal";
import AlaiSlidesPreviewModal from "@/app/components/AlaiSlidesPreviewModal";
import QuizSettingsModal from "@/app/components/QuizSettingsModal";
import QuizViewModal from "@/app/components/QuizViewModal";
import LecturerQuizReviewModal from "@/app/components/LecturerQuizReviewModal";
import FlashcardGenerateModal from "./FlashcardGenerateModal";
import FlashcardStudyView from "./FlashcardStudyView";
import { parseNumericSummaryId, settingsFromQuizSet } from "../helpers";

export default function SummaryModalStack({
  slidesModal,
  setSlidesModal,
  summary,
  summaryId,
  fetchSlideDecks,
  slideDeckPreviewOpen,
  setSlideDeckPreviewOpen,
  slideDeckPreviewUrl,
  slideDeckRemotePptUrl,
  slideDeckPreviewTitle,
  slideDeckDlRef,
  quizModal,
  setQuizModal,
  setQuizData,
  setQuizSettings,
  setQuizView,
  fetchQuizSets,
  quizView,
  quizData,
  quizSettings,
  setQuizViewState,
  flashcardModal,
  setFlashcardModal,
  flashcardView,
  flashcardData,
  setFlashcardData,
  setFlashcardView,
  fetchFlashcardSets,
  onUpdateFlashcard,
  onDeleteFlashcard,
  onResetFlashcardStudy,
}) {
  const isLecturer = summary?.summarizeFor === "lecturer";
  const numericSummaryId = parseNumericSummaryId(summaryId);

  const handleSlideDeckDownload = useCallback(async () => {
    const fn = slideDeckDlRef.current;
    if (typeof fn === "function") await fn();
  }, [slideDeckDlRef]);

  return (
    <>
      {slidesModal && (
        <GenerateSlidesModal
          onClose={() => setSlidesModal(false)}
          summaryText={summary?.output || ""}
          summarizeFor={summary?.summarizeFor || "student"}
          summaryId={numericSummaryId}
          onSlideDecksChanged={fetchSlideDecks}
        />
      )}

      {slideDeckPreviewOpen && (
        <AlaiSlidesPreviewModal
          onClose={() => setSlideDeckPreviewOpen(false)}
          previewUrl={slideDeckPreviewUrl}
          remotePptUrl={slideDeckRemotePptUrl}
          title={slideDeckPreviewTitle}
          subtitle="Saved slide deck"
          onDownload={handleSlideDeckDownload}
        />
      )}

      {quizModal && (
        <QuizSettingsModal
          summaryId={summaryId}
          mode={isLecturer ? "lecturer" : "student"}
          onClose={() => setQuizModal(false)}
          onGenerated={(quiz) => {
            setQuizModal(false);
            setQuizData(quiz);
            setQuizSettings(settingsFromQuizSet(quiz));
            setQuizView(true);
            void fetchQuizSets();
          }}
        />
      )}

      {quizView && quizData && isLecturer && (
        <LecturerQuizReviewModal
          key={quizData.id}
          quizSet={quizData}
          summaryId={numericSummaryId}
          onClose={() => setQuizViewState(false)}
          onRegenerate={() => {
            setQuizViewState(false);
            setQuizModal(true);
          }}
          onPublishChange={() => void fetchQuizSets()}
        />
      )}

      {quizView && quizData && !isLecturer && (
        <QuizViewModal
          key={quizData.id}
          quizSet={quizData}
          settings={quizSettings}
          summaryId={summaryId}
          onAttemptSaved={() => void fetchQuizSets()}
          onClose={() => setQuizViewState(false)}
        />
      )}

      {flashcardModal && (
        <FlashcardGenerateModal
          summaryId={numericSummaryId ?? summaryId}
          onClose={() => setFlashcardModal(false)}
          onGenerated={(flashcardSet) => {
            setFlashcardModal(false);
            setFlashcardData(flashcardSet);
            setFlashcardView(true);
            void fetchFlashcardSets();
          }}
        />
      )}

      {flashcardView && flashcardData && (
        <FlashcardStudyView
          key={flashcardData.id}
          flashcardSet={flashcardData}
          onClose={() => setFlashcardView(false)}
          onUpdateCard={onUpdateFlashcard}
          onDeleteCard={onDeleteFlashcard}
          onResetStudyProgress={onResetFlashcardStudy}
          onFlashcardSetChange={setFlashcardData}
        />
      )}
    </>
  );
}
