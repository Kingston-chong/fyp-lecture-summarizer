"use client";

import { CloseIcon } from "@/app/components/icons";

/**
 * In-dashboard document preview (PDF / Office viewer iframe).
 */
export default function DocumentPreviewModal({
  doc,
  onClose,
  formatBytes,
  docPreviewTabHref,
  docPreviewSrc,
  docPreviewTokenLoading,
  docPreviewIframeLoading,
  docPreviewSetupErr,
  onPreviewIframeLoad,
}) {
  if (!doc) return null;

  return (
    <div className="modal-backdrop doc-preview-backdrop" onClick={onClose}>
      <div className="modal-box doc-preview-panel" onClick={(e) => e.stopPropagation()}>
        <div className="doc-preview-head">
          <div>
            <div className="doc-preview-title">{doc.name}</div>
            <div className="doc-preview-meta">
              {doc.size
                ? `${doc.type} · ${formatBytes(doc.size)}`
                : doc.type}
            </div>
          </div>
          <button type="button" className="file-remove" aria-label="Close preview" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="doc-preview-toolbar">
          <a
            className="doc-preview-open-tab"
            href={docPreviewTabHref || `/api/documents/${doc.id}/view`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in new tab
          </a>
        </div>
        {docPreviewSetupErr ? (
          <div className="improve-err" style={{ margin: 0 }}>{docPreviewSetupErr}</div>
        ) : (
          <p className="doc-preview-hint">
            PDFs and images use the built-in viewer below. PowerPoint, Word, and Excel use Microsoft&apos;s viewer
          </p>
        )}
        <div
          className={`doc-preview-frame-wrap${
            docPreviewTokenLoading || (docPreviewSrc && docPreviewIframeLoading) ? " doc-preview-frame-busy" : ""
          }`}
        >
          {(docPreviewTokenLoading || (docPreviewSrc && docPreviewIframeLoading)) && (
            <div className="doc-preview-frame-overlay">
              <div className="sidebar-loading" style={{ padding: 0 }}>
                <div className="mini-spinner" />{" "}
                {docPreviewTokenLoading ? "Preparing preview…" : "Loading preview…"}
              </div>
            </div>
          )}
          {docPreviewSrc && !docPreviewSetupErr ? (
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
