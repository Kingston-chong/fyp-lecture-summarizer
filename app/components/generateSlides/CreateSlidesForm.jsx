"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FieldLabel, SectionHead, Divider, SelectMenu, UploadCloudIco } from "./ui.jsx";
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
    <div className="csf-extra-wrap" ref={wrapRef}>
      <div className="csf-textarea-wrap">
        <textarea
          className="create-prompt-area"
          rows={3}
          maxLength={4000}
          placeholder='e.g. "focus on diagrams", "add a recap slide at the end"…'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          title="Pick a suggestion"
          className={`csf-suggest-btn${open ? " csf-suggest-btn--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
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

      {open && (
        <div className="csf-suggest-menu">
          <div className="csf-suggest-menu-head">Suggestions — click to add</div>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className="csf-suggest-option"
              onMouseDown={() => {
                onApplyPreset(preset);
                setOpen(false);
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

function DensityPicker({ value, onChange }) {
  return (
    <div className="gs-density-row" role="group" aria-label="Picture density">
      {DENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`gs-density-btn${value === opt.value ? " on" : ""}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          <span className="gs-density-label">{opt.label}</span>
          <span className="gs-density-desc">{opt.desc}</span>
        </button>
      ))}
    </div>
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

const ALAI_IMAGE_STYLE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "realistic", label: "Realistic" },
  { value: "artistic", label: "Artistic" },
  { value: "cartoon", label: "Cartoon" },
  { value: "three_d", label: "3D" },
];

const DENSITY_OPTIONS = [
  { value: 0, label: "None", desc: "Text only" },
  { value: 1, label: "Some", desc: "AI picks" },
  { value: 2, label: "Rich", desc: "Every slide" },
];

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];
const MAX_IMAGE_FILES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function themeOptionLabel(theme) {
  return (
    String(theme?.name || theme?.title || theme?.label || "").trim() ||
    String(theme?.id || theme?.theme_id || "Theme")
  );
}

function themeOptionId(theme) {
  return String(theme?.id || theme?.theme_id || "").trim();
}

// ── Image upload sub-component ────────────────────────────────────────────────

