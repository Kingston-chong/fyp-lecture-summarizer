"use client";

import { useState, useEffect, useRef } from "react";

// ─── Icons ────────────────────────────────────────────────
const CloseIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const ChevRightIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const CheckIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const InfoIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const SectionHead = ({ children }) => (
  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ddddf0", marginBottom: 12, marginTop: 4, fontFamily: "'Sora', sans-serif" }}>
    {children}
  </div>
);

export default function QuizViewModal({ quizSet, settings, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings?.timeLimit ? settings.timeLimit * 60 : null);
  
  const timerRef = useRef(null);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !isFinished) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timeLeft, isFinished]);

  const questions = quizSet?.questions || [];
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;

  const handleSelectAnswer = (ans) => {
    if (showExplanation) return;
    setUserAnswers(prev => ({ ...prev, [currentIdx]: ans }));
  };

  const handleSubmit = () => {
    if (!userAnswers[currentIdx]) return;
    if (settings?.answerShowMode === "Immediately") {
      setShowExplanation(true);
    } else {
      handleNext();
    }
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.answer) score++;
    });
    return score;
  };

  if (!quizSet) return null;

  return (
    <div className="sl-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sl-modal" style={{ maxWidth: 680, minHeight: 450 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
          
          @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
          @keyframes modalIn   { from { opacity:0; transform:scale(.96) translateY(14px); } to { opacity:1; transform:none; } }
          @keyframes slideUp   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

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
          }
          .sl-body::-webkit-scrollbar { width: 3px; }
          .sl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

          .sl-foot {
            display: flex; align-items: center; justify-content: flex-end; gap: 9px;
            padding: 14px 22px; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
          }

          .quiz-option { 
            padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); 
            background: rgba(255,255,255,.03); color: #c0c0d8; cursor: pointer; transition: all .2s;
            margin-bottom: 10px; font-size: 13.5px; line-height: 1.4; display: flex; align-items: center; gap: 12px;
          }
          .quiz-option:hover { background: rgba(99,102,241,.1); border-color: rgba(99,102,241,.3); }
          .quiz-option.selected { background: rgba(99,102,241,.15); border-color: #6366f1; color: #fff; }
          .quiz-option.correct { background: rgba(34,197,94,.15); border-color: #22c55e; color: #fff; }
          .quiz-option.wrong { background: rgba(239,68,68,.15); border-color: #ef4444; color: #fff; }
          
          .btn-submit { height: 42px; padding: 0 24px; border-radius: 10px; border: none; background: #6366f1; color: white; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all .2s; }
          .btn-submit:hover { background: #4f46e5; transform: translateY(-1px); }
          .btn-submit:disabled { opacity: .5; cursor: not-allowed; transform: none; }
          
          .expl-box { margin-top: 24px; padding: 20px; border-radius: 14px; background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.2); animation: slideUp .3s ease; }
          
          .review-card { padding: 18px; border-radius: 12px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06); margin-bottom: 12px; }

          @media (max-width: 640px) {
            .sl-modal { max-height: 95vh; }
            .btn-submit { width: 100%; justify-content: center; }
          }
        `}</style>

        <div className="sl-head">
          <div className="sl-title">
            {isFinished ? "Quiz Results" : `Question ${currentIdx + 1} of ${totalQuestions}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {timeLeft !== null && !isFinished && (
              <div style={{ fontSize: 13, fontWeight: 600, color: timeLeft < 30 ? "#fca5a5" : "#a5b4fc" }}>
                Time: {formatTime(timeLeft)}
              </div>
            )}
            <button className="sl-close" onClick={onClose}><CloseIco/></button>
          </div>
        </div>

        <div className="sl-body" style={{ display: "block", overflowY: "auto" }}>
          {!isFinished ? (
            <div style={{ paddingBottom: 20 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 8 }}>
                {currentQuestion.type}
              </div>
              <h2 style={{ fontSize: 18, color: "#fff", lineHeight: 1.5, marginBottom: 24, fontWeight: 500 }}>
                {currentQuestion.question}
              </h2>

              <div className="options-container">
                {currentQuestion.type === "MCQ" && currentQuestion.options?.map((opt, i) => {
                  const isSelected = userAnswers[currentIdx] === opt;
                  const isCorrect = showExplanation && opt === currentQuestion.answer;
                  const isWrong = showExplanation && isSelected && opt !== currentQuestion.answer;
                  
                  return (
                    <div 
                      key={i} 
                      className={`quiz-option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      onClick={() => handleSelectAnswer(opt)}
                    >
                      <div style={{ 
                        width: 24, height: 24, borderRadius: "50%", 
                        background: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : isSelected ? "#6366f1" : "rgba(255,255,255,.1)",
                        display: "flex", alignItems: "center", justify: "center", color: "#fff", fontSize: 11, fontWeight: 700
                      }}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      {opt}
                    </div>
                  );
                })}
                {(currentQuestion.type === "True/False") && ["True", "False"].map((opt, i) => {
                  const isSelected = userAnswers[currentIdx] === opt;
                  const isCorrect = showExplanation && opt === currentQuestion.answer;
                  const isWrong = showExplanation && isSelected && opt !== currentQuestion.answer;
                  
                  return (
                    <div 
                      key={i} 
                      className={`quiz-option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      onClick={() => handleSelectAnswer(opt)}
                    >
                      {opt}
                    </div>
                  );
                })}
                {(currentQuestion.type === "FillInBlanks" || currentQuestion.type === "ShortAnswer") && (
                  <div style={{ marginBottom: 20 }}>
                    <input 
                      type="text" 
                      className="txt-inp" 
                      style={{ height: 44, fontSize: 14 }}
                      placeholder="Type your answer here..."
                      value={userAnswers[currentIdx] || ""}
                      onChange={(e) => handleSelectAnswer(e.target.value)}
                      disabled={showExplanation}
                    />
                    {showExplanation && (
                      <div style={{ marginTop: 12, fontSize: 14, color: "#22c55e", fontWeight: 500 }}>
                        Correct Answer: {currentQuestion.answer}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showExplanation && (
                <div className="expl-box">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a5b4fc", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    <InfoIco/> Explanation
                  </div>
                  <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.7)", lineHeight: 1.6 }}>
                    {currentQuestion.explanation}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#6366f1", marginBottom: 8 }}>
                {Math.round((getScore() / totalQuestions) * 100)}%
              </div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,.6)", marginBottom: 32 }}>
                You scored {getScore()} out of {totalQuestions} questions
              </div>
              
              <div style={{ textAlign: "left" }}>
                <SectionHead>Review Questions</SectionHead>
                {questions.map((q, idx) => (
                  <div key={idx} className="review-card">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase" }}>Question {idx + 1}</span>
                      <span style={{ 
                        fontSize: 11, fontWeight: 700, 
                        color: userAnswers[idx] === q.answer ? "#22c55e" : "#ef4444" 
                      }}>
                        {userAnswers[idx] === q.answer ? "CORRECT" : "WRONG"}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: "#fff", marginBottom: 12 }}>{q.question}</div>
                    <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.4)" }}>
                      Your answer: <span style={{ color: userAnswers[idx] === q.answer ? "#22c55e" : "#ef4444" }}>{userAnswers[idx] || "No answer"}</span>
                    </div>
                    {userAnswers[idx] !== q.answer && (
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.4)", marginTop: 4 }}>
                        Correct answer: <span style={{ color: "#22c55e" }}>{q.answer}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sl-foot">
          {!isFinished ? (
            <>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,.05)", borderRadius: 2, marginRight: 20 }}>
                <div style={{ 
                  height: "100%", background: "#6366f1", borderRadius: 2, 
                  width: `${((currentIdx + (showExplanation ? 1 : 0)) / totalQuestions) * 100}%`,
                  transition: "width .4s cubic-bezier(.16,1,.3,1)" 
                }}/>
              </div>
              {showExplanation ? (
                <button className="btn-submit" onClick={handleNext}>
                  {currentIdx === totalQuestions - 1 ? "Finish Quiz" : "Next Question"} <ChevRightIco/>
                </button>
              ) : (
                <button 
                  className="btn-submit" 
                  onClick={handleSubmit}
                  disabled={!userAnswers[currentIdx]}
                >
                  Submit Answer <CheckIco/>
                </button>
              )}
            </>
          ) : (
            <button className="btn-submit" style={{ width: "100%", justifyContent: "center" }} onClick={onClose}>
              Close & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
