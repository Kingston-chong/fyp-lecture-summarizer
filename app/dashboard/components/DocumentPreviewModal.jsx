"use client";

import { useMemo } from "react";
import { CloseIcon } from "@/app/components/icons";
import { LoadingText } from "@/app/components/LoadingText";
import { isTextPreviewName } from "@/app/dashboard/helpers";
import { markdownToHtml } from "@/lib/markdown";
import "./document-preview-markdown.css";

/**
 * In-dashboard document preview (PDF / Office iframe, or markdown text viewer).
 */
export default function DocumentPreviewModal({
  doc,
  onClose,
  formatBytes,
  docPreviewTabHref,
  docPreviewSrc,
  textContent = null,
  docPreviewTokenLoading,
  docPreviewIframeLoading,
  docPreviewSetupErr,
  onPreviewIframeLoad,
}) {
  if (!doc) return null;

  const isTextPreview =
    textContent != null ||
    (isTextPreviewName(doc.name) && !docPreviewSrc);
  const busy =
    docPreviewTokenLoading ||
    (isTextPreview
      ? docPreviewIframeLoading && textContent == null
      : docPreviewSrc && docPreviewIframeLoading);

  const sizeLabel =
    typeof doc.size === "number" && doc.size > 0
      ? formatBytes(doc.size)
      : doc.size || doc.type;

  const textHtml = useMemo(
    () => (textContent != null ? markdownToHtml(textContent) : ""),
    [textContent],
  );

  return (
    <div className="modal-backdrop doc-preview-backdrop" onClick={onClose}>
      <div
        className="modal-box doc-preview-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="doc-preview-head">
          <div>
            <div className="doc-preview-title">{doc.name}</div>
            <div className="doc-preview-meta">
              {doc.type}
              {sizeLabel ? ` · ${sizeLabel}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="file-remove"
            aria-label="Close preview"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="doc-preview-toolbar">
          {doc.sourceUrl ? (
            <a
              className="doc-preview-open-tab"
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original website
            </a>
          ) : null}
          {doc.id && !isTextPreview ? (
            <a
              className="doc-preview-open-tab"
              href={docPreviewTabHref || `/api/documents/${doc.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in new tab
            </a>
          ) : null}
        </div>
        {docPreviewSetupErr ? (
          <div className="improve-err" style={{ margin: 0 }}>
            {docPreviewSetupErr}
          </div>
        ) : (
          <p className="doc-preview-hint">
            {isTextPreview
              ? "Extracted text with markdown formatting (bold, lists, links, etc.)."
              : "PDFs and images use the built-in viewer below. PowerPoint, Word, and Excel use Microsoft's viewer"}
          </p>
        )}
        <div
          className={`doc-preview-frame-wrap${
            busy ? " doc-preview-frame-busy" : ""
          }${isTextPreview ? " doc-preview-frame-wrap--text" : ""}`}
        >
          {busy ? (
            <div className="doc-preview-frame-overlay">
              <div className="sidebar-loading" style={{ padding: 0 }}>
                <div className="mini-spinner" />{" "}
                <LoadingText active>
                  {docPreviewTokenLoading
                    ? "Preparing preview"
                    : "Loading preview"}
                </LoadingText>
              </div>
            </div>
          ) : null}
          {isTextPreview && textContent != null && !docPreviewSetupErr ? (
            <div
              className="doc-preview-markdown"
              dangerouslySetInnerHTML={{ __html: textHtml }}
            />
          ) : null}
          {!isTextPreview && docPreviewSrc && !docPreviewSetupErr ? (
            <iframe
              className="doc-preview-frame"
              title={`Preview: ${doc.name}`}
              src={docPreviewSrc}
              onLoad={onPreviewIframeLoad}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
