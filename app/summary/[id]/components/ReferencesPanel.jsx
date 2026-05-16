"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TrashIcon, Spinner } from "@/app/components/icons";

// ─── Citation style formatters ────────────────────────────────────────────────

const CITATION_STYLES = [
  { id: "numeric", label: "Numeric", hint: "[1] Author. Title. Venue, Year." },
  { id: "apa", label: "APA", hint: "Author (Year). Title. Venue." },
  { id: "harvard", label: "Harvard", hint: "Author (Year) Title, Venue." },
  { id: "mla", label: "MLA", hint: 'Author. "Title." Venue, Year.' },
  { id: "chicago", label: "Chicago", hint: "Author. Title. Venue, Year." },
  { id: "vancouver", label: "Vancouver", hint: "Author. Title. Venue. Year;" },
];

function formatAuthors(authors, style) {
  if (!authors) return null;
  const parts = authors
    .split(";")
    .map((a) => a.trim())
    .filter(Boolean);
  if (parts.length === 0) return authors;

  if (style === "apa" || style === "vancouver") {
    return parts
      .map((a) => {
        const commaIdx = a.indexOf(",");
        if (commaIdx > -1) return a;
        const words = a.split(" ").filter(Boolean);
        if (words.length < 2) return a;
        const last = words[words.length - 1];
        const initials = words
          .slice(0, -1)
          .map((w) => w[0].toUpperCase() + ".")
          .join("");
        return `${last}, ${initials}`;
      })
      .join(", ");
  }

  if (style === "mla") {
    if (parts.length === 1) {
      const words = parts[0].split(" ").filter(Boolean);
      if (words.length < 2) return parts[0];
      const last = words[words.length - 1];
      const first = words.slice(0, -1).join(" ");
      return `${last}, ${first}`;
    }
    const [first, ...rest] = parts;
    const words = first.split(" ").filter(Boolean);
    const inv =
      words.length < 2
        ? first
        : `${words[words.length - 1]}, ${words.slice(0, -1).join(" ")}`;
    return [inv, ...rest].join(", ");
  }

  return parts.join(", ");
}

function formatCitation(ref, style) {
  const title = ref.title || "Untitled";
  const year = ref.year || null;
  const venue = ref.venue || null;
  const doi = ref.doi || null;
  const url = ref.url || null;
  const authors = formatAuthors(ref.authors, style);
  const doiSuffix = doi ? ` doi:${doi}` : url ? ` ${url}` : "";

  switch (style) {
    case "apa": {
      const a = authors ?? null;
      const y = year ? ` (${year}).` : ".";
      const t = ` ${title}.`;
      const v = venue ? ` ${venue}.` : "";
      return [a, y, t, v, doiSuffix ? doiSuffix + "." : ""]
        .filter(Boolean)
        .join("");
    }
    case "harvard": {
      const a = authors || null;
      const y = year ? ` (${year})` : "";
      const t = ` ${title}`;
      const v = venue ? `, ${venue}` : "";
      return `${a || ""}${y} ${t}${v}.${doiSuffix}`;
    }
    case "mla": {
      const a = authors ? `${authors}.` : null;
      const t = ` "${title}."`;
      const v = venue ? ` ${venue}` : "";
      const y = year ? `, ${year}` : "";
      return `${a || ""}${t}${v}${y}.${doiSuffix}`;
    }
    case "chicago": {
      const a = authors ? `${authors}.` : null;
      const t = ` ${title}.`;
      const v = venue ? ` ${venue}` : "";
      const y = year ? `, ${year}` : "";
      return `${a || ""}${t}${v}${y}.${doiSuffix}`;
    }
    case "vancouver": {
      const a = authors ? `${authors}.` : null;
      const t = ` ${title}.`;
      const v = venue ? ` ${venue}.` : "";
      const y = year ? ` ${year};` : "";
      return `${a || ""}${t}${v}${y}${doiSuffix}`;
    }
    case "numeric":
    default: {
      const a = authors ? `${authors}.` : null;
      const t = ` ${title}.`;
      const v = venue ? ` ${venue}` : "";
      const y = year ? `, ${year}` : "";
      return `${a || ""}${t}${v}${y}.${doiSuffix}`;
    }
  }
}

