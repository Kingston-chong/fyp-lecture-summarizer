/**
 * Visible label + accessible title for summary action bar buttons.
 * @param {{ isLecturer: boolean, compact: boolean }} opts
 */
export function getSummaryActBarLabels({ isLecturer, compact }) {
  const quizFull = isLecturer ? "Generate class quiz" : "Generate quiz";
  const quizShort = isLecturer ? "Class quiz" : "Quiz";

  const flashcardsFull = "Generate flashcards";
  const flashcardsShort = "Flashcards";

  const manualFull = "Create cards manually";
  const manualShort = "Manual";

  const pdfFull = "Save as PDF";
  const pdfShort = "PDF";

  const slidesFull = "Generate slides";
  const slidesShort = "Slides";

  const pick = (full, short) => ({
    label: compact ? short : full,
    title: full,
  });

  return {
    quiz: pick(quizFull, quizShort),
    flashcards: pick(flashcardsFull, flashcardsShort),
    manual: pick(manualFull, manualShort),
    pdf: pick(pdfFull, pdfShort),
    slides: pick(slidesFull, slidesShort),
  };
}
