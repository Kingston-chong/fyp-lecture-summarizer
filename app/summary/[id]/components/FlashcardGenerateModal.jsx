"use client";

import { useState } from "react";
import { CloseIcon, Spinner } from "@/app/components/icons";
import CustomSelect from "@/app/components/CustomSelect";
import "@/app/components/CustomSelect.css";
import "@/app/components/QuizSettingsModal.css";
import { LoadingText } from "@/app/components/LoadingText";

const FOCUS_AREAS = [
  { id: "Key concepts", label: "Key concepts" },
  { id: "Definitions", label: "Definitions" },
  { id: "Dates & facts", label: "Dates & facts" },
  { id: "Formulas", label: "Formulas" },
];

const CARD_PRESETS = [
  { label: "10", value: 10 },
  { label: "15", value: 15 },
  { label: "20", value: 20 },
  { label: "Auto", value: null },
];

export default function FlashcardGenerateModal({
  summaryId,
  onClose,
  onGenerated,
}) {
  const [aiModel, setAiModel] = useState("Gemini");
  const [cardPreset, setCardPreset] = useState("Auto");
  const [focusAreas, setFocusAreas] = useState(["Key concepts"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleFocus = (id) => {
    setFocusAreas((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const preset = CARD_PRESETS.find((p) => p.label === cardPreset);
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId,
          model: aiModel,
          numCards: preset?.value ?? null,
          focusAreas,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to generate flashcards");
      onGenerated(data.flashcardSet);
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
      <div className="sl-modal qsm-modal" style={{ maxWidth: 480 }}>
        <div className="sl-head">
          <div className="sl-title">Generate flashcards</div>
          <button type="button" className="sl-close" onClick={onClose}>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="qsm-intro">
          Create study flashcards from your summary. Sets save automatically to
          the sidebar.
        </div>

        <div className="sl-body qsm-body">
          <div className="qsm-section-head">AI model</div>
          <CustomSelect
            value={aiModel}
            onChange={setAiModel}
            options={["ChatGPT", "DeepSeek", "Gemini"]}
            width={140}
          />

          <div className="qsm-section-head" style={{ marginTop: 16 }}>
            Number of cards
          </div>
          <div className="radio-group">
            {CARD_PRESETS.map((p) => (
              <label
                key={p.label}
                className={`radio-opt ${cardPreset === p.label ? "on" : ""}`}
                onClick={() => setCardPreset(p.label)}
              >
                <div
                  className={`radio-dot ${cardPreset === p.label ? "on" : ""}`}
                />
                {p.label}
              </label>
            ))}
          </div>

          <div className="qsm-section-head" style={{ marginTop: 16 }}>
            Focus areas
          </div>
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
        </div>

        {error && <div className="qsm-error">{error}</div>}

        <div className="sl-foot">
          <button type="button" className="btn-prev" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-create"
            disabled={loading || focusAreas.length === 0}
            onClick={handleCreate}
          >
            {loading ? (
              <>
                <Spinner size={13} /> <LoadingText active>Generating</LoadingText>
              </>
            ) : (
              "Generate flashcards"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
