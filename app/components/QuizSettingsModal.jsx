"use client";

import { useState } from "react";
import { QuizIco } from "./icons";
import { useTheme } from "./ThemeProvider";
import {
  CloseIco,
  SelectMenu,
  SectionHead,
  FieldLabel,
} from "./generateSlides/ui.jsx";
import "./GenerateSlidesModal.css";
import "./QuizSettingsModal.css";

/** Small “?” with native tooltip (`title`) for short option explanations */
function HintMark({ title }) {
  return (
    <span title={title} aria-label={title} className="quiz-hint">
      ?
    </span>
  );
}

const COPY = {
  student: {
    title: "Quiz generation settings",
    intro:
      'All options are optional. Click "Generate Quiz" anytime to create questions from your summary with sensible defaults.',
    answerSection: "Answer & explanation",
    answerLabel: "Show correct answer:",
    presentationSection: "Presentation",
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

const AI_MODEL_OPTIONS = [
  { value: "ChatGPT", label: "ChatGPT" },
  { value: "DeepSeek", label: "DeepSeek" },
  { value: "Gemini", label: "Gemini" },
];

const GENERATION_MODE_OPTIONS = [
  { value: "Strict", label: "Strict" },
  { value: "Creative", label: "Creative" },
];

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

const DEFAULTS = {
  aiModel: "Gemini",
  generationMode: "Strict",
  questionTypes: ["MCQ"],
  questionCountAuto: false,
  numQuestions: 10,
  difficulty: "Medium",
  focusAreas: ["Important concepts"],
  answerShowMode: "Immediately",
  quizMode: "Practice",
  timeLimit: 0,
};

export default function QuizSettingsModal({
  summaryId,
  onClose,
  onGenerated,
  mode = "student",
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isLecturer = mode === "lecturer";
  const copy = COPY[isLecturer ? "lecturer" : "student"];

  const [aiModel, setAiModel] = useState(DEFAULTS.aiModel);
  const [generationMode, setGenerationMode] = useState(DEFAULTS.generationMode);
  const [questionTypes, setQuestionTypes] = useState(DEFAULTS.questionTypes);
  const [questionCountAuto, setQuestionCountAuto] = useState(
    DEFAULTS.questionCountAuto,
  );
  const [numQuestions, setNumQuestions] = useState(DEFAULTS.numQuestions);
  const [difficulty, setDifficulty] = useState(DEFAULTS.difficulty);
  const [focusAreas, setFocusAreas] = useState(DEFAULTS.focusAreas);
  const [answerShowMode, setAnswerShowMode] = useState(
    DEFAULTS.answerShowMode,
  );
  const [quizMode, setQuizMode] = useState(DEFAULTS.quizMode);
  const [timeLimit, setTimeLimit] = useState(DEFAULTS.timeLimit);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const resetSettings = () => {
    setAiModel(DEFAULTS.aiModel);
    setGenerationMode(DEFAULTS.generationMode);
    setQuestionTypes(DEFAULTS.questionTypes);
    setQuestionCountAuto(DEFAULTS.questionCountAuto);
    setNumQuestions(DEFAULTS.numQuestions);
    setDifficulty(DEFAULTS.difficulty);
    setFocusAreas(DEFAULTS.focusAreas);
    setAnswerShowMode(DEFAULTS.answerShowMode);
    setQuizMode(DEFAULTS.quizMode);
    setTimeLimit(DEFAULTS.timeLimit);
    setError("");
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
      className={`sl-overlay slides-gen-overlay quiz-gen-overlay${isDark ? "" : " slides-modal-light"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sl-modal">
        <div className="sl-head">
          <div className="sl-title">
            <QuizIco /> {copy.title}
          </div>
          <button type="button" className="sl-close" onClick={onClose}>
            <CloseIco />
          </button>
        </div>

        <div className="sl-body slides-sl-body">
          <p className="quiz-intro-row">{copy.intro}</p>

          <div className="col-left">
            <SectionHead>AI model</SectionHead>
            <SelectMenu
              value={aiModel}
              onChange={setAiModel}
              options={AI_MODEL_OPTIONS}
            />

            <div className="quiz-gen-row">
              <SectionHead style={{ marginBottom: 0 }}>Generation mode</SectionHead>
              <HintMark title="Strict — only facts from your summary. Creative — may add closely related ideas or examples not spelled out in the summary." />
            </div>
            <SelectMenu
              value={generationMode}
              onChange={setGenerationMode}
              options={GENERATION_MODE_OPTIONS}
            />

            <SectionHead>Question types</SectionHead>
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
            <div className="radio-group radio-group--mb">
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
            <SectionHead>Quiz length & difficulty</SectionHead>
            <FieldLabel>Number of questions</FieldLabel>
            <div className="radio-group radio-group--mb">
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
                Numbers
                <input
                  className="num-inp"
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
                    width: 56,
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

            <FieldLabel>Difficulty level</FieldLabel>
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

            <SectionHead>Learning objective focus</SectionHead>
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
            <div className="quiz-presentation-row">
              {!isLecturer && (
                <div className="quiz-presentation-col">
                  <FieldLabel>{copy.quizModeLabel}</FieldLabel>
                  <div className="quiz-radio-col">
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
              <div className="quiz-presentation-col">
                <FieldLabel>{copy.timeLabel}</FieldLabel>
                <div className="quiz-radio-col">
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
                    Custom time
                    <input
                      className="num-inp"
                      type="number"
                      min={0}
                      value={timeLimit || 0}
                      onChange={(e) =>
                        setTimeLimit(parseInt(e.target.value, 10) || 0)
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginLeft: 8, width: 48 }}
                    />
                    <span className="quiz-minutes-label">minutes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="improve-err quiz-gen-error">{error}</div>
          ) : null}
        </div>

        <div className="sl-foot quiz-sl-foot">
          <button
            type="button"
            className="btn-prev"
            onClick={resetSettings}
            disabled={loading}
          >
            Reset settings
          </button>
          <button
            type="button"
            className="btn-create"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? <div className="mini-spin" /> : <QuizIco />}
            {copy.createBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
