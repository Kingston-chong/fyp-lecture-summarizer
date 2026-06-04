"use client";

import { useState } from "react";
import { CloseIcon, QuizIco } from "./icons";
import CustomSelect from "./CustomSelect";
import "./CustomSelect.css";
import "./QuizSettingsModal.css";

function SectionHead({ children, className = "" }) {
  return (
    <div className={`qsm-section-head ${className}`.trim()}>{children}</div>
  );
}

function FieldLabel({ children, className = "" }) {
  return (
    <div className={`qsm-field-label ${className}`.trim()}>{children}</div>
  );
}

/** Small “?” with native tooltip (`title`) for short option explanations */
function HintMark({ title }) {
  return (
    <span title={title} aria-label={title} className="qsm-hint">
      ?
    </span>
  );
}

// ─── Main Modal ───────────────────────────────────────────
const COPY = {
  student: {
    title: "Quiz Generation Settings..",
    intro:
      'All these options are optional. If you want to generate quiz straight away, click "Generate Quiz" to start generate random questions.',
    answerSection: "Answer & Explanation Settings",
    answerLabel: "Show correct answer:",
    presentationSection: "Quiz Presentation Mode",
    quizModeLabel: "Quiz mode",
    timeLabel: "Time limit",
    createBtn: "Generate Quiz",
  },
  lecturer: {
    title: "Quiz builder for your class",
    intro:
      "Build a question set from this lecture summary. You can review the answer key and export or share it with students after generation.",
    answerSection: "Student feedback (in-app quizzes)",
    answerLabel: "When students take the quiz in this app:",
    presentationSection: "Suggested settings for students",
    quizModeLabel: "Use case",
    timeLabel: "Suggested time limit for students",
    createBtn: "Generate question set",
  },
};

