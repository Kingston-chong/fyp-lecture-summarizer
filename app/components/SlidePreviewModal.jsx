"use client";

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
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
      @keyframes overlayIn { from{opacity:0} to{opacity:1} }
      @keyframes modalIn   { from{opacity:0;transform:scale(.95) translateY(16px)} to{opacity:1;transform:none} }
      @keyframes spin      { to{transform:rotate(360deg)} }
      @keyframes fadeIn    { from{opacity:0} to{opacity:1} }

      .pv-overlay {
        position: fixed; inset: 0; z-index: 1100;
        background: rgba(6,6,14,.75); backdrop-filter: blur(7px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: overlayIn .2s ease;
        font-family: 'Sora', sans-serif;
      }
      .pv-modal {
        width: 100%; max-width: 680px; max-height: 92vh;
        background: rgba(16,16,26,.98);
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 20px;
        box-shadow: 0 40px 90px rgba(0,0,0,.75), 0 0 0 1px rgba(99,102,241,.07);
        display: flex; flex-direction: column;
        animation: modalIn .3s cubic-bezier(.16,1,.3,1);
        overflow: hidden;
      }

      /* ── header ── */
      .pv-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 14px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        flex-shrink: 0; gap: 12px;
      }
      .pv-head-left { display: flex; flex-direction: column; gap: 3px; }
      .pv-title {
        font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600;
        color: #e0e0f4; display: flex; align-items: center; gap: 8px;
      }
      .pv-subtitle { font-size: 11.5px; color: rgba(255,255,255,.38); }
      .pv-actions { display: flex; align-items: center; gap: 8px; }

      .btn-again {
        height: 34px; padding: 0 15px; border-radius: 9px;
        border: 1px solid rgba(255,255,255,.13); background: rgba(255,255,255,.06);
        font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 500;
        color: rgba(255,255,255,.6); cursor: pointer;
        display: flex; align-items: center; gap: 6px; transition: all .18s; white-space: nowrap;
      }
      .btn-again:hover { border-color: rgba(255,255,255,.24); color: rgba(255,255,255,.9); background: rgba(255,255,255,.1); }
      .btn-again:disabled { opacity: .45; cursor: not-allowed; }

      .btn-download {
        height: 34px; padding: 0 17px; border-radius: 9px; border: none;
        background: linear-gradient(135deg,#5258ee,#8b5cf6);
        font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 600;
        color: white; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        box-shadow: 0 4px 14px rgba(99,102,241,.35); transition: all .18s; white-space: nowrap;
      }
      .btn-download:hover { box-shadow: 0 6px 20px rgba(99,102,241,.55); transform: translateY(-1px); }
      .btn-download:disabled { opacity: .5; cursor: not-allowed; transform: none; }

      .pv-close {
        width: 28px; height: 28px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.45); display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .18s; flex-shrink: 0;
      }
      .pv-close:hover { background: rgba(248,113,113,.12); border-color: rgba(248,113,113,.3); color: #fca5a5; }

      /* ── body ── */
      .pv-body {
        flex: 1; overflow-y: auto; display: flex; flex-direction: column;
        padding: 18px 20px; gap: 16px; min-height: 0;
      }
      .pv-body::-webkit-scrollbar { width: 3px; }
      .pv-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

      /* ── page nav row ── */
      .page-nav {
        display: flex; align-items: center; justify-content: center; gap: 10px; flex-shrink: 0;
      }
      .nav-btn {
        width: 30px; height: 30px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.5); display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .18s;
      }
      .nav-btn:hover:not(:disabled) { border-color: rgba(99,102,241,.4); color: #a5b4fc; background: rgba(99,102,241,.1); }
      .nav-btn:disabled { opacity: .3; cursor: not-allowed; }

      .page-label {
        display: flex; align-items: center; gap: 7px;
        font-size: 13px; color: rgba(255,255,255,.55); font-weight: 400;
      }
      .page-inp {
        width: 40px; height: 30px; border-radius: 7px; text-align: center;
        background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
        font-family: 'Sora',sans-serif; font-size: 13px; font-weight: 600;
        color: #ddddf0; outline: none; transition: border-color .18s;
      }
      .page-inp:focus { border-color: rgba(99,102,241,.5); box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
      .out-of { font-size: 13px; color: rgba(255,255,255,.4); }

      /* ── slide viewer ── */
      .slide-viewer {
        flex: 1; display: flex; gap: 14px; min-height: 0; align-items: flex-start;
      }

      /* main slide + scrollbar wrapper */
      .slide-main-wrap {
        flex: 1; display: flex; gap: 0; min-width: 0;
        border: 1px solid rgba(255,255,255,.1); border-radius: 8px; overflow: hidden;
        background: rgba(255,255,255,.97);
        box-shadow: 0 8px 32px rgba(0,0,0,.4);
      }
      .slide-main {
        flex: 1; animation: fadeIn .2s ease;
      }

      /* fake scrollbar matching wireframe */
      .slide-scrollbar {
        width: 12px; background: rgba(200,200,210,.15); flex-shrink: 0;
        display: flex; flex-direction: column; padding: 2px 2px;
        border-left: 1px solid rgba(0,0,0,.08);
      }
      .scroll-track {
        flex: 1; position: relative; border-radius: 4px;
      }
      .scroll-thumb {
        position: absolute; top: 0; left: 0; right: 0;
        height: 40%; border-radius: 4px;
        background: rgba(120,120,140,.55);
        transition: top .2s ease;
      }

      /* thumbnail strip */
      .thumb-strip {
        width: 68px; flex-shrink: 0; display: flex; flex-direction: column;
        gap: 6px; overflow-y: auto; max-height: 420px;
        padding-right: 2px;
      }
      .thumb-strip::-webkit-scrollbar { width: 2px; }
      .thumb-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

      .mini-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.25); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }

      /* keyboard hint */
      .kbd-hint {
        text-align: center; font-size: 10.5px; color: rgba(255,255,255,.2);
        flex-shrink: 0;
      }
      .kbd { display: inline-block; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.05); font-size: 10px; margin: 0 2px; }
    `}</style>

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