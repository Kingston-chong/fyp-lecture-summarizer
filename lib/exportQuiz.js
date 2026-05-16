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
        variant === "answerKey" && String(opt).trim() === String(q.answer || "").trim()
          ? " ✓"
          : "";
      lines.push(`${letterForIndex(i)}. ${opt}${mark}`);
    });
    lines.push("");
  } else if (q.type === "True/False") {
    ["True", "False"].forEach((opt) => {
      const mark =
        variant === "answerKey" && opt === q.answer ? " ✓" : "";
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
        variant === "answerKey" && String(opt).trim() === String(q.answer || "").trim()
          ? " [CORRECT]"
          : "";
      lines.push(`  ${letterForIndex(i)}. ${opt}${mark}`);
    });
  } else if (q.type === "True/False") {
    ["True", "False"].forEach((opt) => {
      const mark = variant === "answerKey" && opt === q.answer ? " [CORRECT]" : "";
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
    variant === "answerKey"
      ? `# ${title} — Answer key\n`
      : `# ${title}\n`;
  const meta = [];
  const settings = quizSet?.settings;
  if (settings?.difficulty) meta.push(`Difficulty: ${settings.difficulty}`);
  if (settings?.timeLimit > 0) meta.push(`Suggested time: ${settings.timeLimit} min`);
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

export function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyTitle(title) {
  return String(title || "quiz")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48) || "quiz";
}
