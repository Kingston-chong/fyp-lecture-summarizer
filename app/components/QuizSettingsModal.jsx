"use client";

import { useState } from "react";
import { useTheme } from "./ThemeProvider.jsx";

// ─── Icons ────────────────────────────────────────────────
const CloseIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const ChevDownIco = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const QuizIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

// ─── Reusable Components ──────────────────────────────────
function Dropdown({ value, onChange, options, width = 120 }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", width }}>
      <button
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%", height: 32, padding: "0 10px",
          background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`,
          borderRadius: 7, fontFamily: "'Sora',sans-serif", fontSize: 12,
          color: isDark ? "#c0c0d8" : "#4a4a5a",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", gap: 6, transition: "all .18s",
        }}
      >
        {value} <ChevDownIco/>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: isDark ? "rgba(22,22,34,.98)" : "rgba(255,255,255,.98)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`,
          borderRadius: 8, padding: 4, boxShadow: isDark ? "0 12px 32px rgba(0,0,0,.5)" : "0 12px 32px rgba(0,0,0,.15)",
        }}>
          {options.map(o => (
            <div key={o}
              onMouseDown={() => { onChange(o); setOpen(false); }}
              style={{
                padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                color: value === o ? "#6366f1" : (isDark ? "#b0b0cc" : "#555568"),
                background: value === o ? "rgba(99,102,241,.18)" : "transparent",
                fontWeight: value === o ? 500 : 400,
                transition: "background .12s",
              }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = isDark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}
            >{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHead({ children, style }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div
      style={{
        fontSize: 13.5,
        fontWeight: 700,
        color: isDark ? "#ddddf0" : "#1e1b4b",
        marginBottom: 12,
        marginTop: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children, style }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div style={{ fontSize: 11.5, color: isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.5)", marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

/** Small “?” with native tooltip (`title`) for short option explanations */
function HintMark({ title }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 999,
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "help",
        color: isDark ? "#a5b4fc" : "#4f46e5",
        border: `1px solid ${isDark ? "rgba(165,180,252,.45)" : "rgba(79,70,229,.35)"}`,
        background: isDark ? "rgba(99,102,241,.12)" : "rgba(99,102,241,.08)",
      }}
    >
      ?
    </span>
  );
}

// ─── Main Modal ───────────────────────────────────────────
export default function QuizSettingsModal({ summaryId, onClose, onGenerated }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [aiModel, setAiModel] = useState("Gemini");
  const [generationMode, setGenerationMode] = useState("Strict");
  const [questionTypes, setQuestionTypes] = useState(["MCQ"]);
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
    setQuestionTypes(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleFocus = (id) => {
    setFocusAreas(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
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
      className={`sl-overlay${isDark ? "" : " quiz-modal-light"}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="sl-modal" style={{ maxWidth: 720 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
          
          @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
          @keyframes modalIn   { from { opacity:0; transform:scale(.96) translateY(14px); } to { opacity:1; transform:none; } }
          @keyframes spin      { to { transform:rotate(360deg); } }

          .sl-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(6,6,14,.72); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px; animation: overlayIn .2s ease;
            font-family: 'Sora', sans-serif;
          }
          .sl-modal {
            width: 100%; max-width: 680px; max-height: 90vh;
            background: rgba(17,17,27,.97);
            border: 1px solid rgba(255,255,255,.1);
            border-radius: 18px;
            box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(99,102,241,.08);
            display: flex; flex-direction: column;
            animation: modalIn .28s cubic-bezier(.16,1,.3,1);
            overflow: hidden;
          }

          .sl-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px 14px;
            border-bottom: 1px solid rgba(255,255,255,.07);
            flex-shrink: 0;
          }
          .sl-title {
            font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600;
            color: #e0e0f4; display: flex; align-items: center; gap: 8px;
          }
          .sl-close {
            width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1);
            background: rgba(255,255,255,.05); color: rgba(255,255,255,.5);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all .18s;
          }
          .sl-close:hover { background: rgba(248,113,113,.12); border-color: rgba(248,113,113,.3); color: #fca5a5; }

          .sl-body {
            overflow-y: auto; flex: 1;
            padding: 20px 22px;
            display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px;
          }
          .sl-body::-webkit-scrollbar { width: 3px; }
          .sl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

          .sl-foot {
            display: flex; align-items: center; justify-content: flex-end; gap: 9px;
            padding: 14px 22px; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
          }

          .btn-prev {
            height: 36px; padding: 0 18px; border-radius: 9px;
            border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05);
            font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 500;
            color: rgba(255,255,255,.55); cursor: pointer; display: flex; align-items: center; gap: 6px;
            transition: all .18s;
          }
          .btn-prev:hover { border-color: rgba(255,255,255,.22); color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); }

          .btn-create {
            height: 36px; padding: 0 20px; border-radius: 9px; border: none;
            background: linear-gradient(135deg,#5258ee,#8b5cf6);
            font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 600;
            color: white; cursor: pointer; display: flex; align-items: center; gap: 7px;
            box-shadow: 0 4px 16px rgba(99,102,241,.35); transition: all .18s;
          }
          .btn-create:hover { box-shadow: 0 6px 22px rgba(99,102,241,.52); transform: translateY(-1px); }
          .btn-create:disabled { opacity: .5; cursor: not-allowed; transform: none; }
          .mini-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.25); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }

          .chk-row { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11.5px; color: rgba(255,255,255,.45); transition: color .15s; margin-bottom: 8px; }
          .chk-row:hover { color: rgba(255,255,255,.75); }
          .chk-box { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
          .chk-box.on { background: #6366f1; border-color: #6366f1; }
          .chk-tick { color: white; font-size: 10px; }
          
          .radio-group { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
          .radio-opt { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11.5px; color: rgba(255,255,255,.45); transition: color .15s; }
          .radio-opt:hover { color: rgba(255,255,255,.75); }
          .radio-opt.on { color: #a5b4fc; }
          .radio-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: border-color .15s; }
          .radio-dot.on { border-color: #6366f1; }
          .radio-dot.on::after { content:''; width:6px; height:6px; border-radius:50%; background:#6366f1; }
          
          .num-input { width: 60px; height: 28px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: 6px; color: #fff; padding: 0 8px; font-size: 12px; outline: none; }

          .quiz-modal-light.sl-overlay {
            background: rgba(15, 18, 30, 0.42);
            backdrop-filter: blur(8px);
          }
          .quiz-modal-light .sl-modal {
            background: #f8f9fc;
            border: 1px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(99, 102, 241, 0.08);
          }
          .quiz-modal-light .sl-head {
            border-bottom-color: rgba(0, 0, 0, 0.08);
          }
          .quiz-modal-light .sl-title {
            color: #1e1b4b;
          }
          .quiz-modal-light .sl-close {
            border-color: rgba(0, 0, 0, 0.12);
            background: rgba(0, 0, 0, 0.04);
            color: rgba(0, 0, 0, 0.5);
          }
          .quiz-modal-light .sl-close:hover {
            background: rgba(248, 113, 113, 0.12);
            border-color: rgba(248, 113, 113, 0.35);
            color: #b91c1c;
          }
          .quiz-modal-light .sl-body::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.12);
            border-radius: 4px;
          }
          .quiz-modal-light .sl-foot {
            border-top-color: rgba(0, 0, 0, 0.08);
          }
          .quiz-modal-light .btn-prev {
            border-color: rgba(0, 0, 0, 0.12);
            background: rgba(0, 0, 0, 0.04);
            color: rgba(0, 0, 0, 0.6);
          }
          .quiz-modal-light .btn-prev:hover {
            border-color: rgba(0, 0, 0, 0.2);
            color: rgba(0, 0, 0, 0.88);
            background: rgba(0, 0, 0, 0.06);
          }
          .quiz-modal-light .chk-row {
            color: rgba(0, 0, 0, 0.58);
          }
          .quiz-modal-light .chk-row:hover {
            color: rgba(0, 0, 0, 0.88);
          }
          .quiz-modal-light .chk-box {
            border-color: rgba(0, 0, 0, 0.22);
          }
          .quiz-modal-light .radio-opt {
            color: rgba(0, 0, 0, 0.58);
          }
          .quiz-modal-light .radio-opt:hover {
            color: rgba(0, 0, 0, 0.88);
          }
          .quiz-modal-light .radio-opt.on {
            color: #4f46e5;
          }
          .quiz-modal-light .radio-dot {
            border-color: rgba(0, 0, 0, 0.22);
          }
          .quiz-modal-light .num-input {
            background: #fff;
            border: 1px solid rgba(0, 0, 0, 0.14);
            color: #111827;
          }
          .quiz-modal-light .num-input:focus {
            border-color: rgba(99, 102, 241, 0.45);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
          }
          
          @media (max-width: 640px) {
            .sl-body { grid-template-columns: 1fr; gap: 20px; }
            .sl-modal { max-height: 95vh; }
          }
        `}</style>

        <div className="sl-head">
          <div className="sl-title">
            <QuizIco/> Quiz Generation Settings..
          </div>
          <button className="sl-close" onClick={onClose}><CloseIco/></button>
        </div>

        <div
          style={{
            padding: "14px 22px",
            fontSize: 11,
            color: isDark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.48)",
          }}
        >
          All these options are optional. If you want to generate quiz straight away, click &quot;Generate Quiz&quot; to start generate random questions.
        </div>

        <div className="sl-body" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          <div className="col-left">
            <SectionHead>AI Model Selection</SectionHead>
            <Dropdown value={aiModel} onChange={setAiModel} options={["ChatGPT", "DeepSeek", "Gemini"]} width={140}/>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 }}>
              <SectionHead style={{ marginBottom: 0, marginTop: 0 }}>Generation Mode</SectionHead>
              <HintMark
                title={
                  "Strict — only facts from your summary. Creative — may add closely related ideas or examples not spelled out in the summary."
                }
              />
            </div>
            <Dropdown value={generationMode} onChange={setGenerationMode} options={["Strict", "Creative"]} width={140}/>

            <SectionHead>Question Types</SectionHead>
            {QUESTION_TYPES.map(t => (
              <label key={t.id} className="chk-row" onClick={() => toggleType(t.id)}>
                <div className={`chk-box ${questionTypes.includes(t.id) ? "on" : ""}`}>
                  {questionTypes.includes(t.id) && <span className="chk-tick">✓</span>}
                </div>
                {t.label}
              </label>
            ))}

            <SectionHead>Answer & Explanation Settings</SectionHead>
            <FieldLabel>Show correct answer:</FieldLabel>
            <div className="radio-group">
              {["Immediately", "After submission"].map(opt => (
                <label key={opt} className={`radio-opt ${answerShowMode === opt ? "on" : ""}`} onClick={() => setAnswerShowMode(opt)}>
                  <div className={`radio-dot ${answerShowMode === opt ? "on" : ""}`}/>
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="col-right">
            <SectionHead>Quiz Length & Difficulty</SectionHead>
            <FieldLabel>Number of questions:</FieldLabel>
            <div className="radio-group" style={{ marginBottom: 12 }}>
              <label
                className={`radio-opt ${!questionCountAuto ? "on" : ""}`}
                onClick={() => {
                  setQuestionCountAuto(false);
                  setNumQuestions((n) => (Number.isFinite(n) && n >= 1 ? n : 10));
                }}
              >
                <div className={`radio-dot ${!questionCountAuto ? "on" : ""}`}/>
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
                    setNumQuestions(Number.isFinite(v) ? Math.min(100, Math.max(1, v)) : 1);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginLeft: 8, opacity: questionCountAuto ? 0.55 : 1 }}
                />
              </label>
              <label className={`radio-opt ${questionCountAuto ? "on" : ""}`} onClick={() => setQuestionCountAuto(true)}>
                <div className={`radio-dot ${questionCountAuto ? "on" : ""}`}/>
                Auto
              </label>
            </div>

            <FieldLabel>Difficulty Level:</FieldLabel>
            <div className="radio-group" style={{ marginBottom: 16 }}>
              {["Easy", "Medium", "Hard"].map(opt => (
                <label key={opt} className={`radio-opt ${difficulty === opt ? "on" : ""}`} onClick={() => setDifficulty(opt)}>
                  <div className={`radio-dot ${difficulty === opt ? "on" : ""}`}/>
                  {opt}
                </label>
              ))}
            </div>

            <SectionHead>Learning Objective Focus</SectionHead>
            {FOCUS_AREAS.map(f => (
              <label key={f.id} className="chk-row" onClick={() => toggleFocus(f.id)}>
                <div className={`chk-box ${focusAreas.includes(f.id) ? "on" : ""}`}>
                  {focusAreas.includes(f.id) && <span className="chk-tick">✓</span>}
                </div>
                {f.label}
              </label>
            ))}

            <SectionHead>Quiz Presentation Mode</SectionHead>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <FieldLabel>Quiz mode</FieldLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Practice (with hints)", "Assessment (no hints)"].map(opt => (
                    <label key={opt} className={`radio-opt ${quizMode === (opt.includes("Practice") ? "Practice" : "Assessment") ? "on" : ""}`} onClick={() => setQuizMode(opt.includes("Practice") ? "Practice" : "Assessment")}>
                      <div className={`radio-dot ${quizMode === (opt.includes("Practice") ? "Practice" : "Assessment") ? "on" : ""}`}/>
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Time limit</FieldLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className={`radio-opt ${timeLimit === 0 ? "on" : ""}`} onClick={() => setTimeLimit(0)}>
                    <div className={`radio-dot ${timeLimit === 0 ? "on" : ""}`}/>
                    No limit
                  </label>
                  <label className={`radio-opt ${timeLimit > 0 ? "on" : ""}`} onClick={() => setTimeLimit(5)}>
                    <div className={`radio-dot ${timeLimit > 0 ? "on" : ""}`}/>
                    Custom time:
                    <input 
                      className="num-input" 
                      type="number" 
                      value={timeLimit || 0} 
                      onChange={e => setTimeLimit(parseInt(e.target.value) || 0)}
                      onClick={e => e.stopPropagation()}
                      style={{ marginLeft: 8, width: 40 }}
                    />
                    <span style={{ marginLeft: 4 }}>minutes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "0 22px",
              color: isDark ? "#fca5a5" : "#b91c1c",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            {error}
          </div>
        )}

        <div className="sl-foot">
          <button className="btn-prev" onClick={() => {
            setAiModel("Gemini");
            setGenerationMode("Strict");
            setQuestionTypes(["MCQ"]);
            setQuestionCountAuto(false);
            setNumQuestions(10);
            setDifficulty("Medium");
            setFocusAreas(["Important concepts"]);
          }}>Reset Settings</button>
          <button className="btn-create" onClick={handleCreate} disabled={loading}>
            {loading ? <div className="mini-spin"/> : null}
            Create Quiz!
          </button>
        </div>
      </div>
    </div>
  );
}
