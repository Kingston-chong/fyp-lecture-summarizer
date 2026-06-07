"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, Spinner } from "@/app/components/icons";
import Button from "@/app/components/ui/Button";
import { LoadingText } from "@/app/components/LoadingText";
import { downloadSummaryExportPdf } from "../lib/exportSummaryPdf";
import "./SummaryExportPreviewModal.css";

export default function SummaryExportPreviewModal({
  open,
  onClose,
  title,
  previewUrl,
  html,
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
      await downloadSummaryExportPdf(html, title);
    } catch (e) {
      setDownloadError(e?.message || "Could not create PDF");
      setTimeout(() => setDownloadError(""), 4000);
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  if (!open || !previewUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="summary-export-backdrop"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div
        className="summary-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="summary-export-head">
          <div>
            <h2 id="summary-export-title" className="summary-export-title">
              Save as PDF
            </h2>
            <p className="summary-export-sub">
              Preview your summary export. Download PDF saves a file directly
              to your device.
            </p>
          </div>
          <button
            type="button"
            className="summary-export-close"
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="summary-export-frame-wrap">
          <iframe
            ref={iframeRef}
            className="summary-export-frame"
            title="Summary PDF preview"
            src={previewUrl}
          />
        </div>
        <div className="summary-export-foot">
          {downloadError ? (
            <span className="summary-export-dl-err" role="alert">
              {downloadError}
            </span>
          ) : null}
          <Button type="button" variant="default" onClick={() => onClose?.()}>
            Close
          </Button>
          <Button type="button" variant="default" onClick={handlePrint}>
            Print
          </Button>
          <Button
            type="button"
            variant="revision"
            disabled={!html || downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <>
                <Spinner size={13} />{" "}
                <LoadingText active>Downloading</LoadingText>
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
