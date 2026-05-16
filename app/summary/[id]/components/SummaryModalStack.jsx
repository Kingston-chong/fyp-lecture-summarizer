"use client";

import GenerateSlidesModal from "@/app/components/GenerateSlidesModal";
import AlaiSlidesPreviewModal from "@/app/components/AlaiSlidesPreviewModal";
import QuizSettingsModal from "@/app/components/QuizSettingsModal";
import QuizViewModal from "@/app/components/QuizViewModal";
import LecturerQuizReviewModal from "@/app/components/LecturerQuizReviewModal";
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
}) {
  const isLecturer = summary?.summarizeFor === "lecturer";
  const numericSummaryId = parseNumericSummaryId(summaryId);

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
          onDownload={(() => {
            const fn = slideDeckDlRef.current;
            return typeof fn === "function"
              ? async () => {
                  await fn();
                }
              : undefined;
          })()}
          onDownloadPdf={(() => {
            const fn = slideDeckPdfDlRef?.current;
            return typeof fn === "function"
              ? async () => {
                  await fn();
                }
              : undefined;
          })()}
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
    </>
  );
}