// ─── Sort key — first author's last name, falling back to title ───────────────
function getSortKey(ref) {
  if (ref.authors) {
    const first = ref.authors.split(";")[0].trim();
    const commaIdx = first.indexOf(",");
    if (commaIdx > -1) return first.slice(0, commaIdx).trim().toLowerCase();
    const words = first.split(" ").filter(Boolean);
    return (words[words.length - 1] || first).toLowerCase();
  }
  return (ref.title || "").toLowerCase();
}

// ─── Copy-all builder — sorted A–Z only when requested ────────────────────────
function buildExportText(references, style, alphabetical = false) {
  const list = alphabetical
    ? [...references].sort((a, b) => getSortKey(a).localeCompare(getSortKey(b)))
    : [...references];
  return list
    .map((ref, i) => {
      const prefix = style === "numeric" ? `[${ref.marker}] ` : `${i + 1}. `;
      return prefix + formatCitation(ref, style);
    })
    .join("\n\n");
}

// ─── Missing-field detector ───────────────────────────────────────────────────
function getMissingFields(ref) {
  const missing = [];
  if (!ref.authors) missing.push("authors");
  if (!ref.year) missing.push("year");
  if (!ref.venue) missing.push("venue");
  if (!ref.title) missing.push("title");
  return missing;
}

// ─── Save success toast ───────────────────────────────────────────────────────
function ReferenceSaveToast({ message }) {
  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <div className="rp-toast" role="status" aria-live="polite">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M4.5 7l2 2 3.5-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {message}
    </div>,
    document.body,
  );
}

