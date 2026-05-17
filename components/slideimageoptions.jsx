"use client";

/**
 * SlideImageOptions
 * ─────────────────
 * Drop-in component for the slide generation form.
 *
 * Props:
 *   imageIds          string[]    – controlled; list of Alai image UUIDs
 *   onImageIdsChange  (ids: string[]) => void
 *   numImageVariants  number      – 0 | 1 | 2  (picture density)
 *   onVariantsChange  (n: number) => void
 *
 * Usage in your form:
 *
 *   const [imageIds, setImageIds] = useState([]);
 *   const [numImageVariants, setNumImageVariants] = useState(1);
 *
 *   <SlideImageOptions
 *     imageIds={imageIds}
 *     onImageIdsChange={setImageIds}
 *     numImageVariants={numImageVariants}
 *     onVariantsChange={setNumImageVariants}
 *   />
 *
 * Then include both in your generate call:
 *
 *   fetch("/api/generate-slides", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({
 *       summaryText,
 *       imageIds,          // ← from this component
 *       numImageVariants,  // ← from this component
 *       // ...rest of your fields
 *     }),
 *   });
 */

import { useState, useRef, useCallback } from "react";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];
const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const DENSITY_OPTIONS = [
  {
    value: 0,
    label: "None",
    desc: "Text-only slides",
    icon: "☰",
  },
  {
    value: 1,
    label: "Some",
    desc: "AI picks key images",
    icon: "◧",
  },
  {
    value: 2,
    label: "Rich",
    desc: "Images on every slide",
    icon: "▦",
  },
];

