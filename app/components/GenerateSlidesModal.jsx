"use client";

import { useState, useRef, useEffect } from "react";
import AlaiSlidesPreviewModal from "./AlaiSlidesPreviewModal";
import { useTheme } from "./ThemeProvider.jsx";
import {
  CloseIco,
  Divider,
  Dropdown,
  FieldLabel,
  SectionHead,
  SlidesIco,
  UploadCloudIco,
} from "./generateSlides/ui.jsx";
import CreateSlidesForm from "./generateSlides/CreateSlidesForm.jsx";

// ─── Main Modal ───────────────────────────────────────────
export default function GenerateSlidesModal({
  onClose,
  summaryText = "",
  summarizeFor = "student",
  /** When set, completed Alai decks are archived for this summary */
  summaryId = null,
  /** Called after a deck is successfully saved to the server (e.g. refresh sidebar) */
  onSlideDecksChanged = null,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pptxInputRef = useRef();
  /** Latest download action for the open Alai preview (fresh proxy vs saved blob) */
  const slideDownloadRef = useRef(null);

  // Improve existing PPT
  const [improveFile, setImproveFile] = useState(null);
  const [improveInstructions, setImproveInstructions] = useState("");
  /** Parsed slide list from /api/improve-ppt/parse (no LLM). */
  const [parsedSlides, setParsedSlides] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  /** Background LLM plan adjustments from /api/improve-ppt/plan (JSON). */
  const [planAdjustments, setPlanAdjustments] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const parseRequestIdRef = useRef(0);
  const [improveGenLoading, setImproveGenLoading] = useState(false);
  const [improveErr, setImproveErr] = useState("");
  const [addStockImages, setAddStockImages] = useState(true);
  /** When true (default), use neutral theme, skip extra cover slide, and prompt for additive changes */
  const [additiveImprove, setAdditiveImprove] = useState(true);
  const [improveDetailLevel, setImproveDetailLevel] = useState("lecture");
  const [improveImgQuery, setImproveImgQuery] = useState("");
  const [improveImgSearchLoading, setImproveImgSearchLoading] = useState(false);
  const [improveImgResults, setImproveImgResults] = useState([]);
  const [improveImgSearchHint, setImproveImgSearchHint] = useState("");
  /** "unsplash" | "none" | null (unknown) */
  const [improveImageProvider, setImproveImageProvider] = useState(null);
  const [improveTargetSlide, setImproveTargetSlide] = useState(1);
  /** @type {{ slideIndex: number; url: string; thumb?: string }[]} */
  const [pickedUserImages, setPickedUserImages] = useState([]);
  const [improvePasteUrl, setImprovePasteUrl] = useState("");
  // slide theme finder
  // 2slides theme search
  const [themeQuery, setThemeQuery] = useState("");
  const [themeSearchLoading, setThemeSearchLoading] = useState(false);
  const [themeResults, setThemeResults] = useState([]); // each item now includes templateSpec
  /** `q` that produced the current `themeResults` (used so spec fetch matches list order) */
  const [themeResultsQuery, setThemeResultsQuery] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [selectedTemplateSpec, setSelectedTemplateSpec] = useState(null);
  const [themeSearchErr, setThemeSearchErr] = useState("");
  // Slide length & detail
  const [title, setTitle] = useState("");
  const [slideUserPrompt, setSlideUserPrompt] = useState("");
  const [slideLength, setSlideLength] = useState("Short (summary)");
  const [maxSlides, setMaxSlides] = useState("");

  // AI model & processing
  const [aiModel, setAiModel] = useState("Gemini");
  const [strictness, setStrictness] = useState("Strict");

  // Content style
  const [textStyle, setTextStyle] = useState("Academic");
  const [bulletLimit, setBulletLimit] = useState("");
  const [highlightDefs, setHighlightDefs] = useState(false);
  const [boldKeywords, setBoldKeywords] = useState(false);

  // Slide design
  const [template, setTemplate] = useState("Academic");
  const [fontSize, setFontSize] = useState("Normal");
  const [textDensity, setTextDensity] = useState("Compact");

  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState("");
  const [generateProgress, setGenerateProgress] = useState("");
  const [alaiPreviewOpen, setAlaiPreviewOpen] = useState(false);
  const [alaiPreviewUrl, setAlaiPreviewUrl] = useState("");
  const [alaiDownloadUrl, setAlaiDownloadUrl] = useState("");
  /** Alai signed PPTX URL — used for Office Web Viewer when no link preview exists */
  const [alaiRemotePptUrl, setAlaiRemotePptUrl] = useState("");
  const [lastGenerationId, setLastGenerationId] = useState("");
  const [archiveNote, setArchiveNote] = useState("");
  const quickRequestsRef = useRef(null);

  const quickInstructionPresets = [
    "Make the deck exam-focused: include key definitions and likely test points.",
    "Keep slides concise: max 5 bullets per slide and short phrases only.",
    "Add one simple worked example after each major concept.",
    "Use beginner-friendly wording and avoid heavy jargon.",
    "End with a recap slide plus 5 review questions.",
  ];

  function applyQuickInstruction(text) {
    setSlideUserPrompt((prev) => {
      const next = prev.trim() ? `${prev.trim()}\n- ${text}` : `- ${text}`;
      return next.slice(0, 4000);
    });
  }

  function scrollQuickRequests(direction) {
    const el = quickRequestsRef.current;
    if (!el) return;
    const amount = Math.max(180, Math.floor(el.clientWidth * 0.6));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  function setFreshSlideDownload(pollData) {
    const dl = pollData.download_url;
    if (!dl) {
      slideDownloadRef.current = null;
      return;
    }
    const t = title || "presentation";
    slideDownloadRef.current = async () => {
      const dlRes = await fetch(`${dl}?title=${encodeURIComponent(t)}`);
      if (!dlRes.ok) throw new Error("Failed to download presentation file");
      const blob = await dlRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName =
        t.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "presentation";
      a.download = `${fileName}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  async function saveDeckToArchive({
    generationId,
    remotePptxUrl,
    deckTitle,
  } = {}) {
    if (!summaryId) {
      setArchiveNote(
        "Generated successfully, but this deck is not attached to a summary so it will not be saved to Slide decks.",
      );
      setTimeout(() => setArchiveNote(""), 8000);
      return false;
    }

    const genId = String(generationId || lastGenerationId || "").trim();
    if (!genId) {
      setArchiveNote(
        "No generation id found. Please regenerate slides before saving to Slide decks.",
      );
      setTimeout(() => setArchiveNote(""), 8000);
      return false;
    }

    setArchiveNote("Saving a copy to your account…");
    try {
      const ar = await fetch(`/api/summary/${summaryId}/slide-decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alaiGenerationId: genId,
          title: String(deckTitle || title || "").trim() || undefined,
          remotePptxUrl: String(remotePptxUrl || alaiRemotePptUrl || "").trim() || undefined,
        }),
      });
      const aj = await ar.json().catch(() => ({}));
      if (ar.ok) {
        setArchiveNote(
          "Saved — open “Slide decks” in the right sidebar to preview or download later.",
        );
        onSlideDecksChanged?.();
        return true;
      }
      setArchiveNote(
        aj?.error
          ? `Could not save copy: ${aj.error}`
          : "Could not save a copy (download still works).",
      );
      return false;
    } catch {
      setArchiveNote("Could not save a copy (download still works).");
      return false;
    } finally {
      setTimeout(() => setArchiveNote(""), 8000);
    }
  }

  function addPickedImageFromUrl(url, thumb) {
    const u = String(url || "").trim();
    if (!u.startsWith("http")) return;
    const maxSlide = parsedSlides?.length || 1;
    const slideIndex = Math.max(
      1,
      Math.min(Number(improveTargetSlide) || 1, maxSlide),
    );
    setPickedUserImages((prev) => {
      const without = prev.filter((p) => p.slideIndex !== slideIndex);
      const merged = [...without, { slideIndex, url: u, thumb: thumb || u }];
      if (merged.length > 10) return prev;
      return merged;
    });
  }

  function removePickedImage(slideIndex) {
    setPickedUserImages((prev) =>
      prev.filter((p) => p.slideIndex !== slideIndex),
    );
  }
  async function handleThemeSearch() {
    const q = themeQuery.trim();
    if (!q) return;
    setThemeSearchLoading(true);
    setThemeSearchErr("");
    setThemeResults([]);
    setThemeResultsQuery("");
    setSelectedTemplateSpec(null);
    try {
      const res = await fetch(
        `/api/improve-ppt/theme-search?q=${encodeURIComponent(q)}&model=${encodeURIComponent(aiModel)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Theme search failed");
      const themes = Array.isArray(data.themes) ? data.themes : [];
      // Attach the top result's templateSpec to the first theme entry
      // (others will be fetched individually on click)
      if (themes.length > 0 && data.templateSpec) {
        themes[0]._templateSpec = data.templateSpec;
      }
      setThemeResults(themes);
      setThemeResultsQuery(q);
      setSelectedThemeId(themes[0]?.id ?? null);
      if (data.templateSpec) setSelectedTemplateSpec(data.templateSpec);
    } catch (e) {
      setThemeSearchErr(e?.message || String(e));
    } finally {
      setThemeSearchLoading(false);
    }
  }

  async function handleImproveImageSearch() {
    const q = improveImgQuery.trim();
    if (!q) return;
    setImproveImgSearchLoading(true);
    setImproveImgSearchHint("");
    setImproveImgResults([]);
    try {
      const res = await fetch(
        `/api/improve-ppt/image-search?q=${encodeURIComponent(q.slice(0, 200))}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Search failed");
      setImproveImgResults(Array.isArray(data.items) ? data.items : []);
      setImproveImgSearchHint(String(data.hint || "").trim());
      if (data.provider) setImproveImageProvider(data.provider);
    } catch (e) {
      setImproveImgSearchHint(e?.message || String(e));
    } finally {
      setImproveImgSearchLoading(false);
    }
  }

  useEffect(() => {
    if (!parsedSlides?.length) {
      setImproveImageProvider(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/improve-ppt/image-search");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.provider)
          setImproveImageProvider(data.provider);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsedSlides]);

  useEffect(() => {
    // Planning is now on-demand (Build click), so invalidate old plan output on edits.
    setPlanAdjustments([]);
    setPlanError("");
  }, [improveInstructions, aiModel]);

  async function runImprovePlanNow() {
    if (!parsedSlides?.length || !improveInstructions.trim()) return [];
    setPlanLoading(true);
    setPlanError("");
    try {
      const res = await fetch("/api/improve-ppt/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: parsedSlides,
          instructions: improveInstructions.trim(),
          model: aiModel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Planning failed");
      const adj = Array.isArray(data.adjustments) ? data.adjustments : [];
      setPlanAdjustments(adj);
      return adj;
    } catch (e) {
      setPlanError(e?.message || String(e));
      setPlanAdjustments([]);
      return [];
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleCreate() {
    setGenerateErr("");
    setGenerateProgress("");
    setGenerating(true);
    setLastGenerationId("");
    setAlaiRemotePptUrl("");
    setArchiveNote("");

    try {
      const res = await fetch("/api/generate-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryText,
          summarizeFor,
          title,
          slideUserPrompt: slideUserPrompt.trim().slice(0, 4000),
          slideLength,
          maxSlides,
          template,
          textStyle,
          strictness,
          aiModel,
          highlightDefs,
          boldKeywords,
          bulletLimit: String(bulletLimit || "").trim() || undefined,
          fontSize,
          textDensity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      const genId = data.generation_id;
      if (!genId) throw new Error("No generation ID returned");
      setLastGenerationId(String(genId));

      /** Alai often sets `completed` before `formats.ppt` is populated — keep polling. */
      let exportWaitAttempts = 0;
      const MAX_EXPORT_WAIT_ATTEMPTS = 60;

      // Poll for completion (check immediately, then every 3s)
      while (true) {
        const pollRes = await fetch(`/api/generate-slides/${genId}`);
        const pollData = await pollRes.json();

        if (!pollRes.ok) {
          throw new Error(pollData.error || "Failed to check status");
        }

        if (pollData.status === "failed") {
          throw new Error(
            pollData.error || "Slide generation failed on the server.",
          );
        }

        const hasArtifact =
          !!(
            pollData.preview_url ||
            pollData.download_url ||
            pollData.remote_download_url
          );

        if (pollData.status === "completed" && hasArtifact) {
          setGenerateProgress("Ready — opening preview...");
          setAlaiPreviewUrl(pollData.preview_url || "");
          setAlaiDownloadUrl(pollData.download_url || "");
          setAlaiRemotePptUrl(pollData.remote_download_url || "");
          setFreshSlideDownload(pollData);
          setAlaiPreviewOpen(true);

          void saveDeckToArchive({
            generationId: String(genId),
            remotePptxUrl: pollData.remote_download_url || "",
            deckTitle: title.trim() || undefined,
          });
          break;
        }

        if (pollData.status === "completed" && !hasArtifact) {
          exportWaitAttempts++;
          if (exportWaitAttempts > MAX_EXPORT_WAIT_ATTEMPTS) {
            throw new Error(
              pollData.error ||
                "Slide generation completed but no preview/download link was provided.",
            );
          }
          setGenerateProgress(
            String(pollData.error || "").trim() || "Waiting for PPTX export…",
          );
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        setGenerateProgress(`Status: ${pollData.status}...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {
      setGenerateErr(e.message || String(e));
    } finally {
      setGenerating(false);
      setGenerateProgress("");
    }
  }

  async function handleImproveGenerate() {
    setImproveErr("");
    if (!parsedSlides?.length) {
      setImproveErr(
        "Upload a .pptx file and wait until slides finish loading.",
      );
      return;
    }
    if (!improveInstructions.trim()) {
      setImproveErr("Describe what you want to improve.");
      return;
    }
    setImproveGenLoading(true);
    try {
      // Plan starts only when Build is clicked, then generation follows.
      const adjustmentsForBuild = await runImprovePlanNow();
      const payload = {
        instructions: improveInstructions.trim(),
        model: aiModel,
        slides: parsedSlides,
        adjustments: adjustmentsForBuild,
        addStockImages,
        sourceName: improveFile?.name || "",
        additiveImprove,
        detailLevel: improveDetailLevel,
        themeId: selectedThemeId || undefined,
        templateSpec: selectedTemplateSpec ?? undefined,
        userImageRefs: pickedUserImages.map((p) => ({
          slideIndex: p.slideIndex,
          url: p.url,
        })),
      };
      const fd = new FormData();
      if (improveFile) fd.append("file", improveFile);
      fd.append("payload", JSON.stringify(payload));
      const res = await fetch("/api/improve-ppt/generate", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let msg = "Generate failed";
        try {
          const err = await res.json();
          if (err?.error) msg = err.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const pptxBlob = await res.blob();
      const url = URL.createObjectURL(pptxBlob);
      const a = document.createElement("a");
      a.href = url;

      // Prefer the filename suggested by the server.
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const downloadName = match?.[1] || "improved-slides.pptx";
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);

      if (summaryId) {
        try {
          const saveTitle =
            String(improveFile?.name || "")
              .replace(/\.pptx$/i, "")
              .trim() ||
            title.trim() ||
            "Improved slides";
          const fd = new FormData();
          fd.append("file", pptxBlob, downloadName);
          fd.append("title", saveTitle.slice(0, 512));
          const ar = await fetch(
            `/api/summary/${summaryId}/slide-decks/upload`,
            { method: "POST", body: fd },
          );
          const aj = await ar.json().catch(() => ({}));
          if (ar.ok) {
            onSlideDecksChanged?.();
          } else if (aj?.error) {
            setImproveErr(
              `Could not save a copy to Slide decks: ${aj.error} (file was still downloaded).`,
            );
          }
        } catch {
          /* optional archive failed; download already succeeded */
        }
      }
    } catch (e) {
      setImproveErr(e.message || String(e));
    } finally {
      setImproveGenLoading(false);
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

      .improve-img-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
        gap: 6px; margin-bottom: 10px; max-height: 200px; overflow-y: auto;
      }
      .improve-img-hit {
        padding: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 8px;
        overflow: hidden; cursor: pointer; background: rgba(0,0,0,.25);
        aspect-ratio: 1; transition: border-color .15s, transform .12s;
      }
      .improve-img-hit:hover { border-color: rgba(99,102,241,.55); transform: scale(1.02); }
      .improve-img-hit img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .improve-picked-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .improve-picked-chip {
        display: inline-flex; align-items: center; gap: 6px; font-size: 11px;
        padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06); color: rgba(255,255,255,.65);
      }
      .improve-picked-thumb { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; }
      .improve-picked-x {
        border: none; background: transparent; color: rgba(255,255,255,.45);
        cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px;
      }
      .improve-picked-x:hover { color: #fca5a5; }

      .improve-image-panel {
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.03);
      }

      .tag-hint {
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
        border-radius: 10px; padding: 14px; font-size: 11.5px; font-weight: 300;
        color: rgba(255,255,255,.35); font-style: italic; line-height: 1.6;
        min-height: 56px; display: flex; align-items: center;
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
      .sl-foot .btn-create:only-of-type { flex: 1; justify-content: center; max-width: 100%; }
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
      .improve-search-hint { font-size: 11px; color: rgba(255,255,255,.42); line-height: 1.4; }
      .plan-list { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 12px 14px; max-height: 220px; overflow-y: auto; font-size: 11.5px; color: rgba(255,255,255,.65); line-height: 1.55; }
      .plan-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
      .plan-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }

      .create-prompt-row { grid-column: 1 / -1; margin-bottom: 4px; }
      .create-prompt-area {
        width: 100%; min-height: 88px; max-height: 200px; padding: 12px 14px; border-radius: 10px;
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
        font-family: 'Sora',sans-serif; font-size: 12px; color: #c0c0d8; outline: none; resize: vertical;
        line-height: 1.5;
      }
      .create-prompt-area::placeholder { color: rgba(255,255,255,.28); }
      .create-prompt-area:focus { border-color: rgba(99,102,241,.4); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
      .create-prompt-hint { font-size: 10.5px; color: rgba(255,255,255,.32); margin-top: 6px; }
      .quick-requests-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0 10px;
      }
      .quick-requests {
        display: flex;
        flex-wrap: nowrap;
        gap: 7px;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 4px;
        scrollbar-width: none;
        flex: 1;
        -ms-overflow-style: none;
      }
      .quick-requests::-webkit-scrollbar { display: none; }
      .quick-request-chip {
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.72);
        border-radius: 999px;
        padding: 6px 10px;
        font-family: 'Sora',sans-serif;
        font-size: 11px;
        line-height: 1.2;
        cursor: pointer;
        transition: all .15s;
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .quick-request-chip:hover {
        border-color: rgba(99,102,241,.45);
        background: rgba(99,102,241,.16);
        color: #c7d2fe;
      }
      .quick-requests-nav {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: none;
        background: rgba(255,255,255,.1);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: rgba(255,255,255,.75);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        transition: all .15s;
        flex: 0 0 auto;
      }
      .quick-requests-nav:hover {
        background: rgba(99,102,241,.18);
        color: #c7d2fe;
      }
      .archive-note { font-size: 11px; color: #a5b4fc; margin-top: 10px; line-height: 1.4; }

      .slides-modal-light.sl-overlay {
        background: rgba(15, 18, 30, 0.42);
        backdrop-filter: blur(8px);
      }
      .slides-modal-light .sl-modal {
        background: #f8f9fc;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(99, 102, 241, 0.08);
      }
      .slides-modal-light .sl-head,
      .slides-modal-light .sl-tabs,
      .slides-modal-light .sl-foot {
        border-color: rgba(0, 0, 0, 0.08);
      }
      .slides-modal-light .sl-title { color: #1e1b4b; }
      .slides-modal-light .sl-close {
        border-color: rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.5);
      }
      .slides-modal-light .sl-close:hover {
        background: rgba(248, 113, 113, 0.12);
        border-color: rgba(248, 113, 113, 0.35);
        color: #b91c1c;
      }
      .slides-modal-light .sl-tab {
        border-color: rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.6);
      }
      .slides-modal-light .sl-tab:hover { color: rgba(0, 0, 0, 0.88); }
      .slides-modal-light .sl-tab.on {
        background: rgba(99, 102, 241, 0.16);
        border-color: rgba(99, 102, 241, 0.35);
        color: #4338ca;
      }
      .slides-modal-light .upload-zone {
        border-color: rgba(99, 102, 241, 0.28);
        background: rgba(99, 102, 241, 0.05);
        color: rgba(0, 0, 0, 0.5);
      }
      .slides-modal-light .upload-zone:hover { color: rgba(0, 0, 0, 0.78); }
      .slides-modal-light .txt-inp,
      .slides-modal-light .num-inp,
      .slides-modal-light .improve-area,
      .slides-modal-light .create-prompt-area {
        background: #fff;
        border-color: rgba(0, 0, 0, 0.14);
        color: #111827;
      }
      .slides-modal-light .txt-inp::placeholder,
      .slides-modal-light .create-prompt-area::placeholder { color: rgba(0, 0, 0, 0.4); }
      .slides-modal-light .plan-list,
      .slides-modal-light .tag-hint {
        background: rgba(0, 0, 0, 0.03);
        border-color: rgba(0, 0, 0, 0.1);
        color: rgba(0, 0, 0, 0.7);
      }
      .slides-modal-light .improve-img-hit {
        border-color: rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
      }
      .slides-modal-light .improve-picked-chip {
        border-color: rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.75);
      }
      .slides-modal-light .improve-image-panel {
        border-color: rgba(0, 0, 0, 0.1);
        background: rgba(99, 102, 241, 0.06);
      }
      .slides-modal-light .radio-opt,
      .slides-modal-light .chk-row { color: rgba(0, 0, 0, 0.58); }
      .slides-modal-light .radio-opt:hover,
      .slides-modal-light .chk-row:hover { color: rgba(0, 0, 0, 0.88); }
      .slides-modal-light .radio-dot,
      .slides-modal-light .chk-box { border-color: rgba(0, 0, 0, 0.22); }
      .slides-modal-light .btn-prev {
        border-color: rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
        color: rgba(0, 0, 0, 0.6);
      }
      .slides-modal-light .btn-prev:hover {
        border-color: rgba(0, 0, 0, 0.2);
        color: rgba(0, 0, 0, 0.88);
        background: rgba(0, 0, 0, 0.06);
      }
      .slides-modal-light .archive-note { color: #4338ca; }
      .slides-modal-light .quick-request-chip {
        border-color: rgba(0,0,0,.12);
        background: rgba(0,0,0,.03);
        color: rgba(0,0,0,.68);
      }
      .slides-modal-light .quick-request-chip:hover {
        border-color: rgba(99,102,241,.42);
        background: rgba(99,102,241,.12);
        color: #3730a3;
      }
      .slides-modal-light .quick-requests-nav {
        border: none;
        background: rgba(255,255,255,.42);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: rgba(0,0,0,.68);
      }
      .slides-modal-light .quick-requests-nav:hover {
        background: rgba(99,102,241,.12);
        color: #3730a3;
      }
      .slides-modal-light .quick-requests::-webkit-scrollbar {
        display: none;
      }
      .slides-modal-light .improve-search-hint { color: rgba(0, 0, 0, 0.55); }

      @media (max-width: 900px) {
        .sl-overlay {
          align-items: flex-start;
          padding: 10px;
        }
        .sl-modal {
          max-width: 100%;
          max-height: calc(100vh - 20px);
          border-radius: 14px;
        }
        .sl-head {
          padding: 14px 14px 12px;
        }
        .sl-tabs {
          padding: 0 14px 12px;
          overflow-x: auto;
          scrollbar-width: thin;
        }
        .sl-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px;
        }
        .col-left,
        .col-right,
        .improve-wrap,
        .create-prompt-row {
          width: 100%;
        }
        .col-right {
          margin-top: 0;
        }
        .sl-foot {
          padding: 12px 14px;
          justify-content: stretch;
          flex-wrap: wrap;
        }
        .sl-foot .btn-prev,
        .sl-foot .btn-create {
          flex: 1 1 100%;
          justify-content: center;
        }
      }
    `}</style>

      <div
        className={`sl-overlay${isDark ? "" : " slides-modal-light"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sl-modal">
          {/* ── Header ── */}
          <div className="sl-head">
            <div className="sl-title">
              <SlidesIco /> Presentation Slides
            </div>
            <button className="sl-close" onClick={onClose}>
              <CloseIco />
            </button>
          </div>

          {/* ── Scrollable body (2-col grid) ── */}
          <div className="sl-body">
            {false && (
              <div className="improve-wrap">
                <SectionHead>Upload presentation</SectionHead>
                <FieldLabel>
                  .pptx only. Legacy .ppt is not supported.
                </FieldLabel>
                <input
                  ref={pptxInputRef}
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setImproveFile(f || null);
                    setParsedSlides(null);
                    setPlanAdjustments([]);
                    setPlanError("");
                    setPickedUserImages([]);
                    setImproveTargetSlide(1);
                    setImproveImgResults([]);
                    setImproveImgSearchHint("");
                    e.target.value = "";
                    if (!f) return;
                    const reqId = ++parseRequestIdRef.current;
                    setParseLoading(true);
                    setImproveErr("");
                    void (async () => {
                      try {
                        const fd = new FormData();
                        fd.append("file", f);
                        const res = await fetch("/api/improve-ppt/parse", {
                          method: "POST",
                          body: fd,
                        });
                        const data = await res.json().catch(() => ({}));
                        if (reqId !== parseRequestIdRef.current) return;
                        if (!res.ok)
                          throw new Error(
                            data.error || "Could not read slides",
                          );
                        setParsedSlides(
                          Array.isArray(data.slides) ? data.slides : [],
                        );
                      } catch (err) {
                        if (reqId !== parseRequestIdRef.current) return;
                        setImproveErr(err?.message || String(err));
                        setParsedSlides(null);
                      } finally {
                        if (reqId === parseRequestIdRef.current)
                          setParseLoading(false);
                      }
                    })();
                  }}
                />
                <button
                  type="button"
                  className="upload-zone"
                  style={{ minHeight: 72 }}
                  onClick={() => pptxInputRef.current?.click()}
                >
                  <UploadCloudIco />
                  <div className="upload-zone-text">
                    {improveFile
                      ? improveFile.name
                      : "Click to select a .pptx file"}
                  </div>
                </button>

                {improveFile && !addStockImages && (
                  <div
                    className="improve-image-panel"
                    style={{ marginTop: 14 }}
                  >
                    <SectionHead>Add images to slides</SectionHead>
                    {parseLoading ? (
                      <FieldLabel style={{ marginBottom: 0 }}>
                        Reading slides from your file…
                      </FieldLabel>
                    ) : !parsedSlides?.length ? (
                      <FieldLabel style={{ marginBottom: 0 }}>
                        Could not load slides from this file. Try another .pptx
                        or check the error above.
                      </FieldLabel>
                    ) : (
                      <>
                        {improveImageProvider && (
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color:
                                improveImageProvider === "none"
                                  ? isDark
                                    ? "rgba(251,191,36,.95)"
                                    : "#b45309"
                                  : isDark
                                    ? "rgba(165,180,252,.95)"
                                    : "#4338ca",
                              marginBottom: 8,
                            }}
                          >
                            Image search:{" "}
                            {improveImageProvider === "unsplash"
                              ? "Unsplash"
                              : "not configured (set UNSPLASH_ACCESS_KEY on the server)"}
                          </div>
                        )}
                        <FieldLabel>
                          Pick a slide, search, then click a thumbnail to
                          attach. Or paste a direct{" "}
                          <code style={{ fontSize: 10.5 }}>http(s)://</code>{" "}
                          image URL. Max 10 images.
                        </FieldLabel>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: isDark
                                ? "rgba(255,255,255,.5)"
                                : "rgba(0,0,0,.55)",
                            }}
                          >
                            Target slide
                          </span>
                          <select
                            className="txt-inp"
                            style={{
                              width: "auto",
                              minWidth: 120,
                              height: 32,
                              padding: "0 8px",
                            }}
                            value={improveTargetSlide}
                            onChange={(e) =>
                              setImproveTargetSlide(Number(e.target.value))
                            }
                          >
                            {parsedSlides.map((s) => (
                              <option key={s.index} value={s.index}>
                                Slide {s.index}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div
                          style={{ display: "flex", gap: 8, marginBottom: 8 }}
                        >
                          <input
                            className="txt-inp"
                            placeholder="Search images…"
                            value={improveImgQuery}
                            onChange={(e) => setImproveImgQuery(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleImproveImageSearch()
                            }
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <button
                            type="button"
                            className="btn-prev"
                            style={{ height: 34, flexShrink: 0 }}
                            disabled={
                              improveImgSearchLoading || !improveImgQuery.trim()
                            }
                            onClick={() => void handleImproveImageSearch()}
                          >
                            {improveImgSearchLoading ? "…" : "Search"}
                          </button>
                        </div>
                        {improveImgSearchHint && (
                          <div
                            className={
                              improveImgResults.length
                                ? "improve-search-hint"
                                : "improve-err"
                            }
                            style={{ marginBottom: 8 }}
                          >
                            {improveImgSearchHint}
                          </div>
                        )}
                        {improveImgResults.length > 0 && (
                          <div className="improve-img-grid">
                            {improveImgResults.map((it, idx) => (
                              <button
                                key={`${it.link || idx}-${idx}`}
                                type="button"
                                className="improve-img-hit"
                                title={it.title || "Add to slide"}
                                onClick={() =>
                                  addPickedImageFromUrl(
                                    it.link,
                                    it.thumbnailLink,
                                  )
                                }
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={it.thumbnailLink || it.link} alt="" />
                              </button>
                            ))}
                          </div>
                        )}
                        <FieldLabel style={{ marginTop: 10 }}>
                          Or paste a direct image URL
                        </FieldLabel>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            className="txt-inp"
                            placeholder="https://…"
                            value={improvePasteUrl}
                            onChange={(e) => setImprovePasteUrl(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="btn-prev"
                            style={{ height: 34 }}
                            onClick={() => {
                              addPickedImageFromUrl(improvePasteUrl.trim(), "");
                              setImprovePasteUrl("");
                            }}
                          >
                            Add
                          </button>
                        </div>
                        {pickedUserImages.length > 0 && (
                          <div className="improve-picked-list">
                            {pickedUserImages.map((p) => (
                              <div
                                key={p.slideIndex}
                                className="improve-picked-chip"
                              >
                                <span>Slide {p.slideIndex}</span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {p.thumb ? (
                                  <img
                                    src={p.thumb}
                                    alt=""
                                    className="improve-picked-thumb"
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  className="improve-picked-x"
                                  onClick={() =>
                                    removePickedImage(p.slideIndex)
                                  }
                                  aria-label="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <label
                  className="chk-row"
                  style={{ marginTop: 4 }}
                  onClick={() => setAdditiveImprove((v) => !v)}
                >
                  <div className={`chk-box ${additiveImprove ? "on" : ""}`}>
                    {additiveImprove && <span className="chk-tick">✓</span>}
                  </div>
                  Improve in place (neutral layout, no extra cover slide; keep
                  original wording unless you ask otherwise)
                </label>

                <FieldLabel style={{ marginTop: 10 }}>
                  Detail level (for generated deck)
                </FieldLabel>
                <Dropdown
                  value={
                    improveDetailLevel === "concise"
                      ? "Concise"
                      : improveDetailLevel === "deep"
                        ? "Deep (lecture+)"
                        : "Lecture (default)"
                  }
                  onChange={(v) => {
                    const m = {
                      Concise: "concise",
                      "Lecture (default)": "lecture",
                      "Deep (lecture+)": "deep",
                    };
                    setImproveDetailLevel(m[v] || "lecture");
                  }}
                  options={["Concise", "Lecture (default)", "Deep (lecture+)"]}
                  width={160}
                />
                {/* ── 2slides Theme Search ── */}
                <SectionHead>Find a design template (optional)</SectionHead>
                <FieldLabel>
                  Search for a visual style — the generator will try to match it
                  using pptxGenJS.
                </FieldLabel>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="txt-inp"
                    placeholder="e.g. modern dark, minimal blue, corporate..."
                    value={themeQuery}
                    onChange={(e) => setThemeQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleThemeSearch()}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-prev"
                    style={{ height: 34, flexShrink: 0 }}
                    disabled={themeSearchLoading || !themeQuery.trim()}
                    onClick={() => void handleThemeSearch()}
                  >
                    {themeSearchLoading ? "…" : "Search"}
                  </button>
                </div>
                {themeSearchErr && (
                  <div className="improve-err" style={{ marginBottom: 8 }}>
                    {themeSearchErr}
                  </div>
                )}
                {themeResults.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    {themeResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={async () => {
                          setSelectedThemeId(t.id);
                          // If we already fetched this theme's spec, use it directly
                          if (t._templateSpec) {
                            setSelectedTemplateSpec(t._templateSpec);
                            return;
                          }
                          // Otherwise fetch it now (only for non-top results)
                          setThemeSearchLoading(true);
                          try {
                            const baseQ = (themeResultsQuery || themeQuery).trim() || t.name;
                            const params = new URLSearchParams({
                              q: baseQ,
                              model: aiModel,
                              themeId: String(t.id),
                              themeName: t.name || "",
                            });
                            const res = await fetch(
                              `/api/improve-ppt/theme-search?${params.toString()}`,
                            );
                            const data = await res.json().catch(() => ({}));
                            if (data.templateSpec) {
                              t._templateSpec = data.templateSpec; // cache it on the object
                              setSelectedTemplateSpec(data.templateSpec);
                            }
                          } catch (e) {
                            setThemeSearchErr(e?.message || String(e));
                          } finally {
                            setThemeSearchLoading(false);
                          }
                        }}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 8,
                          fontSize: 11,
                          border: `1px solid ${selectedThemeId === t.id ? "rgba(99,102,241,.7)" : "rgba(255,255,255,.12)"}`,
                          background:
                            selectedThemeId === t.id
                              ? "rgba(99,102,241,.2)"
                              : "rgba(255,255,255,.04)",
                          color:
                            selectedThemeId === t.id
                              ? "#c7d2fe"
                              : "rgba(255,255,255,.6)",
                          cursor: "pointer",
                        }}
                        title={t.description}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedTemplateSpec && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(165,180,252,.9)",
                      marginBottom: 10,
                    }}
                  >
                    ✓ Using style:{" "}
                    <strong>{selectedTemplateSpec._themeName}</strong> —{" "}
                    {selectedTemplateSpec._summary}
                  </div>
                )}

                <SectionHead>What should change?</SectionHead>
                <textarea
                  className="improve-area"
                  rows={4}
                  placeholder={
                    'Examples:\n• "Expand speaker notes; keep on-slide bullets close to the original."\n• "Switch to a green theme and add relevant pictures."\n• "Tighten bullets for clarity and refresh the deck visuals."'
                  }
                  value={improveInstructions}
                  onChange={(e) => setImproveInstructions(e.target.value)}
                />

                <SectionHead>AI model</SectionHead>
                <Dropdown
                  value={aiModel}
                  onChange={setAiModel}
                  options={["ChatGPT", "DeepSeek", "Gemini"]}
                  width={130}
                />

                <label
                  className="chk-row"
                  style={{ marginTop: 8 }}
                  onClick={() => setAddStockImages((v) => !v)}
                >
                  <div className={`chk-box ${addStockImages ? "on" : ""}`}>
                    {addStockImages && <span className="chk-tick">✓</span>}
                  </div>
                  Auto-add stock images from each slide’s keywords (title,
                  bullets, original text) using Unsplash. Requires
                  UNSPLASH_ACCESS_KEY. Uncheck this to use the manual Unsplash
                  search panel.
                </label>

                {improveErr && <div className="improve-err">{improveErr}</div>}

                {parsedSlides?.length > 0 &&
                  improveInstructions.trim() &&
                  planLoading && (
                    <div
                      style={{ fontSize: 11.5, color: "#a5b4fc", marginTop: 4 }}
                    >
                      Planning adjustments…
                    </div>
                  )}
                {planError && (
                  <div className="improve-err" style={{ marginTop: 4 }}>
                    {planError}
                  </div>
                )}

                {planAdjustments.length > 0 && (
                  <>
                    <SectionHead>Planned adjustments</SectionHead>
                    <div className="plan-list">
                      {planAdjustments.map((adj, i) => (
                        <div key={i} className="plan-item">
                          <strong style={{ color: "#a5b4fc" }}>
                            Slide {adj.slideIndex}
                          </strong>{" "}
                          ({adj.type})<br />
                          {adj.description}
                          {adj.before && (
                            <>
                              <br />
                              <span style={{ opacity: 0.75 }}>
                                Before: {String(adj.before).slice(0, 200)}
                                {String(adj.before).length > 200 ? "…" : ""}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {parsedSlides?.length > 0 &&
                  improveInstructions.trim() &&
                  !planLoading &&
                  !planError &&
                  planAdjustments.length === 0 && (
                    <div
                      className="plan-list"
                      style={{ color: "rgba(255,255,255,.4)" }}
                    >
                      No specific adjustments listed — the deck may already
                      match your request, or try different instructions.
                    </div>
                  )}
              </div>
            )}

            <CreateSlidesForm
              quickInstructionPresets={quickInstructionPresets}
              applyQuickInstruction={applyQuickInstruction}
              scrollQuickRequests={scrollQuickRequests}
              quickRequestsRef={quickRequestsRef}
              slideUserPrompt={slideUserPrompt}
              setSlideUserPrompt={setSlideUserPrompt}
              title={title}
              setTitle={setTitle}
              slideLength={slideLength}
              setSlideLength={setSlideLength}
              maxSlides={maxSlides}
              setMaxSlides={setMaxSlides}
              template={template}
              setTemplate={setTemplate}
              fontSize={fontSize}
              setFontSize={setFontSize}
              textDensity={textDensity}
              setTextDensity={setTextDensity}
              aiModel={aiModel}
              setAiModel={setAiModel}
              strictness={strictness}
              setStrictness={setStrictness}
              textStyle={textStyle}
              setTextStyle={setTextStyle}
              bulletLimit={bulletLimit}
              setBulletLimit={setBulletLimit}
              highlightDefs={highlightDefs}
              setHighlightDefs={setHighlightDefs}
              boldKeywords={boldKeywords}
              setBoldKeywords={setBoldKeywords}
              generateErr={generateErr}
              generateProgress={generateProgress}
              archiveNote={archiveNote}
            />
          </div>
          {/* /sl-body */}

          {/* ── Footer ── */}
          <div className="sl-foot">
            <button
              type="button"
              className="btn-create"
              onClick={handleCreate}
              disabled={generating}
            >
              {generating ? <div className="mini-spin" /> : <SlidesIco />}
              Generate {generating && generateProgress ? "" : "Slides"}
            </button>
          </div>
        </div>
      </div>

      {alaiPreviewOpen && (
        <AlaiSlidesPreviewModal
          onClose={() => setAlaiPreviewOpen(false)}
          previewUrl={alaiPreviewUrl}
          remotePptUrl={alaiRemotePptUrl}
          title="Create Presentation Slides..."
          subtitle="Your presentation slides is ready.."
          onDownload={(() => {
            const fn = slideDownloadRef.current;
            return typeof fn === "function"
              ? async () => {
                  await fn();
                }
              : undefined;
          })()}
        />
      )}
    </>
  );
}