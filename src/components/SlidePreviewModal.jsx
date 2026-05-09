"use client";


import "./SlidePreviewModal.module.css";
import { useState, useEffect, useRef } from "react";

// ─── Icons ────────────────────────────────────────────────
const CloseIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SlidesIco = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><polygon points="10 8 16 11 10 14 10 8"/>
  </svg>
);
const DownloadIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const RefreshIco = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4.96"/>
  </svg>
);
const ChevLeftIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevRightIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ─── Slide design preview renderer ───────────────────────
function SlideDesignPreview({ slide, theme, pageNum, totalPages }) {
  const bg = theme?.background || "#0f172a";
  const accent = theme?.accent || "#6366f1";
  const textCol = theme?.text || "#f1f5f9";
  const panel = theme?.panel || "#1f2a44";

  const title = slide?.title || `Slide ${pageNum}`;
  const lines = Array.isArray(slide?.lines) ? slide.lines : [];

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16/10",
        background: bg,
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "24%", background: accent }} />

      {/* Left accent strip */}
      <div
        style={{
          position: "absolute",
          top: "16%",
          bottom: "14%",
          left: "6%",
          width: 6,
          background: "rgba(255,255,255,.12)",
          borderRadius: 6,
        }}
      />

      {/* Content panel */}
      <div
        style={{
          position: "absolute",
          left: "9%",
          right: "6%",
          top: "18%",
          bottom: "18%",
          background: panel,
          border: "1px solid rgba(255,255,255,.10)",
          borderRadius: 10,
          padding: 16,
          boxShadow: "0 14px 44px rgba(0,0,0,.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 700,
            fontSize: 20,
            color: accent,
            marginBottom: 8,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>

        <div style={{ color: textCol, fontFamily: "'Sora',sans-serif", fontSize: 13.5, lineHeight: 1.5 }}>
          {lines.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lines.slice(0, 8).map((l, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ opacity: 0.7, fontStyle: "italic" }}>(No bullet content)</div>
          )}
        </div>
      </div>

      {/* Slide number watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 14,
          fontSize: 11,
          color: "rgba(255,255,255,.42)",
          fontFamily: "'Sora',sans-serif",
          fontWeight: 600,
        }}
      >
        {pageNum} / {totalPages}
      </div>
    </div>
  );
}

// ─── Thumbnail strip item (mini slide — avoid diagonal “X” which read as crossed-out) ──
function Thumbnail({ num, active, onClick, theme }) {
  const bg = theme?.background || "#0f172a";
  const accent = theme?.accent || "#6366f1";
  const panelFill =
    theme?.panel && String(theme.panel).trim()
      ? String(theme.panel).trim()
      : "rgba(255,255,255,.1)";
  return (
    <div onClick={onClick} style={{
      flexShrink: 0, width: 52, cursor: "pointer",
      borderRadius: 5,
      border: active ? "2px solid #6366f1" : "2px solid rgba(255,255,255,.1)",
      overflow: "hidden", transition: "border-color .18s",
      boxShadow: active ? "0 0 0 3px rgba(99,102,241,.18)" : "none",
    }}>
      <div
        style={{
          aspectRatio: "16/10",
          background: bg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "18%", background: accent }} />
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "24%",
            bottom: "16%",
            background: panelFill,
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 2,
            right: 3,
            fontSize: 7,
            fontWeight: 600,
            color: "rgba(255,255,255,.55)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          {num}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function SlidePreviewModal({
  onClose,
  onGenerateAgain,
  onDownload,
  slides,
  theme,
  title,
  subtitle,
  totalPages = 20,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage,   setInputPage]   = useState("1");
  const [downloading, setDownloading] = useState(false);
  const [regenerating,setRegenerating]= useState(false);
  const thumbsRef = useRef(null);

  const slideCount = Array.isArray(slides) ? slides.length : 0;
  const totalNum = Number(totalPages);
  const effectiveTotal = Math.max(
    1,
    slideCount > 0 ? slideCount : Number.isFinite(totalNum) && totalNum > 0 ? totalNum : 1,
  );
  const activeSlide = Array.isArray(slides) ? slides[currentPage - 1] : null;

  // Keep input in sync with currentPage
  useEffect(() => { setInputPage(String(currentPage)); }, [currentPage]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const el = thumbsRef.current?.querySelector(`[data-thumb="${currentPage}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentPage]);

  function goTo(n) {
    const p = Math.max(1, Math.min(effectiveTotal, n));
    setCurrentPage(p);
  }

  function handlePageInput(e) {
    setInputPage(e.target.value);
  }
  function handlePageInputBlur() {
    const n = parseInt(inputPage);
    if (!isNaN(n)) goTo(n);
    else setInputPage(String(currentPage));
  }
  function handlePageInputKey(e) {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "ArrowLeft") goTo(currentPage - 1);
    if (e.key === "ArrowRight") goTo(currentPage + 1);
  }

  async function handleDownload() {
    if (!onDownload) return;
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  }

  async function handleGenerateAgain() {
    setRegenerating(true);
    await new Promise(r => setTimeout(r, 600));
    setRegenerating(false);
    onGenerateAgain?.();
  }

  // Keyboard navigation (functional updates so slide count changes stay in sync)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") {
        setCurrentPage((p) => Math.max(1, p - 1));
      }
      if (e.key === "ArrowRight") {
        setCurrentPage((p) => Math.min(effectiveTotal, p + 1));
      }
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveTotal, onClose]);

  return (
    <>
    

    <div className="pv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pv-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pv-head">
          <div className="pv-head-left">
            <div className="pv-title"><SlidesIco/> {String(title || "").trim() || "Preview presentation"}</div>
            <div className="pv-subtitle">{subtitle || "Review your slide design and content."}</div>
          </div>

          <div className="pv-actions">
            {onGenerateAgain ? (
              <button className="btn-again" onClick={handleGenerateAgain} disabled={regenerating}>
                {regenerating ? <div className="mini-spin"/> : <RefreshIco/>}
                Generate Again..
              </button>
            ) : null}
            {onDownload ? (
              <button className="btn-download" onClick={handleDownload} disabled={downloading}>
                {downloading ? <div className="mini-spin"/> : <DownloadIco/>}
                Download
              </button>
            ) : null}
            <button className="pv-close" onClick={onClose}><CloseIco/></button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="pv-body">

          {/* Page navigation */}
          <div className="page-nav">
            <button type="button" className="nav-btn" onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}>
              <ChevLeftIco/>
            </button>
            <div className="page-label">
              Page
              <input
                className="page-inp"
                value={inputPage}
                onChange={handlePageInput}
                onBlur={handlePageInputBlur}
                onKeyDown={handlePageInputKey}
              />
              <span className="out-of">out of {effectiveTotal}</span>
            </div>
            <button type="button" className="nav-btn" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= effectiveTotal}>
              <ChevRightIco/>
            </button>
          </div>

          {/* Slide viewer + thumbnails */}
          <div className="slide-viewer">

            {/* Thumbnail strip (left) */}
            <div className="thumb-strip" ref={thumbsRef}>
              {Array.from({ length: effectiveTotal }, (_, i) => i + 1).map(n => (
                <div key={n} data-thumb={n}>
                  <Thumbnail num={n} active={currentPage === n} onClick={() => goTo(n)} theme={theme} />
                </div>
              ))}
            </div>

            {/* Main slide + fake scrollbar */}
            <div className="slide-main-wrap">
              <div className="slide-main">
                <SlideDesignPreview
                  slide={activeSlide}
                  theme={theme}
                  pageNum={currentPage}
                  totalPages={effectiveTotal}
                />

                {String(activeSlide?.notes || "").trim() ? (
                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 8,
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.10)",
                      padding: 12,
                      maxHeight: 170,
                      overflowY: "auto",
                      fontFamily: "'Sora',sans-serif",
                      color: "rgba(255,255,255,.72)",
                      lineHeight: 1.45,
                      fontSize: 12.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <div style={{ color: "rgba(255,255,255,.92)", fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                      Speaker notes (preview)
                    </div>
                    {String(activeSlide.notes).slice(0, 2200)}
                    {String(activeSlide.notes).length > 2200 ? "…" : ""}
                  </div>
                ) : null}
              </div>

              {/* Scrollbar matching wireframe */}
              <div className="slide-scrollbar">
                <div className="scroll-track">
                  <div className="scroll-thumb" style={{
                    top: `${((currentPage - 1) / Math.max(effectiveTotal - 1, 1)) * 60}%`
                  }}/>
                </div>
              </div>
            </div>

          </div>

          {/* Keyboard hint */}
          <div className="kbd-hint">
            Use <span className="kbd">←</span><span className="kbd">→</span> arrow keys to navigate slides
          </div>

        </div>

      </div>
    </div>
    </>
  );
}