export default function SlideImageOptions({
  imageIds = [],
  onImageIdsChange,
  numImageVariants = 1,
  onVariantsChange,
}) {
  const [uploadedFiles, setUploadedFiles] = useState([]); // { name, id, status, error }
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  // ── Upload helpers ────────────────────────────────────────────────────────

  const uploadFiles = useCallback(
    async (files) => {
      const valid = [];
      const errors = [];

      for (const f of files) {
        if (!ALLOWED_TYPES.includes(f.type)) {
          errors.push(`${f.name}: unsupported type`);
          continue;
        }
        if (f.size > MAX_BYTES) {
          errors.push(`${f.name}: exceeds 10 MB`);
          continue;
        }
        if (uploadedFiles.length + valid.length >= MAX_FILES) {
          errors.push(`Max ${MAX_FILES} images allowed`);
          break;
        }
        valid.push(f);
      }

      if (errors.length) {
        alert(errors.join("\n"));
      }
      if (!valid.length) return;

      // Optimistic placeholders
      const placeholders = valid.map((f) => ({
        name: f.name,
        id: null,
        status: "uploading",
        localUrl: URL.createObjectURL(f),
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

        if (!res.ok) {
          throw new Error(json?.error || "Upload failed");
        }

        const ids = json.image_ids ?? [];

        setUploadedFiles((prev) => {
          const updated = [...prev];
          let idIdx = 0;
          for (let i = updated.length - placeholders.length; i < updated.length; i++) {
            updated[i] = {
              ...updated[i],
              id: ids[idIdx] ?? null,
              status: ids[idIdx] ? "done" : "error",
              error: ids[idIdx] ? null : "No ID returned",
            };
            idIdx++;
          }
          return updated;
        });

        onImageIdsChange?.([...imageIds, ...ids.filter(Boolean)]);
      } catch (err) {
        setUploadedFiles((prev) => {
          const updated = [...prev];
          for (let i = updated.length - placeholders.length; i < updated.length; i++) {
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

  const removeFile = (index) => {
    const removed = uploadedFiles[index];
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (removed?.id) {
      onImageIdsChange?.(imageIds.filter((id) => id !== removed.id));
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>
      {/* ── Picture density ── */}
      <div style={styles.section}>
        <label style={styles.sectionLabel}>Picture density</label>
        <p style={styles.sectionHint}>
          How many AI-generated images to include in slides
        </p>
        <div style={styles.densityRow}>
          {DENSITY_OPTIONS.map((opt) => {
            const active = numImageVariants === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onVariantsChange?.(opt.value)}
                style={{
                  ...styles.densityBtn,
                  ...(active ? styles.densityBtnActive : {}),
                }}
              >
                <span style={styles.densityIcon}>{opt.icon}</span>
                <span style={styles.densityLabel}>{opt.label}</span>
                <span style={styles.densityDesc}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Image upload ── */}
      <div style={styles.section}>
        <label style={styles.sectionLabel}>
          Your images{" "}
          <span style={styles.optionalTag}>optional</span>
        </label>
        <p style={styles.sectionHint}>
          Upload your own photos or diagrams — Alai will place them on relevant
          slides automatically. PNG, JPEG, WebP, GIF, AVIF, SVG · max 10 MB each
        </p>

        {/* Drop zone */}
        <div
          style={{
            ...styles.dropZone,
            ...(isDragging ? styles.dropZoneActive : {}),
            ...(isUploading ? styles.dropZoneUploading : {}),
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !isUploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          aria-label="Upload images"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            multiple
            style={{ display: "none" }}
            onChange={(e) => uploadFiles(Array.from(e.target.files))}
          />
          {isUploading ? (
            <span style={styles.dropText}>Uploading…</span>
          ) : (
            <>
              <span style={styles.dropIcon}>↑</span>
              <span style={styles.dropText}>
                {isDragging
                  ? "Drop to upload"
                  : "Drag & drop or click to browse"}
              </span>
              <span style={styles.dropSub}>
                Up to {MAX_FILES} images
              </span>
            </>
          )}
        </div>

        {/* Uploaded file list */}
        {uploadedFiles.length > 0 && (
          <ul style={styles.fileList}>
            {uploadedFiles.map((f, i) => (
              <li key={i} style={styles.fileItem}>
                {f.localUrl && (
                  <img
                    src={f.localUrl}
                    alt={f.name}
                    style={styles.fileThumb}
                  />
                )}
                <span
                  style={{
                    ...styles.fileName,
                    ...(f.status === "error" ? styles.fileNameError : {}),
                  }}
                >
                  {f.name}
                  {f.status === "uploading" && (
                    <span style={styles.fileStatus}> · uploading…</span>
                  )}
                  {f.status === "error" && (
                    <span style={styles.fileStatusError}> · {f.error}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={styles.removeBtn}
                  aria-label={`Remove ${f.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Inline styles (no Tailwind dependency, works in any Next.js project) ──────

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sectionLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#111",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  sectionHint: {
    fontSize: "12px",
    color: "#6b7280",
    margin: 0,
  },
  optionalTag: {
    fontSize: "11px",
    fontWeight: "400",
    color: "#9ca3af",
    background: "#f3f4f6",
    borderRadius: "4px",
    padding: "1px 5px",
  },

  // Density selector
  densityRow: {
    display: "flex",
    gap: "8px",
    marginTop: "4px",
  },
  densityBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
    padding: "10px 8px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    transition: "all 0.15s ease",
    outline: "none",
  },
  densityBtnActive: {
    border: "1.5px solid #4f46e5",
    background: "#eef2ff",
  },
  densityIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },
  densityLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#111",
  },
  densityDesc: {
    fontSize: "11px",
    color: "#6b7280",
    textAlign: "center",
  },

  // Drop zone
  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "20px",
    marginTop: "6px",
    border: "1.5px dashed #d1d5db",
    borderRadius: "10px",
    background: "#fafafa",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    minHeight: "90px",
    userSelect: "none",
  },
  dropZoneActive: {
    borderColor: "#4f46e5",
    background: "#eef2ff",
  },
  dropZoneUploading: {
    cursor: "default",
    opacity: 0.7,
  },
  dropIcon: {
    fontSize: "22px",
    color: "#9ca3af",
  },
  dropText: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
  },
  dropSub: {
    fontSize: "11px",
    color: "#9ca3af",
  },

  // File list
  fileList: {
    listStyle: "none",
    margin: "8px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    background: "#f9fafb",
    borderRadius: "7px",
    border: "1px solid #e5e7eb",
  },
  fileThumb: {
    width: "32px",
    height: "32px",
    objectFit: "cover",
    borderRadius: "4px",
    flexShrink: 0,
  },
  fileName: {
    fontSize: "12px",
    color: "#374151",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileNameError: {
    color: "#ef4444",
  },
  fileStatus: {
    color: "#6b7280",
  },
  fileStatusError: {
    color: "#ef4444",
  },
  removeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: "12px",
    padding: "2px 4px",
    borderRadius: "4px",
    flexShrink: 0,
    lineHeight: 1,
  },
};