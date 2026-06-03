"use client";

import { useCallback, useRef, useState } from "react";
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
  slideDeckPreviewLoading,
  slideDeckPreviewUnavailable,
  slideDeckPreviewTitle,
  slideDeckDlRef,
  slideDeckPdfDlRef,
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

  const [generatedSlidePreviewOpen, setGeneratedSlidePreviewOpen] =
    useState(false);
  const [generatedSlidePreview, setGeneratedSlidePreview] = useState(null);
  const generatedSlideDlRef = useRef(null);

  const handleGeneratedSlidePreviewClose = useCallback(() => {
    setGeneratedSlidePreviewOpen(false);
    setGeneratedSlidePreview(null);
    generatedSlideDlRef.current = null;
  }, []);

  const handleGeneratedSlideDownload = useCallback(async () => {
    const fn = generatedSlideDlRef.current;
    if (typeof fn === "function") await Promise.resolve(fn());
  }, []);

  const handleSlideDeckDownload = useCallback(async () => {
    const fn = slideDeckDlRef.current;
    if (typeof fn === "function") await Promise.resolve(fn());
  }, [slideDeckDlRef]);

  const handleSlideDeckPdfDownload = useCallback(async () => {
    const fn = slideDeckPdfDlRef.current;
    if (typeof fn === "function") await fn();
  }, [slideDeckPdfDlRef]);

  return (
    <>
      {slidesModal && (
        <GenerateSlidesModal
          onClose={() => setSlidesModal(false)}
          summaryText={summary?.output || ""}
          summarizeFor={summary?.summarizeFor || "student"}
          summaryId={numericSummaryId}
          onSlideDecksChanged={fetchSlideDecks}
          onOpenPreview={(payload) => {
            generatedSlideDlRef.current = payload?.onDownload ?? null;
            setGeneratedSlidePreview({
              previewUrl: payload?.previewUrl || "",
              remotePptUrl: payload?.remotePptUrl || "",
              provider: payload?.provider || "alai",
              title: payload?.title || "Create Presentation Slides...",
            });
            setGeneratedSlidePreviewOpen(true);
            setSlidesModal(false);
          }}
        />
      )}

      {generatedSlidePreviewOpen && generatedSlidePreview && (
        <AlaiSlidesPreviewModal
          onClose={handleGeneratedSlidePreviewClose}
          previewUrl={generatedSlidePreview.previewUrl}
          remotePptUrl={generatedSlidePreview.remotePptUrl}
          provider={generatedSlidePreview.provider}
          title={generatedSlidePreview.title}
          subtitle="Your presentation slides is ready.."
          onDownload={handleGeneratedSlideDownload}
        />
      )}

      {slideDeckPreviewOpen && (
        <AlaiSlidesPreviewModal
          onClose={() => setSlideDeckPreviewOpen(false)}
          previewUrl={slideDeckPreviewUrl}
          remotePptUrl={slideDeckRemotePptUrl}
          previewLoading={slideDeckPreviewLoading}
          previewUnavailable={slideDeckPreviewUnavailable}
          title={slideDeckPreviewTitle}
          subtitle="Saved slide deck"
          onDownload={handleSlideDeckDownload}
          onDownloadPdf={handleSlideDeckPdfDownload}
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

      {flashcardModal && !isLecturer && (
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

      {flashcardView && flashcardData && !isLecturer && (
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
