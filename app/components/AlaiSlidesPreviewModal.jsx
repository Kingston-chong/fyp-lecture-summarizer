"use client";

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
        @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalIn   { from { opacity:0; transform:scale(.96) translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .alai-overlay {
          position: fixed; inset: 0; z-index: 1200;
          background: rgba(6,6,14,.72); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: overlayIn .2s ease;
          font-family: 'Sora', sans-serif;
        }
        .alai-modal {
          width: 100%;
          max-width: 780px;
          height: min(720px, 92vh);
          background: rgba(17,17,27,.97);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 18px;
          box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(99,102,241,.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modalIn .28s cubic-bezier(.16,1,.3,1);
        }
        .alai-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,.07);
          flex-shrink: 0;
        }
        .alai-head-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .alai-title {
          font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600;
          color: #e0e0f4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .alai-sub {
          font-size: 11.5px;
          color: rgba(255,255,255,.45);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .alai-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .alai-btn {
          height: 30px; padding: 0 12px; border-radius: 9px;
          border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05);
          font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,.75);
          cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
          transition: all .18s;
        }
        .alai-btn:hover { border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.08); }
        .alai-btn:disabled { opacity: .55; cursor: not-allowed; }
        .alai-close {
          width: 30px; height: 30px; border-radius: 9px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.65);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .alai-close:hover { background: rgba(248,113,113,.12); border-color: rgba(248,113,113,.3); color: #fca5a5; }
        .alai-body {
          flex: 1;
          min-height: 0;
          background: rgba(255,255,255,.02);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
        }
        .alai-frame {
          flex: 1;
          min-height: 0;
          position: relative;
          width: 100%;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 12px;
          background: rgba(0,0,0,.20);
          overflow: hidden;
        }
        .alai-frame iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .alai-frame.busy iframe { pointer-events: none; opacity: 0; }
        .alai-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6,6,14,.55);
          z-index: 1;
        }
        .alai-spinner {
          width: 18px; height: 18px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,.22);
          border-top-color: rgba(99,102,241,.95);
          animation: spin .7s linear infinite;
        }
        .alai-fallback {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 26px;
          color: rgba(255,255,255,.55);
          gap: 10px;
        }
        .alai-link {
          color: #a5b4fc;
          text-decoration: underline;
          word-break: break-all;
          font-size: 12px;
        }
      `}</style>

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

