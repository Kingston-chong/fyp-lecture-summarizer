"use client";

import { useState, useRef } from "react";
import SlidePreviewModal from "./SlidePreviewModal";

// ─── Icons ────────────────────────────────────────────────
const CloseIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const UploadCloudIco = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const ChevDownIco = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ChevRightIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ImageIco = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const XSmallIco = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SlidesIco = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><polygon points="10 8 16 11 10 14 10 8"/>
  </svg>
);
const EyeIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

// ─── Reusable Dropdown ────────────────────────────────────
function Dropdown({ value, onChange, options, width = 120 }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", width }}>
      <button
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%", height: 32, padding: "0 10px",
          background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 7, fontFamily: "'Sora',sans-serif", fontSize: 12,
          color: "#c0c0d8", display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", gap: 6, transition: "all .18s",
        }}
      >
        {value} <ChevDownIco/>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "rgba(22,22,34,.98)", border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 8, padding: 4, boxShadow: "0 12px 32px rgba(0,0,0,.5)",
        }}>
          {options.map(o => (
            <div key={o}
              onMouseDown={() => { onChange(o); setOpen(false); }}
              style={{
                padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                color: value === o ? "#a5b4fc" : "#b0b0cc",
                background: value === o ? "rgba(99,102,241,.18)" : "transparent",
                fontWeight: value === o ? 500 : 400,
                transition: "background .12s",
              }}
              onMouseEnter={e => { if (value !== o) e.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
              onMouseLeave={e => { if (value !== o) e.currentTarget.style.background = "transparent"; }}
            >{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────
const SectionHead = ({ children }) => (
  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ddddf0", marginBottom: 10, marginTop: 2 }}>
    {children}
  </div>
);
const FieldLabel = ({ children, style }) => (
  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", marginBottom: 6, ...style }}>
    {children}
  </div>
);
const Divider = () => (
  <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "16px 0" }}/>
);

// ─── Main Modal ───────────────────────────────────────────
export default function GenerateSlidesModal({ onClose }) {
  const imgInputRef = useRef();
  const pptxInputRef = useRef();

  const [slideTab, setSlideTab] = useState("create");

  // Image upload
  const [uploadedImages, setUploadedImages] = useState([]);
  const [tagInputs, setTagInputs] = useState({});
  const [tagDraft, setTagDraft]   = useState("");   // for the new-image slot

  // Improve existing PPT
  const [improveFile, setImproveFile] = useState(null);
  const [improveMode, setImproveMode] = useState("context");
  const [improveInstructions, setImproveInstructions] = useState("");
  const [improvePlan, setImprovePlan] = useState(null);
  const [improvePlanLoading, setImprovePlanLoading] = useState(false);
  const [improveGenLoading, setImproveGenLoading] = useState(false);
  const [improveErr, setImproveErr] = useState("");
  const [addStockImages, setAddStockImages] = useState(true);

  const [improvePreviewOpen, setImprovePreviewOpen] = useState(false);
  const [improvePreviewLoading, setImprovePreviewLoading] = useState(false);
  const [improvePreviewData, setImprovePreviewData] = useState(null);

  // Slide length & detail
  const [title,       setTitle]       = useState("");
  const [slideLength, setSlideLength] = useState("Short (summary)");
  const [maxSlides,   setMaxSlides]   = useState("");

  // AI model & processing
  const [aiModel,    setAiModel]    = useState("Gemini");
  const [strictness, setStrictness] = useState("Strict");

  // Content style
  const [textStyle,      setTextStyle]      = useState("Academic");
  const [bulletLimit,    setBulletLimit]    = useState("");
  const [highlightDefs,  setHighlightDefs]  = useState(false);
  const [boldKeywords,   setBoldKeywords]   = useState(false);

  // Slide design
  const [template,    setTemplate]    = useState("Academic");
  const [fontSize,    setFontSize]    = useState("Normal");
  const [textDensity, setTextDensity] = useState("Compact");

  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Handle image file pick
  function handleImgFiles(files) {
    const arr = Array.from(files);
    arr.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const id = Date.now() + Math.random();
        setUploadedImages(prev => [...prev, { id, name: f.name, tag: "", preview: e.target.result }]);
        setTagInputs(prev => ({ ...prev, [id]: "" }));
      };
      reader.readAsDataURL(f);
    });
  }

  function removeImage(id) {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
    setTagInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function setTag(id, val) {
    setUploadedImages(prev => prev.map(img => img.id === id ? { ...img, tag: val } : img));
  }

  function handleTagKey(id, e) {
    if (e.key === "Enter" && e.target.value.trim()) {
      setTag(id, e.target.value.trim());
    }
  }

  async function handlePreview() {
    setShowPreview(true);
  }

  async function handleCreate() {
    setGenerating(true);
    // TODO: call /api/generate-slides with all settings
    await new Promise(r => setTimeout(r, 1500));
    setGenerating(false);
    alert("Slides generation — wire up /api/generate-slides!");
  }

  async function handlePreview() {
    setPreviewing(true);
    await new Promise(r => setTimeout(r, 800));
    setPreviewing(false);
    alert("Preview Slide — coming soon!");
  }

  async function handleImprovePlan() {
    setImproveErr("");
    if (!improveFile || !improveInstructions.trim()) {
      setImproveErr("Upload a .pptx file and describe what to improve.");
      return;
    }
    setImprovePlanLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", improveFile);
      fd.append("mode", improveMode);
      fd.append("instructions", improveInstructions.trim());
      fd.append("model", aiModel);
      const res = await fetch("/api/improve-ppt/plan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan failed");
      setImprovePlan(data);
    } catch (e) {
      setImproveErr(e.message || String(e));
    } finally {
      setImprovePlanLoading(false);
    }
  }

  async function handleImproveGenerate() {
    setImproveErr("");
    if (!improvePlan?.slides?.length) {
      setImproveErr('Click "Generate plan" first.');
      return;
    }
    setImproveGenLoading(true);
    try {
      const res = await fetch("/api/improve-ppt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: improveMode,
          instructions: improveInstructions.trim(),
          model: aiModel,
          slides: improvePlan.slides,
          adjustments: improvePlan.adjustments || [],
          addStockImages,
          sourceName: improveFile?.name || "",
        }),
      });
      if (!res.ok) {
        let msg = "Generate failed";
        try {
          const err = await res.json();
          if (err?.error) msg = err.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Prefer the filename suggested by the server.
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      a.download = match?.[1] || "improved-slides.pptx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setImproveErr(e.message || String(e));
    } finally {
      setImproveGenLoading(false);
    }
  }

  async function handleImprovePreview() {
    setImproveErr("");
    if (!improvePlan?.slides?.length) {
      setImproveErr('Click "Generate plan" first.');
      return;
    }
    if (!improveInstructions.trim()) {
      setImproveErr("Describe what you want to improve.");
      return;
    }
    setImprovePreviewLoading(true);
    try {
      const res = await fetch("/api/improve-ppt/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: improveMode,
          instructions: improveInstructions.trim(),
          model: aiModel,
          slides: improvePlan.slides,
          adjustments: improvePlan.adjustments || [],
          // Preview in-browser doesn't currently render fetched images.
          addStockImages: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");

      setImprovePreviewData(data);
      setImprovePreviewOpen(true);
    } catch (e) {
      setImproveErr(e.message || String(e));
    } finally {
      setImprovePreviewLoading(false);
    }
  }

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
      @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
      @keyframes modalIn   { from { opacity:0; transform:scale(.96) translateY(14px); } to { opacity:1; transform:none; } }
      @keyframes spin      { to { transform:rotate(360deg); } }

      .sl-overlay {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(6,6,14,.72); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: overlayIn .2s ease;
        font-family: 'Sora', sans-serif;
      }
      .sl-modal {
        width: 100%; max-width: 640px; max-height: 90vh;
        background: rgba(17,17,27,.97);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 18px;
        box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(99,102,241,.08);
        display: flex; flex-direction: column;
        animation: modalIn .28s cubic-bezier(.16,1,.3,1);
        overflow: hidden;
      }

      /* header */
      .sl-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 22px 14px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        flex-shrink: 0;
      }
      .sl-title {
        font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600;
        color: #e0e0f4; display: flex; align-items: center; gap: 8px;
      }
      .sl-close {
        width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.05); color: rgba(255,255,255,.5);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .18s;
      }
      .sl-close:hover { background: rgba(248,113,113,.12); border-color: rgba(248,113,113,.3); color: #fca5a5; }

      /* scrollable body */
      .sl-body {
        overflow-y: auto; flex: 1;
        padding: 20px 22px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px;
      }
      .sl-body::-webkit-scrollbar { width: 3px; }
      .sl-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

      /* left / right columns */
      .col-left  { grid-column: 1; display: flex; flex-direction: column; gap: 0; }
      .col-right { grid-column: 2; display: flex; flex-direction: column; gap: 0; }

      /* upload zone */
      .upload-zone {
        border: 1.5px dashed rgba(99,102,241,.3); border-radius: 10px;
        background: rgba(99,102,241,.04); padding: 18px 12px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 7px; cursor: pointer; transition: all .2s; text-align: center; min-height: 100px;
        color: rgba(255,255,255,.3);
      }
      .upload-zone:hover { border-color: rgba(99,102,241,.55); background: rgba(99,102,241,.08); color: rgba(255,255,255,.5); }
      .upload-zone-text { font-size: 12px; font-weight: 400; }

      /* image strip */
      .img-strip {
        display: flex; gap: 8px; align-items: center;
        margin-top: 8px; overflow-x: auto; padding-bottom: 2px;
      }
      .img-strip::-webkit-scrollbar { height: 2px; }
      .img-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

      .img-thumb {
        flex-shrink: 0; width: 88px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04);
        display: flex; flex-direction: column; overflow: hidden; position: relative;
      }
      .img-thumb-img {
        height: 56px; display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.25); overflow: hidden;
      }
      .img-thumb-img img { width: 100%; height: 100%; object-fit: cover; }
      .img-remove {
        position: absolute; top: 4px; right: 4px; width: 16px; height: 16px;
        border-radius: 50%; background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.2);
        color: rgba(255,255,255,.8); display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: background .15s;
      }
      .img-remove:hover { background: rgba(248,113,113,.7); }
      .img-tag-input {
        background: transparent; border: none; border-top: 1px solid rgba(255,255,255,.08);
        padding: 5px 7px; font-family: 'Sora',sans-serif; font-size: 10.5px;
        color: rgba(255,255,255,.55); outline: none; width: 100%;
      }
      .img-tag-input::placeholder { color: rgba(255,255,255,.25); }
      .img-tag-badge {
        display: flex; align-items: center; gap: 4px;
        padding: 4px 7px; font-size: 10.5px; color: rgba(255,255,255,.55);
        border-top: 1px solid rgba(255,255,255,.08);
      }
      .tag-x { cursor: pointer; color: rgba(255,255,255,.35); transition: color .15s; display: flex; align-items: center; }
      .tag-x:hover { color: #fca5a5; }

      /* add-more thumb */
      .img-add {
        flex-shrink: 0; width: 88px; height: 80px; border-radius: 8px;
        border: 1.5px dashed rgba(255,255,255,.14); background: transparent;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        cursor: pointer; color: rgba(255,255,255,.25); gap: 3px;
        font-size: 10px; transition: all .18s;
      }
      .img-add:hover { border-color: rgba(99,102,241,.4); color: #a5b4fc; background: rgba(99,102,241,.06); }

      /* tag hint box (right of upload) */
      .tag-hint {
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; padding: 14px; font-size: 11.5px; font-weight: 300;
        color: rgba(255,255,255,.35); font-style: italic; line-height: 1.6;
        min-height: 100px; display: flex; align-items: center;
      }

      /* text input */
      .txt-inp {
        width: 100%; height: 34px; background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.1); border-radius: 8px;
        padding: 0 12px; font-family: 'Sora',sans-serif; font-size: 12px;
        color: #c0c0d8; outline: none; transition: border-color .2s, box-shadow .2s;
      }
      .txt-inp::placeholder { color: rgba(255,255,255,.22); }
      .txt-inp:focus { border-color: rgba(99,102,241,.4); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }

      .num-inp {
        width: 70px; height: 32px; background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.1); border-radius: 7px;
        padding: 0 10px; font-family: 'Sora',sans-serif; font-size: 12px;
        color: #c0c0d8; outline: none; transition: border-color .2s;
      }
      .num-inp:focus { border-color: rgba(99,102,241,.4); }

      /* radio group */
      .radio-group { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
      .radio-opt { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11.5px; color: rgba(255,255,255,.45); transition: color .15s; }
      .radio-opt:hover { color: rgba(255,255,255,.72); }
      .radio-opt.on { color: #a5b4fc; }
      .radio-dot {
        width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: border-color .15s;
      }
      .radio-dot.on { border-color: #6366f1; }
      .radio-dot.on::after { content:''; width:5px; height:5px; border-radius:50%; background:#6366f1; }

      /* checkbox */
      .chk-row { display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 11.5px; color: rgba(255,255,255,.42); transition: color .15s; margin-bottom: 5px; }
      .chk-row:hover { color: rgba(255,255,255,.7); }
      .chk-box {
        width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid rgba(255,255,255,.2);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        transition: all .15s; background: transparent;
      }
      .chk-box.on { background: #6366f1; border-color: #6366f1; }
      .chk-tick { color: white; font-size: 9px; line-height: 1; }

      /* footer */
      .sl-foot {
        display: flex; align-items: center; justify-content: flex-end; gap: 9px;
        padding: 14px 22px; border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
      }
      .btn-prev {
        height: 36px; padding: 0 18px; border-radius: 9px;
        border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05);
        font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 500;
        color: rgba(255,255,255,.55); cursor: pointer; display: flex; align-items: center; gap: 6px;
        transition: all .18s;
      }
      .btn-prev:hover { border-color: rgba(255,255,255,.22); color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); }
      .btn-prev:disabled { opacity: .45; cursor: not-allowed; }

      .btn-create {
        height: 36px; padding: 0 20px; border-radius: 9px; border: none;
        background: linear-gradient(135deg,#5258ee,#8b5cf6);
        font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 600;
        color: white; cursor: pointer; display: flex; align-items: center; gap: 7px;
        box-shadow: 0 4px 16px rgba(99,102,241,.35); transition: all .18s;
      }
      .btn-create:hover { box-shadow: 0 6px 22px rgba(99,102,241,.52); transform: translateY(-1px); }
      .btn-create:disabled { opacity: .5; cursor: not-allowed; transform: none; }
      .mini-spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.25); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }

      .sl-tabs { display: flex; gap: 8px; padding: 0 22px 14px; border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
      .sl-tab {
        padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.45);
        font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 500; cursor: pointer;
        transition: all .18s;
      }
      .sl-tab:hover { color: rgba(255,255,255,.75); border-color: rgba(255,255,255,.18); }
      .sl-tab.on { background: rgba(99,102,241,.2); border-color: rgba(99,102,241,.45); color: #c7d2fe; }

      .improve-wrap { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 14px; max-width: 100%; }
      .improve-area {
        width: 100%; min-height: 100px; padding: 12px 14px; border-radius: 10px;
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
        font-family: 'Sora',sans-serif; font-size: 12px; color: #c0c0d8; outline: none; resize: vertical;
      }
      .improve-area:focus { border-color: rgba(99,102,241,.4); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
      .improve-err { font-size: 11.5px; color: #fca5a5; line-height: 1.4; }
      .plan-list { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 12px 14px; max-height: 220px; overflow-y: auto; font-size: 11.5px; color: rgba(255,255,255,.65); line-height: 1.55; }
      .plan-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
      .plan-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    `}</style>

    <div className="sl-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sl-modal">

        {/* ── Header ── */}
        <div className="sl-head">
          <div className="sl-title">
            <SlidesIco/> Presentation Slides
          </div>
          <button className="sl-close" onClick={onClose}><CloseIco/></button>
        </div>

        <div className="sl-tabs">
          <button type="button" className={`sl-tab ${slideTab === "create" ? "on" : ""}`} onClick={() => setSlideTab("create")}>
            Create from summary
          </button>
          <button type="button" className={`sl-tab ${slideTab === "improve" ? "on" : ""}`} onClick={() => setSlideTab("improve")}>
            Improve existing PPT
          </button>
        </div>

        {/* ── Scrollable body (2-col grid) ── */}
        <div className="sl-body">

          {slideTab === "improve" && (
          <div className="improve-wrap">
            <SectionHead>Upload presentation</SectionHead>
            <FieldLabel>.pptx only. Legacy .ppt is not supported.</FieldLabel>
            <input ref={pptxInputRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                setImproveFile(f || null);
                setImprovePlan(null);
                e.target.value = "";
              }}/>
            <button type="button" className="upload-zone" style={{ minHeight: 72 }} onClick={() => pptxInputRef.current?.click()}>
              <UploadCloudIco/>
              <div className="upload-zone-text">
                {improveFile ? improveFile.name : "Click to select a .pptx file"}
              </div>
            </button>

            <SectionHead>Improvement type</SectionHead>
            <div className="radio-group" style={{ marginBottom: 4 }}>
              {[
                { id: "context", label: "Context (shorter text, clearer wording)" },
                { id: "style", label: "Style (colors, theme, images)" },
              ].map(({ id, label }) => (
                <label key={id} className={`radio-opt ${improveMode === id ? "on" : ""}`} onClick={() => { setImproveMode(id); setImprovePlan(null); }}>
                  <div className={`radio-dot ${improveMode === id ? "on" : ""}`}/>
                  {label}
                </label>
              ))}
            </div>

            <SectionHead>What should change?</SectionHead>
            <textarea
              className="improve-area"
              rows={4}
              placeholder={'Examples:\n• Context: "Make bullets shorter and more precise."\n• Style: "Use a green color theme and add relevant pictures."'}
              value={improveInstructions}
              onChange={e => { setImproveInstructions(e.target.value); setImprovePlan(null); }}
            />

            <SectionHead>AI model</SectionHead>
            <Dropdown value={aiModel} onChange={setAiModel} options={["ChatGPT","DeepSeek","Gemini"]} width={130}/>

            <label className="chk-row" style={{ marginTop: 8 }} onClick={() => setAddStockImages(v => !v)}>
              <div className={`chk-box ${addStockImages ? "on" : ""}`}>
                {addStockImages && <span className="chk-tick">✓</span>}
              </div>
              Add stock images when the plan asks (requires UNSPLASH_ACCESS_KEY on the server)
            </label>

            {improveErr && <div className="improve-err">{improveErr}</div>}

            {improvePlan?.adjustments?.length > 0 && (
              <>
                <SectionHead>Planned adjustments</SectionHead>
                <div className="plan-list">
                  {improvePlan.adjustments.map((adj, i) => (
                    <div key={i} className="plan-item">
                      <strong style={{ color: "#a5b4fc" }}>Slide {adj.slideIndex}</strong> ({adj.type})<br/>
                      {adj.description}
                      {adj.before && <><br/><span style={{ opacity: 0.75 }}>Before: {String(adj.before).slice(0, 200)}{String(adj.before).length > 200 ? "…" : ""}</span></>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {improvePlan && (!improvePlan.adjustments || improvePlan.adjustments.length === 0) && (
              <div className="plan-list" style={{ color: "rgba(255,255,255,.4)" }}>No specific adjustments listed — the deck may already match your request, or try different instructions.</div>
            )}
          </div>
          )}

          {slideTab === "create" && (<>
          {/* ══ LEFT COLUMN ══ */}
          <div className="col-left">

            {/* Upload images */}
            <SectionHead>Upload images</SectionHead>
            <FieldLabel>Optional, upload images to decorate slides</FieldLabel>

            {/* Drop zone */}
            <div className="upload-zone" onClick={() => imgInputRef.current?.click()}>
              <UploadCloudIco/>
              <div className="upload-zone-text">Click to Upload images here...</div>
              <input ref={imgInputRef} type="file" multiple accept="image/*" style={{ display:"none" }}
                onChange={e => { handleImgFiles(e.target.files); e.target.value=""; }}/>
            </div>

            {/* Image strip */}
            {uploadedImages.length > 0 && (
              <div className="img-strip">
                {uploadedImages.map(img => (
                  <div key={img.id} className="img-thumb">
                    <div className="img-thumb-img">
                      {img.preview
                        ? <img src={img.preview} alt={img.name}/>
                        : <ImageIco/>
                      }
                    </div>
                    {/* remove btn */}
                    <div className="img-remove" onClick={() => removeImage(img.id)}><XSmallIco/></div>
                    {/* tag: show badge if tag set, else input */}
                    {img.tag ? (
                      <div className="img-tag-badge">
                        {img.tag}
                        <span className="tag-x" onClick={() => setTag(img.id, "")}><XSmallIco/></span>
                      </div>
                    ) : (
                      <input className="img-tag-input" placeholder="enter tag.."
                        onKeyDown={e => { if (e.key==="Enter" && e.target.value.trim()) { setTag(img.id, e.target.value.trim()); e.target.value=""; } }}
                      />
                    )}
                  </div>
                ))}
                {/* add more */}
                <div className="img-add" onClick={() => imgInputRef.current?.click()}>
                  <ChevRightIco/>
                  <span>more</span>
                </div>
              </div>
            )}

            <Divider/>

            {/* Slide Length & Detail */}
            <SectionHead>Slide Length &amp; Detail</SectionHead>
            <FieldLabel>Main Title of the slide (optional, will be auto-generated if left empty):</FieldLabel>
            <input className="txt-inp" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} style={{ marginBottom:12 }}/>

            <FieldLabel>Slide length:</FieldLabel>
            <div className="radio-group" style={{ marginBottom:12 }}>
              {["Short (summary)", "Medium (lecture-ready)", "Long (detailed)"].map(opt => (
                <label key={opt} className={`radio-opt ${slideLength===opt?"on":""}`} onClick={()=>setSlideLength(opt)}>
                  <div className={`radio-dot ${slideLength===opt?"on":""}`}/>
                  {opt}
                </label>
              ))}
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <FieldLabel style={{ marginBottom:0, whiteSpace:"nowrap" }}>Max Slides Limit (optional):</FieldLabel>
              <input className="num-inp" type="number" min={1} max={100}
                placeholder="" value={maxSlides} onChange={e=>setMaxSlides(e.target.value)}/>
            </div>

            <Divider/>

            {/* Slide Design & Layout */}
            <SectionHead>Slide Design &amp; Layout Settings</SectionHead>
            <div style={{ display:"flex", gap:10, alignItems:"flex-start", flexWrap:"wrap" }}>
              <div>
                <FieldLabel>Template Selection:</FieldLabel>
                <Dropdown value={template} onChange={setTemplate} options={["Academic","Professional","Creative","Minimal","Corporate"]} width={110}/>
              </div>
              <div>
                <FieldLabel>Font Size Preferences:</FieldLabel>
                <Dropdown value={fontSize} onChange={setFontSize} options={["Small","Normal","Large"]} width={100}/>
              </div>
              <div>
                <FieldLabel>Text Density:</FieldLabel>
                <Dropdown value={textDensity} onChange={setTextDensity} options={["Compact","Balanced","Spacious"]} width={100}/>
              </div>
            </div>

          </div>{/* /col-left */}

          {/* ══ RIGHT COLUMN ══ */}
          <div className="col-right">

            {/* Tag hint box — lines up with upload zone */}
            <div style={{ marginTop: 36, marginBottom: 0 }}>
              <div className="tag-hint">
                Enter tag to make AI model able to recognize the image context.
              </div>
            </div>

            {/* spacer to align with image strip roughly */}
            <div style={{ minHeight: uploadedImages.length > 0 ? 98 : 0 }}/>

            <Divider/>

            {/* AI Model & Processing Settings */}
            <SectionHead>AI Model &amp; Processing Settings</SectionHead>

            <FieldLabel>AI Model Selection:</FieldLabel>
            <Dropdown value={aiModel} onChange={setAiModel}
              options={["ChatGPT","DeepSeek","Gemini"]} width={130}/>

            <div style={{ marginTop: 12 }}>
              <FieldLabel>Summarization Strictness:</FieldLabel>
              <Dropdown value={strictness} onChange={setStrictness}
                options={["Strict","Moderate","Loose"]} width={110}/>
            </div>

            <Divider/>

            {/* Content Style Settings */}
            <SectionHead>Content Style Settings</SectionHead>

            <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <FieldLabel>Slide Text Style:</FieldLabel>
                <Dropdown value={textStyle} onChange={setTextStyle}
                  options={["Academic","Casual","Technical","Narrative"]} width={110}/>
              </div>
              <div>
                <FieldLabel>Bullet-point Limit per Slide</FieldLabel>
                <input className="num-inp" type="number" min={1} max={20}
                  placeholder="" value={bulletLimit} onChange={e=>setBulletLimit(e.target.value)}/>
              </div>
            </div>

            <FieldLabel>Keywords Highlighting</FieldLabel>
            <label className="chk-row" onClick={()=>setHighlightDefs(v=>!v)}>
              <div className={`chk-box ${highlightDefs?"on":""}`}>
                {highlightDefs && <span className="chk-tick">✓</span>}
              </div>
              Highlight definitions
            </label>
            <label className="chk-row" onClick={()=>setBoldKeywords(v=>!v)}>
              <div className={`chk-box ${boldKeywords?"on":""}`}>
                {boldKeywords && <span className="chk-tick">✓</span>}
              </div>
              Enable bold keywords
            </label>

          </div>{/* /col-right */}
          </>)}

        </div>{/* /sl-body */}

        {/* ── Footer ── */}
        <div className="sl-foot">
          {slideTab === "improve" ? (
            <>
              <button className="btn-prev" onClick={handleImprovePlan} disabled={improvePlanLoading}>
                {improvePlanLoading ? <div className="mini-spin"/> : <EyeIco/>}
                Generate plan
              </button>
              <button
                className="btn-prev"
                onClick={handleImprovePreview}
                disabled={improvePreviewLoading || !improvePlan}
              >
                {improvePreviewLoading ? <div className="mini-spin"/> : <EyeIco/>}
                Preview slides
              </button>
              <button className="btn-create" onClick={handleImproveGenerate} disabled={improveGenLoading || !improvePlan}>
                {improveGenLoading ? <div className="mini-spin"/> : <SlidesIco/>}
                Build improved PPTX
              </button>
            </>
          ) : (
            <>
              <button className="btn-prev" onClick={handlePreview} disabled={previewing}>
                {previewing ? <div className="mini-spin"/> : <EyeIco/>}
                Preview Slide
              </button>
              <button className="btn-create" onClick={handleCreate} disabled={generating}>
                {generating ? <div className="mini-spin"/> : <SlidesIco/>}
                Create Slide
              </button>
            </>
          )}
        </div>

      </div>
    </div>

    {improvePreviewOpen && improvePreviewData && (
      <SlidePreviewModal
        onClose={() => setImprovePreviewOpen(false)}
        title={improvePreviewData.title}
        subtitle={improvePreviewData.subtitle}
        theme={improvePreviewData.theme}
        slides={improvePreviewData.slides}
        totalPages={improvePreviewData.slides?.length || 0}
      />
    )}
    </>
  );
}