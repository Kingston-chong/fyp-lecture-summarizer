"use client";


import "./AlaiSlidesPreviewModal.module.css";
import { useEffect, useState } from "react";

const CloseIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const DownloadIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

function officeEmbedSrc(pptUrl) {
  if (!pptUrl) return "";
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pptUrl)}`;
}

function officeViewSrc(pptUrl) {
  if (!pptUrl) return "";
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(pptUrl)}`;
}

export default function AlaiSlidesPreviewModal({
  onClose,
  onDownload,
  previewUrl,
  /** Signed PPTX URL from Alai — used when there is no link/pdf preview */
  remotePptUrl = "",
  title = "Create Presentation Slides...",
  subtitle = "Your presentation slides is ready..",
}) {
  const [downloading, setDownloading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Prefer Office Online embed for the PPTX when we have a signed URL. Alai's own
  // preview iframe includes an "exit" that navigates to Alai login, which is
  // confusing inside our app; Office viewer does not.
  const iframeSrc = remotePptUrl
    ? officeEmbedSrc(remotePptUrl)
    : previewUrl || "";
  const openInTabHref = remotePptUrl
    ? officeViewSrc(remotePptUrl) || remotePptUrl
    : previewUrl || officeViewSrc(remotePptUrl) || remotePptUrl;

  useEffect(() => {
    setIframeLoading(Boolean(iframeSrc));
  }, [iframeSrc]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleDownload() {
    if (!onDownload) return;
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      

      <div className="alai-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="alai-modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="alai-head">
            <div className="alai-head-left">
              <div className="alai-title">{title}</div>
              <div className="alai-sub">{subtitle}</div>
            </div>
            <div className="alai-actions">
              <button className="alai-btn" onClick={handleDownload} disabled={!onDownload || downloading}>
                <DownloadIco />
                {downloading ? "Downloading..." : "Download Slide"}
              </button>
              <button className="alai-close" onClick={onClose}><CloseIco /></button>
            </div>
          </div>

          <div className="alai-body">
            <div className={`alai-frame${iframeLoading ? " busy" : ""}`}>
              {iframeSrc && iframeLoading ? (
                <div className="alai-loading" aria-label="Loading preview">
                  <div className="alai-spinner" />
                </div>
              ) : null}
              {iframeSrc ? (
                <iframe
                  src={iframeSrc}
                  title="Alai slide preview"
                  allow="clipboard-read; clipboard-write; fullscreen *"
                  allowFullScreen
                  onLoad={() => {
                    // Office viewer often becomes interactive slightly after onLoad.
                    setTimeout(() => setIframeLoading(false), 650);
                  }}
                />
              ) : (
                <div className="alai-fallback">
                  <div style={{ fontWeight: 600, color: "#ddddf0" }}>Preview link not available</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    You can still download the PPTX, or open the presentation in Alai.
                  </div>
                </div>
              )}
            </div>
            {openInTabHref && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: "rgba(255,255,255,.45)" }}>
                If the embed is blocked, open in a new tab:
                {" "}
                <a className="alai-link" href={openInTabHref} target="_blank" rel="noreferrer">
                  {openInTabHref}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