export default function QuizSettingsModal({
  summaryId,
  onClose,
  onGenerated,
  mode = "student",
}) {
  const isLecturer = mode === "lecturer";
  const copy = COPY[isLecturer ? "lecturer" : "student"];
  const [aiModel, setAiModel] = useState("Gemini");
  const [generationMode, setGenerationMode] = useState("Strict");
  const [questionTypes, setQuestionTypes] = useState(["MCQ"]);
  const [questionCountAuto, setQuestionCountAuto] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("Medium");
  const [focusAreas, setFocusAreas] = useState(["Important concepts"]);
  const [answerShowMode, setAnswerShowMode] = useState("Immediately");
  const [quizMode, setQuizMode] = useState("Practice");
  const [timeLimit, setTimeLimit] = useState(0); // 0 = no limit

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const QUESTION_TYPES = [
    { id: "MCQ", label: "Multiple Choice Questions (MCQ)" },
    { id: "True/False", label: "True/False" },
    { id: "FillInBlanks", label: "Fill in the blanks" },
    { id: "ShortAnswer", label: "Short answer" },
    { id: "Match", label: "Match the answers" },
  ];

  const FOCUS_AREAS = [
    { id: "Key definitions", label: "Key definitions" },
    { id: "Important concepts", label: "Important concepts" },
    { id: "Processes", label: "Processes" },
    { id: "Comparisons", label: "Comparisons" },
  ];

  const toggleType = (id) => {
    setQuestionTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const toggleFocus = (id) => {
    setFocusAreas((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId,
          model: aiModel,
          numQuestions: questionCountAuto ? null : numQuestions,
          difficulty,
          questionTypes,
          focusAreas,
          generationMode,
          answerShowMode,
          quizMode,
          timeLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz");

      onGenerated(data.quizSet);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="sl-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sl-modal qsm-modal">
        <div className="sl-head">
          <div className="sl-title">
            <QuizIco /> {copy.title}
          </div>
          <button className="sl-close" onClick={onClose}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="qsm-intro">{copy.intro}</div>

        <div className="sl-body qsm-body">
          <div className="col-left">
            <SectionHead>AI Model Selection</SectionHead>
            <CustomSelect
              value={aiModel}
              onChange={setAiModel}
              options={["ChatGPT", "DeepSeek", "Gemini"]}
              width={140}
            />

            <div className="qsm-gen-row">
              <SectionHead className="qsm-section-head--inline">
                Generation Mode
              </SectionHead>
              <HintMark
                title={
                  "Strict — only facts from your summary. Creative — may add closely related ideas or examples not spelled out in the summary."
                }
              />
            </div>
            <CustomSelect
              value={generationMode}
              onChange={setGenerationMode}
              options={["Strict", "Creative"]}
              width={140}
            />

            <SectionHead>Question Types</SectionHead>
            {QUESTION_TYPES.map((t) => (
              <label
                key={t.id}
                className="chk-row"
                onClick={() => toggleType(t.id)}
              >
                <div
                  className={`chk-box ${questionTypes.includes(t.id) ? "on" : ""}`}
                >
                  {questionTypes.includes(t.id) && (
                    <span className="chk-tick">✓</span>
                  )}
                </div>
                {t.label}
              </label>
            ))}

            <SectionHead>{copy.answerSection}</SectionHead>
            <FieldLabel>{copy.answerLabel}</FieldLabel>
            <div className="radio-group">
              {["Immediately", "After submission"].map((opt) => (
                <label
                  key={opt}
                  className={`radio-opt ${answerShowMode === opt ? "on" : ""}`}
                  onClick={() => setAnswerShowMode(opt)}
                >
                  <div
                    className={`radio-dot ${answerShowMode === opt ? "on" : ""}`}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="col-right">
            <SectionHead>Quiz Length & Difficulty</SectionHead>
            <FieldLabel>Number of questions:</FieldLabel>
            <div className="radio-group mb-3">
              <label
                className={`radio-opt ${!questionCountAuto ? "on" : ""}`}
                onClick={() => {
                  setQuestionCountAuto(false);
                  setNumQuestions((n) =>
                    Number.isFinite(n) && n >= 1 ? n : 10,
                  );
                }}
              >
                <div
                  className={`radio-dot ${!questionCountAuto ? "on" : ""}`}
                />
                Numbers:
                <input
                  className="num-input"
                  type="number"
                  min={1}
                  max={100}
                  disabled={questionCountAuto}
                  value={questionCountAuto ? "" : numQuestions}
                  placeholder={questionCountAuto ? "Auto" : ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setNumQuestions(
                      Number.isFinite(v) ? Math.min(100, Math.max(1, v)) : 1,
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginLeft: 8,
                    opacity: questionCountAuto ? 0.55 : 1,
                  }}
                />
              </label>
              <label
                className={`radio-opt ${questionCountAuto ? "on" : ""}`}
                onClick={() => setQuestionCountAuto(true)}
              >
                <div className={`radio-dot ${questionCountAuto ? "on" : ""}`} />
                Auto
              </label>
            </div>

            <FieldLabel>Difficulty Level:</FieldLabel>
            <div className="radio-group radio-group--mb-lg">
              {["Easy", "Medium", "Hard"].map((opt) => (
                <label
                  key={opt}
                  className={`radio-opt ${difficulty === opt ? "on" : ""}`}
                  onClick={() => setDifficulty(opt)}
                >
                  <div
                    className={`radio-dot ${difficulty === opt ? "on" : ""}`}
                  />
                  {opt}
                </label>
              ))}
            </div>

            <SectionHead>Learning Objective Focus</SectionHead>
            {FOCUS_AREAS.map((f) => (
              <label
                key={f.id}
                className="chk-row"
                onClick={() => toggleFocus(f.id)}
              >
                <div
                  className={`chk-box ${focusAreas.includes(f.id) ? "on" : ""}`}
                >
                  {focusAreas.includes(f.id) && (
                    <span className="chk-tick">✓</span>
                  )}
                </div>
                {f.label}
              </label>
            ))}

            <SectionHead>{copy.presentationSection}</SectionHead>
            <div className="qsm-presentation-row">
              {!isLecturer && (
                <div className="qsm-presentation-col">
                  <FieldLabel>{copy.quizModeLabel}</FieldLabel>
                  <div className="qsm-radio-col">
                    {["Practice (with hints)", "Assessment (no hints)"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className={`radio-opt ${quizMode === (opt.includes("Practice") ? "Practice" : "Assessment") ? "on" : ""}`}
                          onClick={() =>
                            setQuizMode(
                              opt.includes("Practice")
                                ? "Practice"
                                : "Assessment",
                            )
                          }
                        >
                          <div
                            className={`radio-dot ${quizMode === (opt.includes("Practice") ? "Practice" : "Assessment") ? "on" : ""}`}
                          />
                          {opt}
                        </label>
                      ),
                    )}
                  </div>
                </div>
              )}
              <div className="qsm-presentation-col">
                <FieldLabel>{copy.timeLabel}</FieldLabel>
                <div className="qsm-radio-col">
                  <label
                    className={`radio-opt ${timeLimit === 0 ? "on" : ""}`}
                    onClick={() => setTimeLimit(0)}
                  >
                    <div
                      className={`radio-dot ${timeLimit === 0 ? "on" : ""}`}
                    />
                    No limit
                  </label>
                  <label
                    className={`radio-opt ${timeLimit > 0 ? "on" : ""}`}
                    onClick={() => setTimeLimit(5)}
                  >
                    <div className={`radio-dot ${timeLimit > 0 ? "on" : ""}`} />
                    Custom time:
                    <input
                      className="num-input"
                      type="number"
                      value={timeLimit || 0}
                      onChange={(e) =>
                        setTimeLimit(parseInt(e.target.value) || 0)
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginLeft: 8, width: 40 }}
                    />
                    <span className="ml-1">minutes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="qsm-error">{error}</div>}

        <div className="sl-foot">
          <button
            className="btn-prev"
            onClick={() => {
              setAiModel("Gemini");
              setGenerationMode("Strict");
              setQuestionTypes(["MCQ"]);
              setQuestionCountAuto(false);
              setNumQuestions(10);
              setDifficulty("Medium");
              setFocusAreas(["Important concepts"]);
            }}
          >
            Reset Settings
          </button>
          <button
            className="btn-create"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? <div className="mini-spin" /> : null}
            {copy.createBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
