/**
 * Format and download quiz sets for lecturer sharing.
 */

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map(String);
  if (options && typeof options === "object") {
    return Object.values(options).map(String);
  }
  return [];
}

function letterForIndex(i) {
  return String.fromCharCode(65 + i);
}

function formatQuestionBlock(q, idx, { variant }) {
  const n = idx + 1;
  const type = q.type || "Question";
  const lines = [];
  lines.push(`### Question ${n} (${type})`);
  lines.push("");
  lines.push(q.question || "");
  lines.push("");

  const opts = normalizeOptions(q.options);
  if (q.type === "MCQ" && opts.length > 0) {
    opts.forEach((opt, i) => {
      const mark =
        variant === "answerKey" &&
        String(opt).trim() === String(q.answer || "").trim()
          ? " ✓"
          : "";
      lines.push(`${letterForIndex(i)}. ${opt}${mark}`);
    });
    lines.push("");
  } else if (q.type === "True/False") {
    ["True", "False"].forEach((opt) => {
      const mark = variant === "answerKey" && opt === q.answer ? " ✓" : "";
      lines.push(`- ${opt}${mark}`);
    });
    lines.push("");
  }

  if (variant === "answerKey") {
    lines.push(`**Correct answer:** ${q.answer ?? "—"}`);
    if (q.explanation) {
      lines.push("");
      lines.push(`**Explanation:** ${q.explanation}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatQuestionPlain(q, idx, { variant }) {
  const n = idx + 1;
  const lines = [];
  lines.push(`Question ${n} (${q.type || "Question"})`);
  lines.push(q.question || "");
  const opts = normalizeOptions(q.options);
  if (q.type === "MCQ" && opts.length > 0) {
    opts.forEach((opt, i) => {
      const mark =
        variant === "answerKey" &&
        String(opt).trim() === String(q.answer || "").trim()
          ? " [CORRECT]"
          : "";
      lines.push(`  ${letterForIndex(i)}. ${opt}${mark}`);
    });
  } else if (q.type === "True/False") {
    ["True", "False"].forEach((opt) => {
      const mark =
        variant === "answerKey" && opt === q.answer ? " [CORRECT]" : "";
      lines.push(`  - ${opt}${mark}`);
    });
  }
  if (variant === "answerKey") {
    lines.push(`Correct answer: ${q.answer ?? "—"}`);
    if (q.explanation) lines.push(`Explanation: ${q.explanation}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function formatQuizMarkdown(quizSet, { variant = "student" } = {}) {
  const questions = [...(quizSet?.questions || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const title = quizSet?.title || "Quiz";
  const header =
    variant === "answerKey" ? `# ${title} — Answer key\n` : `# ${title}\n`;
  const meta = [];
  const settings = quizSet?.settings;
  if (settings?.difficulty) meta.push(`Difficulty: ${settings.difficulty}`);
  if (settings?.timeLimit > 0)
    meta.push(`Suggested time: ${settings.timeLimit} min`);
  const metaBlock = meta.length ? `${meta.join(" · ")}\n\n` : "";

  const body = questions
    .map((q, i) => formatQuestionBlock(q, i, { variant }))
    .join("\n");

  return `${header}${metaBlock}${body}`.trim() + "\n";
}

export function formatQuizPlainText(quizSet, { variant = "student" } = {}) {
  const questions = [...(quizSet?.questions || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const title = quizSet?.title || "Quiz";
  const header =
    variant === "answerKey" ? `${title} — Answer key\n` : `${title}\n`;
  const body = questions
    .map((q, i) => formatQuestionPlain(q, i, { variant }))
    .join("\n");
  return `${header}\n${body}`.trim() + "\n";
}

/** Paste-ready blocks for manual Google Forms entry */
export function formatQuizGoogleForms(quizSet) {
  const questions = [...(quizSet?.questions || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const lines = [
    `${quizSet?.title || "Quiz"} — copy each block into Google Forms`,
    "",
    "Steps:",
    "1. Open https://forms.google.com and create a blank quiz",
    "2. For each question below, add a new question and paste the text",
    "3. Set the correct answer in Forms using the [CORRECT] marker",
    "",
    "---",
    "",
  ];

  questions.forEach((q, idx) => {
    lines.push(`--- Question ${idx + 1} (${q.type}) ---`);
    lines.push(q.question || "");
    const opts = normalizeOptions(q.options);
    if (q.type === "MCQ" && opts.length > 0) {
      opts.forEach((opt, i) => {
        const mark =
          String(opt).trim() === String(q.answer || "").trim()
            ? " [CORRECT]"
            : "";
        lines.push(`  ${letterForIndex(i)}. ${opt}${mark}`);
      });
    } else if (q.type === "True/False") {
      lines.push(`  Correct: ${q.answer}`);
    } else {
      lines.push(`  Answer: ${q.answer}`);
    }
    if (q.explanation) {
      lines.push(`  (Explanation for you: ${q.explanation})`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

export function downloadTextFile(
  filename,
  content,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyTitle(title) {
  return (
    String(title || "quiz")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "quiz"
  );
}

/** Download answer key as PDF (client-only). */
export async function downloadQuizAnswerKeyPdf(quizSet) {
  if (typeof window === "undefined") return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const title = quizSet?.title || "Quiz";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${title} — Answer key`, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const settings = quizSet?.settings;
  const meta = [];
  if (settings?.difficulty) meta.push(`Difficulty: ${settings.difficulty}`);
  if (settings?.timeLimit > 0)
    meta.push(`Suggested time: ${settings.timeLimit} min`);
  if (meta.length) {
    const metaLines = doc.splitTextToSize(meta.join(" · "), maxW);
    doc.text(metaLines, margin, y);
    y += metaLines.length * 12 + 8;
  }

  const questions = [...(quizSet?.questions || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const ensureSpace = (need) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  questions.forEach((q, idx) => {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const head = `Question ${idx + 1} (${q.type || "Question"})`;
    doc.text(head, margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(String(q.question || ""), maxW);
    doc.text(qLines, margin, y);
    y += qLines.length * 12 + 4;

    const opts = normalizeOptions(q.options);
    if (q.type === "MCQ" && opts.length > 0) {
      opts.forEach((opt, i) => {
        ensureSpace(14);
        const mark =
          String(opt).trim() === String(q.answer || "").trim() ? " ✓" : "";
        const line = `${letterForIndex(i)}. ${opt}${mark}`;
        const lines = doc.splitTextToSize(line, maxW - 12);
        doc.text(lines, margin + 8, y);
        y += lines.length * 12;
      });
      y += 4;
    } else if (q.type === "True/False") {
      ["True", "False"].forEach((opt) => {
        ensureSpace(14);
        const mark = opt === q.answer ? " ✓" : "";
        doc.text(`• ${opt}${mark}`, margin + 8, y);
        y += 12;
      });
      y += 4;
    }

    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.text(`Correct answer: ${q.answer ?? "—"}`, margin, y);
    y += 14;

    if (q.explanation) {
      doc.setFont("helvetica", "normal");
      const expl = doc.splitTextToSize(`Explanation: ${q.explanation}`, maxW);
      ensureSpace(expl.length * 12);
      doc.text(expl, margin, y);
      y += expl.length * 12;
    }
    y += 10;
  });

  doc.save(`${slugifyTitle(title)}-answer-key.pdf`);
}