// ─── EditReferenceModal ───────────────────────────────────────────────────────
function EditReferenceModal({
  reference,
  citationStyle,
  onSave,
  onClose,
  saving = false,
}) {
  const [draft, setDraft] = useState({
    title: reference.title || "",
    authors: reference.authors || "",
    year: reference.year || "",
    venue: reference.venue || "",
    doi: reference.doi || "",
    url: reference.url || "",
    kind: reference.kind || "paper",
    // Extended fields
    volume: reference.volume || "",
    issue: reference.issue || "",
    pages: reference.pages || "",
    publisher: reference.publisher || "",
    edition: reference.edition || "",
    accessed: reference.accessed || "",
    abstract: reference.abstract || "",
  });

  const [localSaving, setLocalSaving] = useState(false);
  const isSaving = saving || localSaving;

  const overlayRef = useRef(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => firstInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isSaving]);

  async function handleSaveClick() {
    if (!canSave || isSaving) return;
    setLocalSaving(true);
    try {
      await onSave({ ...reference, ...draft });
    } finally {
      setLocalSaving(false);
    }
  }

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  const canSave = draft.title.trim().length > 0;
  const previewRef = { ...reference, ...draft };
  const previewText = formatCitation(previewRef, citationStyle);
  const missingInDraft = getMissingFields({ ...reference, ...draft });

  function handleOverlayClick(e) {
    if (isSaving) return;
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      className="rp-modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit reference ${reference.marker}`}
    >
      <div className="rp-modal">
        {/* ── Modal header ── */}
        <div className="rp-modal-head">
          <div className="rp-modal-head-left">
            <span className="rp-modal-marker">[{reference.marker}]</span>
            <span className="rp-modal-title-txt">Edit reference</span>
            {missingInDraft.length > 0 && (
              <span
                className="rp-modal-missing-badge"
                title={`Missing: ${missingInDraft.join(", ")}`}
              >
                {missingInDraft.length} field
                {missingInDraft.length > 1 ? "s" : ""} missing
              </span>
            )}
          </div>
          <button
            type="button"
            className="rp-modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Form fields ── */}
        <div className="rp-modal-body">
          {/* Title */}
          <div className="rp-field rp-field--full">
            <label className="rp-field-label" htmlFor="rp-edit-title">
              Title <span className="rp-field-required">*</span>
            </label>
            <input
              id="rp-edit-title"
              ref={firstInputRef}
              type="text"
              className="rp-field-input"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Full title of the work"
            />
          </div>

          {/* Authors */}
          <div className="rp-field rp-field--full">
            <label className="rp-field-label" htmlFor="rp-edit-authors">
              Authors
              {!draft.authors && (
                <span className="rp-field-missing-tag">missing</span>
              )}
            </label>
            <textarea
              id="rp-edit-authors"
              className="rp-field-input rp-field-textarea"
              value={draft.authors}
              onChange={(e) => set("authors", e.target.value)}
              placeholder="e.g. Smith, J.; Jones, A. B."
              rows={2}
            />
            <span className="rp-field-hint">
              Separate multiple authors with a semicolon ( ; )
            </span>
          </div>

          {/* Year + Kind */}
          <div className="rp-field-row">
            <div className="rp-field">
              <label className="rp-field-label" htmlFor="rp-edit-year">
                Year
                {!draft.year && (
                  <span className="rp-field-missing-tag">missing</span>
                )}
              </label>
              <input
                id="rp-edit-year"
                type="text"
                className="rp-field-input"
                value={draft.year}
                onChange={(e) => set("year", e.target.value)}
                placeholder="e.g. 2023"
                maxLength={4}
                inputMode="numeric"
              />
            </div>
            <div className="rp-field">
              <label className="rp-field-label" htmlFor="rp-edit-kind">
                Source type
              </label>
              <select
                id="rp-edit-kind"
                className="rp-field-input rp-field-select"
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value)}
              >
                <option value="paper">Academic paper</option>
                <option value="web">Web / Online</option>
                <option value="upload">Uploaded file</option>
              </select>
            </div>
          </div>

          {/* Venue */}
          <div className="rp-field rp-field--full">
            <label className="rp-field-label" htmlFor="rp-edit-venue">
              Venue / Journal / Publisher
              {!draft.venue && (
                <span className="rp-field-missing-tag">missing</span>
              )}
            </label>
            <input
              id="rp-edit-venue"
              type="text"
              className="rp-field-input"
              value={draft.venue}
              onChange={(e) => set("venue", e.target.value)}
              placeholder="e.g. Nature, NeurIPS, Oxford University Press"
            />
          </div>

          {/* DOI + URL */}
          <div className="rp-field-row">
            <div className="rp-field">
              <label className="rp-field-label" htmlFor="rp-edit-doi">
                DOI
              </label>
              <input
                id="rp-edit-doi"
                type="text"
                className="rp-field-input"
                value={draft.doi}
                onChange={(e) => set("doi", e.target.value)}
                placeholder="10.xxxx/xxxxx"
              />
            </div>
            <div className="rp-field">
              <label className="rp-field-label" htmlFor="rp-edit-url">
                URL
              </label>
              <input
                id="rp-edit-url"
                type="url"
                className="rp-field-input"
                value={draft.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Volume + Issue (paper only) */}
          {draft.kind === "paper" && (
            <div className="rp-field-row">
              <div className="rp-field">
                <label className="rp-field-label" htmlFor="rp-edit-volume">
                  Volume
                </label>
                <input
                  id="rp-edit-volume"
                  type="text"
                  className="rp-field-input"
                  value={draft.volume}
                  onChange={(e) => set("volume", e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="rp-field">
                <label className="rp-field-label" htmlFor="rp-edit-issue">
                  Issue / Number
                </label>
                <input
                  id="rp-edit-issue"
                  type="text"
                  className="rp-field-input"
                  value={draft.issue}
                  onChange={(e) => set("issue", e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="rp-field">
                <label className="rp-field-label" htmlFor="rp-edit-pages">
                  Pages
                </label>
                <input
                  id="rp-edit-pages"
                  type="text"
                  className="rp-field-input"
                  value={draft.pages}
                  onChange={(e) => set("pages", e.target.value)}
                  placeholder="e.g. 45–62"
                />
              </div>
            </div>
          )}

          {/* Publisher + Edition (paper or upload) */}
          {(draft.kind === "paper" || draft.kind === "upload") && (
            <div className="rp-field-row">
              <div className="rp-field">
                <label className="rp-field-label" htmlFor="rp-edit-publisher">
                  Publisher
                </label>
                <input
                  id="rp-edit-publisher"
                  type="text"
                  className="rp-field-input"
                  value={draft.publisher}
                  onChange={(e) => set("publisher", e.target.value)}
                  placeholder="e.g. MIT Press"
                />
              </div>
              <div className="rp-field">
                <label className="rp-field-label" htmlFor="rp-edit-edition">
                  Edition
                </label>
                <input
                  id="rp-edit-edition"
                  type="text"
                  className="rp-field-input"
                  value={draft.edition}
                  onChange={(e) => set("edition", e.target.value)}
                  placeholder="e.g. 3rd ed."
                />
              </div>
            </div>
          )}

          {/* Accessed date (web only) */}
          {draft.kind === "web" && (
            <div className="rp-field">
              <label className="rp-field-label" htmlFor="rp-edit-accessed">
                Date accessed
              </label>
              <input
                id="rp-edit-accessed"
                type="text"
                className="rp-field-input"
                value={draft.accessed}
                onChange={(e) => set("accessed", e.target.value)}
                placeholder="e.g. 12 May 2024"
              />
              <span className="rp-field-hint">
                Required by many styles for online sources
              </span>
            </div>
          )}

          {/* Abstract — read-only display from source */}
          {draft.abstract && (
            <div className="rp-field rp-field--full">
              <span className="rp-field-label">Abstract</span>
              <div className="rp-abstract-display">{draft.abstract}</div>
            </div>
          )}

          {/* Live citation preview */}
          <div className="rp-preview-block">
            <div className="rp-preview-label">
              Preview
              <span className="rp-preview-style-tag">
                {citationStyle.toUpperCase()}
              </span>
            </div>
            <div className="rp-preview-text">
              {citationStyle === "numeric" && (
                <span className="rp-preview-marker">[{reference.marker}]</span>
              )}{" "}
              {previewText}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="rp-modal-foot">
          <button
            type="button"
            className="rp-modal-btn-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rp-modal-btn-save"
            disabled={!canSave || isSaving}
            onClick={() => void handleSaveClick()}
            aria-busy={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner size={12} color="currentColor" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CopyAllButton ────────────────────────────────────────────────────────────
function CopyAllButton({ references, style, alphabetical }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildExportText(references, style, alphabetical);
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [references, style, alphabetical]);

  return (
    <button
      type="button"
      className={`rp-copy-all ${copied ? "copied" : ""}`}
      title={
        copied
          ? "Copied!"
          : alphabetical
            ? "Copy all (A–Z order)"
            : "Copy all (citation order)"
      }
      onClick={handleCopy}
      disabled={references.length === 0}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect
              x="1"
              y="3"
              width="7"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          Copy all
        </>
      )}
    </button>
  );
}

// ─── StylePicker ──────────────────────────────────────────────────────────────
function StylePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current =
    CITATION_STYLES.find((s) => s.id === value) ?? CITATION_STYLES[0];

  return (
    <div className="rp-style-picker" style={{ position: "relative" }}>
      <button
        type="button"
        className="rp-style-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change citation style"
      >
        <span className="rp-style-label">{current.label}</span>
        <svg
          className={`rp-chevron ${open ? "open" : ""}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          className="rp-style-menu"
          role="listbox"
          aria-label="Citation style"
          onMouseLeave={() => setOpen(false)}
        >
          {CITATION_STYLES.map((s) => (
            <li
              key={s.id}
              role="option"
              aria-selected={s.id === value}
              className={`rp-style-opt ${s.id === value ? "on" : ""}`}
              onMouseDown={() => {
                onChange(s.id);
                setOpen(false);
              }}
            >
              <span className="rp-style-opt-label">{s.label}</span>
              <span className="rp-style-opt-hint">{s.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── SortToggle ───────────────────────────────────────────────────────────────
function SortToggle({ alphabetical, onChange }) {
  return (
    <button
      type="button"
      className={`rp-sort-btn ${alphabetical ? "on" : ""}`}
      title={
        alphabetical
          ? "Sorted A–Z (click to revert to citation order)"
          : "Sort A–Z by author when copying"
      }
      onClick={() => onChange(!alphabetical)}
      aria-pressed={alphabetical}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path
          d="M1 3h10M3 6h6M5 9h2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      A–Z
    </button>
  );
}

// ─── ReferenceItem ────────────────────────────────────────────────────────────
function ReferenceItem({
  item: reference,
  style,
  isActive,
  isMutating,
  canDelete,
  onSelect,
  onHover,
  onDelete,
  onEdit,
}) {
  const [copied, setCopied] = useState(false);
  const url =
    reference.url ||
    (reference.doi ? `https://doi.org/${reference.doi}` : null);
  const formattedCitation = formatCitation(reference, style);
  const missing = getMissingFields(reference);

  function handleCopySingle() {
    const text =
      style === "numeric"
        ? `[${reference.marker}] ${formattedCitation}`
        : formattedCitation;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <li
      className={`rp-item ${isActive ? "active" : ""} ${isMutating ? "mutating" : ""}`}
    >
      {missing.length > 0 && (
        <div
          className="rp-item-warning"
          title={`Missing: ${missing.join(", ")} — click edit to fill in`}
        />
      )}

      <div className="rp-item-marker" aria-hidden>
        {style === "numeric" ? `[${reference.marker}]` : reference.marker}
      </div>

      <div
        className="rp-item-body"
        role="button"
        tabIndex={0}
        onClick={() => onSelect(reference)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(reference)}
        onMouseEnter={() => onHover?.(reference.marker)}
        onMouseLeave={() => onHover?.(null)}
        aria-label={`Go to citation ${reference.marker}: ${reference.title}`}
      >
        <div className="rp-item-title">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rp-item-link"
              onClick={(e) => e.stopPropagation()}
            >
              {reference.title || "Untitled"}
            </a>
          ) : (
            <span>{reference.title || "Untitled"}</span>
          )}
          {missing.length > 0 && (
            <span className="rp-item-missing-hint">
              {missing.length} missing
            </span>
          )}
        </div>
        <div className="rp-item-formatted">{formattedCitation}</div>
        {reference.kind && (
          <span className={`rp-item-kind rp-kind-${reference.kind}`}>
            {reference.kind === "upload"
              ? "Uploaded file"
              : reference.kind === "paper"
                ? "Academic"
                : "Web"}
          </span>
        )}
      </div>

      <div className="rp-item-actions">
        <button
          type="button"
          className={`rp-item-edit-btn ${missing.length > 0 ? "has-warning" : ""}`}
          title="Edit reference details"
          aria-label={`Edit reference ${reference.marker}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(reference);
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M8.5 1.5a1.414 1.414 0 012 2L3.5 10.5l-3 .5.5-3 7.5-6.5z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={`rp-item-copy-btn ${copied ? "copied" : ""}`}
          title={copied ? "Copied!" : "Copy citation"}
          onClick={handleCopySingle}
          aria-label={`Copy citation ${reference.marker}`}
        >
          {copied ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect
                x="1"
                y="3"
                width="7"
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rp-item-ext-btn"
            title="Open source"
            aria-label={`Open source for citation ${reference.marker}`}
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <path
                d="M8 1h3m0 0v3m0-3L5.5 6.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
        {canDelete && (
          <button
            type="button"
            className="rp-item-delete-btn"
            title="Remove reference"
            aria-label={`Remove reference ${reference.marker}`}
            disabled={isMutating}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(reference);
            }}
          >
            <TrashIcon size={11} />
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ReferencesPanel({
  references,
  loading,
  activeMarker,
  onSelectReference,
  onMarkerHover,
  onDeleteReference,
  onUpdateReference, // (updatedRef) => void  — caller persists to API
  mutatingRefId = null,
  embedded = false,
}) {
  const [citationStyle, setCitationStyle] = useState("apa");
  const alphabetical = true; // copy is always A–Z for report writing
  const [editingRef, setEditingRef] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  useEffect(() => {
    if (!saveToast) return;
    const t = setTimeout(() => setSaveToast(null), 2800);
    return () => clearTimeout(t);
  }, [saveToast]);

  const canDelete = typeof onDeleteReference === "function";
  const canEdit = true; // modal always openable; save is guarded inside handleSaveEdit
  const count = references.length;
  const incompleteCount = references.filter(
    (r) => getMissingFields(r).length > 0,
  ).length;

  async function handleSaveEdit(updatedRef) {
    if (!onUpdateReference) return false;
    const ok = await onUpdateReference(updatedRef);
    if (ok) {
      setSaveToast(`Reference [${updatedRef.marker}] saved`);
      setEditingRef(null);
    }
    return ok;
  }

  return (
    <>
      <div className={`rp-root${embedded ? " rp-root--embedded" : ""}`}>
        {/* ── Header ── */}
        <div className="rp-head">
          {!embedded && (
          <div className="rp-head-top">
            <div className="rp-head-left">
              <span className="rp-title">References</span>
              {count > 0 && <span className="rp-count">{count}</span>}
              {incompleteCount > 0 && (
                <span
                  className="rp-incomplete-badge"
                  title={`${incompleteCount} reference${incompleteCount > 1 ? "s are" : " is"} missing fields`}
                >
                  {incompleteCount} incomplete
                </span>
              )}
            </div>
          </div>
          )}
          {embedded && incompleteCount > 0 && (
            <div className="rp-head-embedded-meta">
              <span
                className="rp-incomplete-badge"
                title={`${incompleteCount} reference${incompleteCount > 1 ? "s are" : " is"} missing fields`}
              >
                {incompleteCount} incomplete
              </span>
            </div>
          )}
          <div className="rp-head-bottom">
            <StylePicker value={citationStyle} onChange={setCitationStyle} />
          </div>
          {count > 0 && (
            <div className="rp-head-copy-row">
              <CopyAllButton
                references={references}
                style={citationStyle}
                alphabetical={alphabetical}
              />
            </div>
          )}
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div className="rp-state">
            <div className="rp-spinner" />
            <span>Loading references…</span>
          </div>
        ) : count === 0 ? (
          <div className="rp-state rp-empty">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              opacity="0.35"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <rect
                x="9"
                y="3"
                width="6"
                height="4"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M9 12h6M9 16h4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>No references found in this summary.</span>
            <span className="rp-empty-hint">
              References are extracted automatically in Lecturer mode. Try
              regenerating if none appear.
            </span>
          </div>
        ) : (
          <ul className="rp-list">
            {references.map((ref) => (
              <ReferenceItem
                key={ref.id ?? ref.marker}
                item={ref}
                style={citationStyle}
                isActive={activeMarker === ref.marker}
                isMutating={mutatingRefId === ref.id}
                canDelete={canDelete}
                onSelect={onSelectReference}
                onHover={onMarkerHover}
                onDelete={onDeleteReference}
                onEdit={canEdit ? setEditingRef : () => {}}
              />
            ))}
          </ul>
        )}
      </div>

      {editingRef &&
        typeof document !== "undefined" &&
        createPortal(
          <EditReferenceModal
            reference={editingRef}
            citationStyle={citationStyle}
            onSave={handleSaveEdit}
            onClose={() => setEditingRef(null)}
            saving={mutatingRefId === editingRef?.id}
          />,
          document.body,
        )}

      <ReferenceSaveToast message={saveToast} />
    </>
  );
}