function ImageUploadSection({
  uploadedFiles,
  onUpload,
  onRemove,
  isUploading,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    onUpload(Array.from(e.dataTransfer.files));
  };

  const zoneClass = [
    "csf-upload-zone",
    isDragging ? "csf-upload-zone--dragging" : "",
    isUploading ? "csf-upload-zone--disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="csf-upload-wrap">
      <div
        className={zoneClass}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isUploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          style={{ display: "none" }}
          onChange={(e) => onUpload(Array.from(e.target.files))}
        />
        <span className="csf-upload-icon">
          <UploadCloudIco size={20} />
        </span>
        <span className="csf-upload-label">
          {isUploading
            ? "Uploading…"
            : isDragging
              ? "Drop to upload"
              : "Drag & drop or click to browse"}
        </span>
        <span className="csf-upload-hint">
          PNG, JPEG, WebP, GIF, AVIF, SVG · max 10 MB · up to{" "}
          {MAX_IMAGE_FILES} files
        </span>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="csf-file-list">
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              className={`csf-file-chip${f.status === "error" ? " csf-file-chip--error" : ""}`}
            >
              {f.localUrl && f.status !== "error" && (
                <img
                  src={f.localUrl}
                  alt={f.name}
                  className="csf-file-thumb"
                />
              )}
              <span
                className={`csf-file-status csf-file-status--${f.status === "uploading" ? "uploading" : f.status === "done" ? "done" : "error"}`}
              />
              <span className="csf-file-name">
                {f.name}
                {f.status === "uploading" && (
                  <span className="csf-file-uploading"> · uploading…</span>
                )}
                {f.status === "error" && (
                  <span className="csf-file-error"> · {f.error}</span>
                )}
              </span>
              <button
                type="button"
                className="csf-file-remove"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

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
  alaiThemes = [],
  alaiThemesLoading = false,
  alaiThemesHint = "",
  selectedThemeId,
  setSelectedThemeId,
  imageStyle,
  setImageStyle,
  alaiVibes = [],
  alaiVibesLoading = false,
  selectedVibeId,
  setSelectedVibeId,
  // ── NEW ───────────────────────────────────────────────────────────────────
  imageIds = [],
  onImageIdsChange,
  numImageVariants = 1,
  onVariantsChange,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localImageVariants, setLocalImageVariants] =
    useState(numImageVariants);
  const isAlai = provider === "alai";
  const effectiveImageVariants = onVariantsChange
    ? numImageVariants
    : localImageVariants;
  const handleImageVariantsChange = (v) => {
    if (onVariantsChange) onVariantsChange(v);
    else setLocalImageVariants(v);
  };

  // Image upload state lives here so it doesn't need a separate component file
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(
    async (files) => {
      const valid = [];
      const errors = [];

      for (const f of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
          errors.push(`${f.name}: unsupported type`);
          continue;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          errors.push(`${f.name}: exceeds 10 MB`);
          continue;
        }
        if (uploadedFiles.length + valid.length >= MAX_IMAGE_FILES) {
          errors.push(`Max ${MAX_IMAGE_FILES} images allowed`);
          break;
        }
        valid.push(f);
      }

      if (errors.length) alert(errors.join("\n"));
      if (!valid.length) return;

      const placeholders = valid.map((f) => ({
        name: f.name,
        id: null,
        status: "uploading",
        localUrl: URL.createObjectURL(f),
        error: null,
      }));

      setUploadedFiles((prev) => [...prev, ...placeholders]);
      setIsUploading(true);

      try {
        const form = new FormData();
        valid.forEach((f) => form.append("files", f));

        const res = await fetch("/api/generate-slides/upload-images", {
          method: "POST",
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Upload failed");

        const ids = json.image_ids ?? [];

        setUploadedFiles((prev) => {
          const updated = [...prev];
          const start = updated.length - placeholders.length;
          ids.forEach((id, idx) => {
            updated[start + idx] = {
              ...updated[start + idx],
              id,
              status: "done",
            };
          });
          return updated;
        });

        onImageIdsChange?.([...imageIds, ...ids.filter(Boolean)]);
      } catch (err) {
        setUploadedFiles((prev) => {
          const updated = [...prev];
          const start = updated.length - placeholders.length;
          for (let i = start; i < updated.length; i++) {
            updated[i] = { ...updated[i], status: "error", error: err.message };
          }
          return updated;
        });
      } finally {
        setIsUploading(false);
      }
    },
    [uploadedFiles, imageIds, onImageIdsChange],
  );

  const handleRemoveFile = (index) => {
    const removed = uploadedFiles[index];
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (removed?.id) {
      onImageIdsChange?.(imageIds.filter((id) => id !== removed.id));
    }
  };

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

        {isAlai || provider === "2slides" ? (
          <>
            <Divider />
            <SectionHead>{isAlai ? "Alai theme" : "2slides theme"}</SectionHead>
            {alaiThemesLoading ? (
              <div className="tag-hint">Loading themes…</div>
            ) : alaiThemes.length > 0 ? (
              <SelectMenu
                value={selectedThemeId || ""}
                onChange={(id) => setSelectedThemeId(id || null)}
                placeholder="Choose a theme…"
                maxMenuHeight={260}
                options={alaiThemes
                  .map((t) => ({
                    value: themeOptionId(t),
                    label: themeOptionLabel(t),
                  }))
                  .filter((o) => o.value)}
              />
            ) : (
              <div className="tag-hint" style={{ marginBottom: 8 }}>
                {alaiThemesHint ||
                  (isAlai
                    ? "No themes available. Configure ALAI_API_KEY to browse Alai themes."
                    : "No themes available. Configure TWOSLIDES_API_KEY and pick a theme before generating.")}
              </div>
            )}
          </>
        ) : null}

        {isAlai ? (
          <>
            <Divider />
            <SectionHead>Picture density</SectionHead>
            <div className="tag-hint" style={{ marginBottom: 8 }}>
              How many AI-generated images Alai adds to slides
            </div>
            <DensityPicker
              value={effectiveImageVariants}
              onChange={handleImageVariantsChange}
            />
          </>
        ) : null}
      </div>

      <div className="col-right">
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

        {isAlai ? (
          <>
            <Divider />
            <FieldLabel>Image style</FieldLabel>
            <SelectMenu
              value={imageStyle}
              onChange={setImageStyle}
              options={ALAI_IMAGE_STYLE_OPTIONS}
            />

            <Divider />
            <SectionHead>
              Your images <span className="csf-optional-badge">optional</span>
            </SectionHead>
            <div className="tag-hint" style={{ marginBottom: 8 }}>
              Upload your own photos or diagrams — Alai places them on
              relevant slides automatically
            </div>
            <ImageUploadSection
              uploadedFiles={uploadedFiles}
              onUpload={handleUpload}
              onRemove={handleRemoveFile}
              isUploading={isUploading}
            />

            <Divider />
            <FieldLabel>Visual vibe (optional)</FieldLabel>
            {alaiVibesLoading ? (
              <div className="tag-hint">Loading vibes…</div>
            ) : (
              <SelectMenu
                value={selectedVibeId}
                onChange={setSelectedVibeId}
                placeholder="None (default)"
                width="100%"
                options={[
                  { value: "", label: "None (default)" },
                  ...alaiVibes
                    .map((v) => {
                      const id = String(v?.id || v?.vibe_id || "").trim();
                      if (!id) return null;
                      return {
                        value: id,
                        label:
                          String(
                            v?.name || v?.title || v?.label || "",
                          ).trim() || id,
                      };
                    })
                    .filter(Boolean),
                ]}
              />
            )}
            <div className="tag-hint" style={{ marginTop: 6 }}>
              Vibes set mood and palette. Selecting a vibe uses extra Alai image
              credits.
            </div>
          </>
        ) : null}

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
              <SelectMenu
                value={template}
                onChange={setTemplate}
                width={110}
                options={[
                  "Academic",
                  "Professional",
                  "Creative",
                  "Minimal",
                  "Corporate",
                ].map((o) => ({ value: o, label: o }))}
              />
            </div>
            <div>
              <FieldLabel>Font size:</FieldLabel>
              <SelectMenu
                value={fontSize}
                onChange={setFontSize}
                width={90}
                options={["Small", "Normal", "Large"].map((o) => ({
                  value: o,
                  label: o,
                }))}
              />
            </div>
            <div>
              <FieldLabel>Text density:</FieldLabel>
              <SelectMenu
                value={textDensity}
                onChange={setTextDensity}
                width={100}
                options={["Compact", "Balanced", "Spacious"].map((o) => ({
                  value: o,
                  label: o,
                }))}
              />
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
          <div className="improve-err mt-3">{generateErr}</div>
        ) : null}
        {generateProgress ? (
          <div className="gs-progress-bar-wrap">
            <div className="gs-progress-track">
              <div className="gs-progress-fill" />
            </div>
            <div className="gs-progress-label">
              <span className="gs-progress-dot" />
              {generateProgress}
            </div>
          </div>
        ) : null}
        {archiveNote ? <div className="archive-note">{archiveNote}</div> : null}
      </div>
    </>
  );
}
