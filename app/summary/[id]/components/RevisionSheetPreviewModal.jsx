"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, Spinner } from "@/app/components/icons";
import Button from "@/app/components/ui/Button";
import { LoadingText } from "@/app/components/LoadingText";
import { downloadRevisionSheetPdf } from "../lib/revisionSheetPdf";
import "./RevisionSheetPreviewModal.css";

function formatCachedAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default function RevisionSheetPreviewModal({
  open,
  onClose,
  title,
  previewUrl,
  html,
  fromCache = false,
  cachedAt = null,
  regenerating = false,
  onRegenerate,
}) {
  const iframeRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleDownload() {
    if (!html || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadRevisionSheetPdf(html, title);
    } catch (e) {
      setDownloadError(e?.message || "Could not create PDF");
      setTimeout(() => setDownloadError(""), 4000);
    } finally {
      setDownloading(false);
    }
  }

  if (!open || !previewUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="revision-sheet-backdrop"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div
        className="revision-sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="revision-sheet-head">
          <div>
            <h2 id="revision-sheet-title" className="revision-sheet-title">
              {title?.trim() || "Revision sheet"}
            </h2>
            <p className="revision-sheet-sub">
              {regenerating
                ? "Regenerating revision notes…"
                : fromCache && cachedAt
                  ? `Showing saved notes from ${formatCachedAt(cachedAt)}. Regenerate if your summary changed.`
                  : "Preview your revision notes. Use Download PDF to save."}
            </p>
          </div>
          <button
            type="button"
            className="revision-sheet-close"
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="revision-sheet-frame-wrap">
          {regenerating ? (
            <div className="revision-sheet-regenerating" role="status">
              <Spinner size={22} />
              <span>
                <LoadingText active>Regenerating</LoadingText>
              </span>
            </div>
          ) : null}
          <iframe
            ref={iframeRef}
            className={`revision-sheet-frame${regenerating ? " revision-sheet-frame--busy" : ""}`}
            title="Revision sheet preview"
            src={previewUrl}
          />
        </div>
        <div className="revision-sheet-foot">
          {downloadError ? (
            <span className="revision-sheet-dl-err" role="alert">
              {downloadError}
            </span>
          ) : null}
          <Button type="button" variant="default" onClick={() => onClose?.()}>
            Close
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={regenerating}
            onClick={() => onRegenerate?.()}
          >
            {regenerating ? (
              <>
                <Spinner size={13} /> <LoadingText active>Regenerating</LoadingText>
              </>
            ) : (
              "Regenerate"
            )}
          </Button>
          <Button
            type="button"
            variant="revision"
            disabled={!html || downloading || regenerating}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <>
                <Spinner size={13} /> <LoadingText active>Downloading</LoadingText>
              </>
            ) : (
              "Download PDF"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
