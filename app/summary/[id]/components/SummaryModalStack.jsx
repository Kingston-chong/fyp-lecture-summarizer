"use client";

import GenerateSlidesModal from "@/app/components/GenerateSlidesModal";
import AlaiSlidesPreviewModal from "@/app/components/AlaiSlidesPreviewModal";
import QuizSettingsModal from "@/app/components/QuizSettingsModal";
import QuizViewModal from "@/app/components/QuizViewModal";
import { settingsFromQuizSet } from "../helpers";

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
}) {
  return (
    <>
      {slidesModal && (
        <GenerateSlidesModal
          onClose={() => setSlidesModal(false)}
          summaryText={summary?.output || ""}
          summarizeFor={summary?.summarizeFor || "student"}
          summaryId={(() => {
            const n = Number.parseInt(String(summaryId ?? ""), 10);
            return Number.isFinite(n) && n > 0 ? n : null;
          })()}
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
        />
      )}

      {quizModal && (
        <QuizSettingsModal
          summaryId={summaryId}
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

      {quizView && quizData && (
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
