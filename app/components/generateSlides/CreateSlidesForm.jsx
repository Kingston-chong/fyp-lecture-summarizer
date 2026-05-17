"use client";

import { useState, useRef, useEffect } from "react";
import { FieldLabel, SectionHead, Divider } from "./ui.jsx";
import "./CreateSlidesForm.css";

function ExtraInstructionsField({ value, onChange, presets, onApplyPreset }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div style={{ position: "relative", marginBottom: 4 }} ref={wrapRef}>
      {/* Textarea + suggestion button row */}
      <div style={{ position: "relative" }}>
        <textarea
          className="create-prompt-area"
          rows={3}
          maxLength={4000}
          placeholder='e.g. "focus on diagrams", "add a recap slide at the end"…'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 36 }}
        />
        {/* Arrow button inside textarea top-right */}
        <button
          type="button"
          title="Pick a suggestion"
          onClick={() => setOpen((v) => !v)}
          style={{
            position: "absolute",
            top: 7,
            right: 7,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,.15)",
            background: open ? "rgba(99,102,241,.25)" : "rgba(255,255,255,.07)",
            color: open ? "#a5b4fc" : "rgba(255,255,255,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all .15s",
            flexShrink: 0,
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
          </svg>
        </button>
      </div>

      <div className="create-prompt-hint">{value.length} / 4000</div>

      {/* Dropdown list */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% - 18px)",
            left: 0,
            right: 0,
            zIndex: 300,
            background: "rgba(18,18,30,.98)",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,.55)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px 6px",
              fontSize: 10.5,
              color: "rgba(255,255,255,.3)",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}
          >
            Suggestions — click to add
          </div>
          {presets.map((preset, i) => (
            <button
              key={preset}
              type="button"
              onMouseDown={() => {
                onApplyPreset(preset);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 14px",
                background: "transparent",
                border: "none",
                borderBottom:
                  i < presets.length - 1
                    ? "1px solid rgba(255,255,255,.05)"
                    : "none",
                color: "rgba(255,255,255,.72)",
                fontSize: 12,
                fontFamily: "'Sora', sans-serif",
                cursor: "pointer",
                lineHeight: 1.4,
                transition: "background .12s, color .12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99,102,241,.18)";
                e.currentTarget.style.color = "#c7d2fe";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,.72)";
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gs-pill${active ? " on" : ""}`}
    >
      {label}
    </button>
  );
}

function ProviderCard({ label, desc, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gs-provider-card${selected ? " selected" : ""}`}
    >
      <div className="gs-provider-card-head">
        <span className="gs-provider-card-label">{label}</span>
        {selected ? <span className="gs-provider-badge">selected</span> : null}
      </div>
      <p className="gs-provider-card-desc">{desc}</p>
    </button>
  );
}

export default function CreateSlidesForm({
  provider,
  setProvider,
  title,
  setTitle,
  maxSlides,
  setMaxSlides,
  slideLength,
  setSlideLength,
  textStyle,
  setTextStyle,
  strictness,
  setStrictness,
  highlightDefs,
  setHighlightDefs,
  boldKeywords,
  setBoldKeywords,
  speakerNotes,
  setSpeakerNotes,
  slideUserPrompt,
  setSlideUserPrompt,
  quickInstructionPresets,
  applyQuickInstruction,
  template,
  setTemplate,
  fontSize,
  setFontSize,
  textDensity,
  setTextDensity,
  bulletLimit,
  setBulletLimit,
  generateErr,
  generateProgress,
  archiveNote,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <>
      <div className="create-provider-row">
        <SectionHead>Generator</SectionHead>
        <div className="gs-provider-row">
          <ProviderCard
            label="Alai"
            desc="AI-designed slides, in-browser preview before download"
            selected={provider === "alai"}
            onClick={() => setProvider("alai")}
          />
          <ProviderCard
            label="2slides"
            desc="Template-based generation, fast output"
            selected={provider === "2slides"}
            onClick={() => setProvider("2slides")}
          />
        </div>
      </div>

      <div className="col-left">
        <SectionHead>Basics</SectionHead>
        <FieldLabel>Presentation title (optional)</FieldLabel>
        <input
          className="txt-inp"
          placeholder="Auto from summary…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div className="gs-inline-field">
          <FieldLabel style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
            Max slides (optional):
          </FieldLabel>
          <input
            className="num-inp"
            type="number"
            min={3}
            max={40}
            placeholder="Auto"
            value={maxSlides}
            onChange={(e) => setMaxSlides(e.target.value)}
          />
        </div>

        <Divider />
        <SectionHead>Slide length</SectionHead>
        <div className="create-pill-row">
          {["Short (summary)", "Medium (lecture-ready)", "Long (detailed)"].map(
            (opt) => (
              <Pill
                key={opt}
                label={opt}
                active={slideLength === opt}
                onClick={() => setSlideLength(opt)}
              />
            ),
          )}
        </div>

        <SectionHead>Tone</SectionHead>
        <div className="create-pill-row">
          {["Academic", "Professional", "Simple", "Technical"].map((opt) => (
            <Pill
              key={opt}
              label={opt}
              active={textStyle === opt}
              onClick={() => setTextStyle(opt)}
            />
          ))}
        </div>

        <SectionHead>Fidelity to summary</SectionHead>
        <div className="create-pill-row">
          {["Strict", "Flexible"].map((opt) => (
            <Pill
              key={opt}
              label={opt}
              active={strictness === opt}
              onClick={() => setStrictness(opt)}
            />
          ))}
        </div>
        <FieldLabel style={{ marginTop: -6, marginBottom: 12 }}>
          Strict = slides only use what&apos;s in the summary. Flexible = AI may
          add relevant context.
        </FieldLabel>
      </div>

      <div className="col-right">
        <div className="tag-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Slides are generated by the selected provider from your current
          summary. Pick Alai for in-browser preview, or 2slides for fast
          template output.
        </div>

        <SectionHead>Formatting extras</SectionHead>
        {[
          {
            label: "Highlight key definitions",
            val: highlightDefs,
            set: setHighlightDefs,
          },
          {
            label: "Bold important keywords",
            val: boldKeywords,
            set: setBoldKeywords,
          },
          {
            label: "Add speaker notes",
            val: speakerNotes,
            set: setSpeakerNotes,
          },
        ].map(({ label, val, set }) => (
          <label key={label} className="chk-row" onClick={() => set((v) => !v)}>
            <div className={`chk-box ${val ? "on" : ""}`}>
              {val ? <span className="chk-tick">✓</span> : null}
            </div>
            {label}
          </label>
        ))}

        <Divider />

        <SectionHead>Extra instructions (optional)</SectionHead>
        <ExtraInstructionsField
          value={slideUserPrompt}
          onChange={setSlideUserPrompt}
          presets={quickInstructionPresets}
          onApplyPreset={applyQuickInstruction}
        />

        <Divider />

        <button
          type="button"
          className="gs-advanced-toggle"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span
            className="gs-advanced-chev"
            style={{ transform: advancedOpen ? "rotate(90deg)" : "none" }}
          >
            ›
          </span>
          Advanced options
        </button>

        {advancedOpen ? (
          <div className="gs-advanced-grid">
            <div>
              <FieldLabel>Template:</FieldLabel>
              <select
                className="txt-inp"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                style={{ width: 110 }}
              >
                {[
                  "Academic",
                  "Professional",
                  "Creative",
                  "Minimal",
                  "Corporate",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Font size:</FieldLabel>
              <select
                className="txt-inp"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                style={{ width: 90 }}
              >
                {["Small", "Normal", "Large"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Text density:</FieldLabel>
              <select
                className="txt-inp"
                value={textDensity}
                onChange={(e) => setTextDensity(e.target.value)}
                style={{ width: 100 }}
              >
                {["Compact", "Balanced", "Spacious"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Bullet limit/slide:</FieldLabel>
              <input
                className="num-inp"
                type="number"
                min={1}
                max={20}
                placeholder="—"
                value={bulletLimit}
                onChange={(e) => setBulletLimit(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {generateErr ? (
          <div className="improve-err mt-3">
            {generateErr}
          </div>
        ) : null}
        {generateProgress ? (
          <div className="gs-progress-msg">{generateProgress}</div>
        ) : null}
        {archiveNote ? <div className="archive-note">{archiveNote}</div> : null}
      </div>
    </>
  );
}
