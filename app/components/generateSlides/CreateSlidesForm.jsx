"use client";

import { Divider, Dropdown, FieldLabel, SectionHead } from "./ui.jsx";

/**
 * Create-from-summary slide generation options (two-column body).
 */
export default function CreateSlidesForm({
  quickInstructionPresets,
  applyQuickInstruction,
  scrollQuickRequests,
  quickRequestsRef,
  slideUserPrompt,
  setSlideUserPrompt,
  title,
  setTitle,
  slideLength,
  setSlideLength,
  maxSlides,
  setMaxSlides,
  template,
  setTemplate,
  fontSize,
  setFontSize,
  textDensity,
  setTextDensity,
  aiModel,
  setAiModel,
  strictness,
  setStrictness,
  textStyle,
  setTextStyle,
  bulletLimit,
  setBulletLimit,
  highlightDefs,
  setHighlightDefs,
  boldKeywords,
  setBoldKeywords,
  generateErr,
  generateProgress,
  archiveNote,
}) {
  return (
    <>
      <div className="create-prompt-row">
        <SectionHead>Custom instructions (optional)</SectionHead>
        <FieldLabel>
          Describe focus, audience, pacing, or must-cover topics — the generator
          will try to follow this together with your summary.
        </FieldLabel>
        <div className="quick-requests-wrap">
          <button
            type="button"
            className="quick-requests-nav"
            aria-label="Scroll quick requests left"
            onClick={() => scrollQuickRequests("left")}
          >
            ‹
          </button>
          <div className="quick-requests" ref={quickRequestsRef}>
            {quickInstructionPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="quick-request-chip"
                onClick={() => applyQuickInstruction(preset)}
                title={preset}
              >
                {preset}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quick-requests-nav"
            aria-label="Scroll quick requests right"
            onClick={() => scrollQuickRequests("right")}
          >
            ›
          </button>
        </div>
        <textarea
          className="create-prompt-area"
          rows={4}
          maxLength={4000}
          placeholder='Examples: "Emphasize definitions and one worked example per concept." / "Final slide must list 5 review questions." / "Assume first-year undergrads; avoid jargon."'
          value={slideUserPrompt}
          onChange={(e) => setSlideUserPrompt(e.target.value)}
        />
        <div className="create-prompt-hint">
          {slideUserPrompt.length} / 4000
        </div>
      </div>

      <div className="col-left">
        <SectionHead>Slide Length &amp; Detail</SectionHead>
        <FieldLabel>
          Main Title of the slide (optional, will be auto-generated if left
          empty):
        </FieldLabel>
        <input
          className="txt-inp"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <FieldLabel>Slide length:</FieldLabel>
        <div className="radio-group" style={{ marginBottom: 12 }}>
          {["Short (summary)", "Medium (lecture-ready)", "Long (detailed)"].map(
            (opt) => (
              <label
                key={opt}
                className={`radio-opt ${slideLength === opt ? "on" : ""}`}
                onClick={() => setSlideLength(opt)}
              >
                <div
                  className={`radio-dot ${slideLength === opt ? "on" : ""}`}
                />
                {opt}
              </label>
            ),
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FieldLabel style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
            Max Slides Limit (optional):
          </FieldLabel>
          <input
            className="num-inp"
            type="number"
            min={1}
            max={100}
            placeholder=""
            value={maxSlides}
            onChange={(e) => setMaxSlides(e.target.value)}
          />
        </div>

        <Divider />

        <SectionHead>Slide Design &amp; Layout Settings</SectionHead>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <FieldLabel>Template Selection:</FieldLabel>
            <Dropdown
              value={template}
              onChange={setTemplate}
              options={[
                "Academic",
                "Professional",
                "Creative",
                "Minimal",
                "Corporate",
              ]}
              width={110}
            />
          </div>
          <div>
            <FieldLabel>Font Size Preferences:</FieldLabel>
            <Dropdown
              value={fontSize}
              onChange={setFontSize}
              options={["Small", "Normal", "Large"]}
              width={100}
            />
          </div>
          <div>
            <FieldLabel>Text Density:</FieldLabel>
            <Dropdown
              value={textDensity}
              onChange={setTextDensity}
              options={["Compact", "Balanced", "Spacious"]}
              width={100}
            />
          </div>
        </div>
      </div>

      <div className="col-right">
        <div className="tag-hint" style={{ marginTop: 8 }}>
          Slides are generated by Alai from your summary and the options here.
          Use the Improve tab to add images to an existing deck.
        </div>

        <Divider />

        <SectionHead>AI Model &amp; Processing Settings</SectionHead>

        <FieldLabel>AI Model Selection:</FieldLabel>
        <Dropdown
          value={aiModel}
          onChange={setAiModel}
          options={["ChatGPT", "DeepSeek", "Gemini"]}
          width={130}
        />

        <div style={{ marginTop: 12 }}>
          <FieldLabel>Summarization Strictness:</FieldLabel>
          <Dropdown
            value={strictness}
            onChange={setStrictness}
            options={["Strict", "Moderate", "Loose"]}
            width={110}
          />
        </div>

        <Divider />

        <SectionHead>Content Style Settings</SectionHead>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 14,
          }}
        >
          <div>
            <FieldLabel>Slide Text Style:</FieldLabel>
            <Dropdown
              value={textStyle}
              onChange={setTextStyle}
              options={["Academic", "Casual", "Technical", "Narrative"]}
              width={110}
            />
          </div>
          <div>
            <FieldLabel>Bullet-point Limit per Slide</FieldLabel>
            <input
              className="num-inp"
              type="number"
              min={1}
              max={20}
              placeholder=""
              value={bulletLimit}
              onChange={(e) => setBulletLimit(e.target.value)}
            />
          </div>
        </div>

        <FieldLabel>Keywords Highlighting</FieldLabel>
        <label className="chk-row" onClick={() => setHighlightDefs((v) => !v)}>
          <div className={`chk-box ${highlightDefs ? "on" : ""}`}>
            {highlightDefs && <span className="chk-tick">✓</span>}
          </div>
          Highlight definitions
        </label>
        <label className="chk-row" onClick={() => setBoldKeywords((v) => !v)}>
          <div className={`chk-box ${boldKeywords ? "on" : ""}`}>
            {boldKeywords && <span className="chk-tick">✓</span>}
          </div>
          Enable bold keywords
        </label>

        {generateErr && (
          <div className="improve-err" style={{ marginTop: 12 }}>
            {generateErr}
          </div>
        )}
        {generateProgress && (
          <div
            style={{
              fontSize: 11.5,
              color: "#a5b4fc",
              marginTop: 12,
            }}
          >
            {generateProgress}
          </div>
        )}
        {archiveNote ? <div className="archive-note">{archiveNote}</div> : null}
      </div>
    </>
  );
}
