"use client";

import "./GenerateSlidesModal.css";
import { useState, useRef, useEffect } from "react";
import AlaiSlidesPreviewModal from "./AlaiSlidesPreviewModal";
import {
  CloseIco,
  Divider,
  FieldLabel,
  SectionHead,
  SlidesIco,
  UploadCloudIco,
} from "./generateSlides/ui.jsx";
import CreateSlidesForm from "./generateSlides/CreateSlidesForm.jsx";
import { useTheme } from "./ThemeProvider";
import { uploadDocumentViaClient } from "@/lib/clientDocumentUpload";

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

  // ── Active tab: "create" | "improve" ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState("create");

  // Improve existing PPT
  const [improveFile, setImproveFile] = useState(null);
  const [improveInstructions, setImproveInstructions] = useState("");
  /** Parsed slide list from /api/improve-ppt/parse (no LLM). */
  const [parsedSlides, setParsedSlides] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [enableOcr, setEnableOcr] = useState(false);
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
  const [highlightDefs, setHighlightDefs] = useState(() =>
    ["lecturer", "student"].includes(summarizeFor),
  );
  const [boldKeywords, setBoldKeywords] = useState(false);
  const [provider, setProvider] = useState("alai");
  const [speakerNotes, setSpeakerNotes] = useState(false);
  const [imageStyle, setImageStyle] = useState("auto");
  const [selectedVibeId, setSelectedVibeId] = useState("");
  const [alaiThemes, setAlaiThemes] = useState([]);
  const [alaiThemesLoading, setAlaiThemesLoading] = useState(false);
  const [alaiThemesHint, setAlaiThemesHint] = useState("");
  const [alaiVibes, setAlaiVibes] = useState([]);
  const [alaiVibesLoading, setAlaiVibesLoading] = useState(false);
  const [imageIds, setImageIds] = useState([]);
  const [numImageVariants, setNumImageVariants] = useState(1);

  // 2slides theme search (separate from improve-ppt theme search)
  const [twoSlidesThemes, setTwoSlidesThemes] = useState([]);
  const [twoSlidesThemesLoading, setTwoSlidesThemesLoading] = useState(false);
  const [twoSlidesThemesHint, setTwoSlidesThemesHint] = useState("");
  const [twoSlidesThemeQuery, setTwoSlidesThemeQuery] = useState("");
  // 2slides output language
  const [responseLanguage, setResponseLanguage] = useState("Auto");

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

  function setFreshSlideDownload(pollData, slideProvider = provider) {
    const dl = pollData.download_url;
    if (!dl) {
      slideDownloadRef.current = null;
      return;
    }
    const t = title || "presentation";
    const prov = slideProvider || "alai";
    slideDownloadRef.current = async () => {
      const dlRes = await fetch(
        `${dl}?title=${encodeURIComponent(t)}&provider=${encodeURIComponent(prov)}`,
      );
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
    remotePdfUrl,
    deckTitle,
    deckProvider = provider,
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
          provider: deckProvider,
          providerDeckId: genId,
          title: String(deckTitle || title || "").trim() || undefined,
          remotePptxUrl:
            String(remotePptxUrl || alaiRemotePptUrl || "").trim() || undefined,
          remotePdfUrl: String(remotePdfUrl || "").trim() || undefined,
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

  useEffect(() => {
    // Only auto-load Alai themes on mount
    let cancelled = false;
    setAlaiThemesLoading(true);
    setAlaiThemesHint("");
    void (async () => {
      try {
        const res = await fetch("/api/themes?provider=alai");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setAlaiThemes([]);
          setAlaiThemesHint(
            data?.error || data?.hint || "Could not load Alai themes.",
          );
          return;
        }
        const themes = Array.isArray(data.themes) ? data.themes : [];
        setAlaiThemes(themes);
        if (data?.hint) setAlaiThemesHint(String(data.hint));
        else if (themes.length === 0) {
          setAlaiThemesHint(
            "No Alai themes returned. Check ALAI_API_KEY in .env.local.",
          );
        }
        if (themes.length > 0) {
          setSelectedThemeId((prev) => {
            if (
              prev &&
              themes.some((t) => String(t?.id || t?.theme_id) === prev)
            )
              return prev;
            return String(themes[0]?.id || themes[0]?.theme_id || "") || prev;
          });
        }
      } catch {
        if (!cancelled) {
          setAlaiThemes([]);
          setAlaiThemesHint("Could not load Alai themes.");
        }
      } finally {
        if (!cancelled) setAlaiThemesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTwoSlidesThemeSearch() {
    const q = twoSlidesThemeQuery.trim() || "business";
    setTwoSlidesThemesLoading(true);
    setTwoSlidesThemesHint("");
    try {
      const res = await fetch(
        `/api/themes?provider=2slides&query=${encodeURIComponent(q)}&limit=24`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTwoSlidesThemes([]);
        setTwoSlidesThemesHint(
          data?.error || data?.hint || "Could not load 2slides themes.",
        );
        return;
      }
      const themes = Array.isArray(data.themes) ? data.themes : [];
      setTwoSlidesThemes(themes);
      if (data?.hint) setTwoSlidesThemesHint(String(data.hint));
      else if (themes.length === 0) {
        setTwoSlidesThemesHint(
          "No themes found for that query. Try another keyword.",
        );
      }
      if (themes.length > 0) {
        setSelectedThemeId(
          String(themes[0]?.id || themes[0]?.theme_id || "") || null,
        );
      }
    } catch (e) {
      setTwoSlidesThemes([]);
      setTwoSlidesThemesHint(e?.message || "Could not load 2slides themes.");
    } finally {
      setTwoSlidesThemesLoading(false);
    }
  }

  useEffect(() => {
    if (provider !== "alai") return;
    let cancelled = false;
    setAlaiVibesLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/vibes?provider=alai");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setAlaiVibes(Array.isArray(data.vibes) ? data.vibes : []);
        } else {
          setAlaiVibes([]);
        }
      } catch {
        if (!cancelled) setAlaiVibes([]);
      } finally {
        if (!cancelled) setAlaiVibesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

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
          textStyle,
          strictness,
          highlightDefs,
          boldKeywords,
          speakerNotes,
          provider,
          themeId: selectedThemeId || undefined,
          imageStyle: provider === "alai" ? imageStyle : undefined,
          vibeId:
            provider === "alai" && selectedVibeId ? selectedVibeId : undefined,
          numImageVariants: provider === "alai" ? numImageVariants : undefined,
          imageIds:
            provider === "alai" && imageIds.length > 0 ? imageIds : undefined,
          bulletLimit: String(bulletLimit || "").trim() || undefined,
          responseLanguage:
            provider === "2slides" ? responseLanguage : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      const genId = data.generation_id;
      if (!genId) throw new Error("No generation ID returned");
      const activeProvider = String(data.provider || provider).toLowerCase();
      setLastGenerationId(String(genId));

      const pollIntervalMs = activeProvider === "2slides" ? 20_000 : 3_000;

      /** Alai often sets `completed` before `formats.ppt` is populated — keep polling. */
      let exportWaitAttempts = 0;
      const MAX_EXPORT_WAIT_ATTEMPTS = 60;

      // Poll for completion (2slides: ≥20s per API guidance; Alai: 3s)
      while (true) {
        const pollRes = await fetch(
          `/api/generate-slides/${genId}?provider=${encodeURIComponent(activeProvider)}`,
        );
        const pollData = await pollRes.json();

        if (!pollRes.ok) {
          throw new Error(pollData.error || "Failed to check status");
        }

        if (pollData.status === "failed") {
          throw new Error(
            pollData.error || "Slide generation failed on the server.",
          );
        }

        const hasArtifact = !!(
          pollData.preview_url ||
          pollData.download_url ||
          pollData.remote_download_url
        );

        if (pollData.status === "completed" && hasArtifact) {
          setAlaiPreviewUrl(pollData.preview_url || "");
          setAlaiDownloadUrl(pollData.download_url || "");
          setAlaiRemotePptUrl(pollData.remote_download_url || "");
          setFreshSlideDownload(pollData, activeProvider);

          if (pollData.preview_url) {
            setGenerateProgress("Ready — opening preview...");
            setAlaiPreviewOpen(true);
          } else if (pollData.download_url) {
            setGenerateProgress("Slides are ready. Downloading…");
            const t = title || "presentation";
            const dlRes = await fetch(
              `${pollData.download_url}?title=${encodeURIComponent(t)}&provider=${encodeURIComponent(activeProvider)}`,
            );
            if (!dlRes.ok)
              throw new Error("Failed to download presentation file");
            const blob = await dlRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${t.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "presentation"}.pptx`;
            a.click();
            URL.revokeObjectURL(blobUrl);
          }

          void saveDeckToArchive({
            generationId: String(genId),
            remotePptxUrl: pollData.remote_download_url || "",
            remotePdfUrl: pollData.remote_pdf_url || "",
            deckTitle: title.trim() || undefined,
            deckProvider: activeProvider,
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
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }

        const statusMessages = {
          queued: "Queued — waiting for a generation slot…",
          pending: "Preparing your presentation…",
          in_progress: "Building slides from your summary…",
          processing: "Processing slide content…",
          rendering: "Rendering slides…",
          exporting: "Exporting to PPTX…",
        };
        setGenerateProgress(
          statusMessages[pollData.status] ?? `Working… (${pollData.status})`,
        );
        await new Promise((r) => setTimeout(r, pollIntervalMs));
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

          {/* ── Tabs ── */}
          <div className="sl-tabs">
            <button
              type="button"
              className={`sl-tab${activeTab === "create" ? " on" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              ✦ Create slides
            </button>
            <button
              type="button"
              className={`sl-tab${activeTab === "improve" ? " on" : ""}`}
              onClick={() => setActiveTab("improve")}
            >
              ✎ Improve existing
            </button>
          </div>

          {/* ── Scrollable body ── */}
          {activeTab === "create" ? (
            <>
              <div className="sl-body slides-sl-body">
                <CreateSlidesForm
                  provider={provider}
                  setProvider={setProvider}
                  quickInstructionPresets={quickInstructionPresets}
                  applyQuickInstruction={applyQuickInstruction}
                  slideUserPrompt={slideUserPrompt}
                  setSlideUserPrompt={setSlideUserPrompt}
                  title={title}
                  setTitle={setTitle}
                  slideLength={slideLength}
                  setSlideLength={setSlideLength}
                  maxSlides={maxSlides}
                  setMaxSlides={setMaxSlides}
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
                  speakerNotes={speakerNotes}
                  setSpeakerNotes={setSpeakerNotes}
                  generateErr={generateErr}
                  generateProgress={generateProgress}
                  archiveNote={archiveNote}
                  alaiThemes={alaiThemes}
                  alaiThemesLoading={alaiThemesLoading}
                  alaiThemesHint={alaiThemesHint}
                  selectedThemeId={selectedThemeId}
                  setSelectedThemeId={setSelectedThemeId}
                  imageStyle={imageStyle}
                  setImageStyle={setImageStyle}
                  alaiVibes={alaiVibes}
                  alaiVibesLoading={alaiVibesLoading}
                  selectedVibeId={selectedVibeId}
                  setSelectedVibeId={setSelectedVibeId}
                  imageIds={imageIds}
                  onImageIdsChange={setImageIds}
                  numImageVariants={numImageVariants}
                  onVariantsChange={setNumImageVariants}
                  twoSlidesThemes={twoSlidesThemes}
                  twoSlidesThemesLoading={twoSlidesThemesLoading}
                  twoSlidesThemesHint={twoSlidesThemesHint}
                  twoSlidesThemeQuery={twoSlidesThemeQuery}
                  setTwoSlidesThemeQuery={setTwoSlidesThemeQuery}
                  onTwoSlidesThemeSearch={handleTwoSlidesThemeSearch}
                  responseLanguage={responseLanguage}
                  setResponseLanguage={setResponseLanguage}
                />
              </div>
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
            </>
          ) : (
            /* ── Improve existing PPTX tab (Alai only) ── */
            <>
              <div
                className="sl-body"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* File upload */}
                <div>
                  <SectionHead>Upload your PPTX or PDF</SectionHead>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 6,
                    }}
                  >
                    <input
                      ref={pptxInputRef}
                      type="file"
                      accept=".pptx,.pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setImproveFile(f);
                        setParsedSlides(null);
                        setPlanAdjustments([]);
                        if (f) {
                          setParseLoading(true);
                          void (async () => {
                            try {
                              const doc = await uploadDocumentViaClient(f);
                              const res = await fetch(
                                "/api/improve-ppt/parse",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    documentId: doc.id,
                                    ocr: enableOcr,
                                    model: aiModel,
                                  }),
                                },
                              );
                              const d = await res.json().catch(() => ({}));
                              if (res.ok && d?.slides) {
                                setParsedSlides(d.slides);
                                if (d.ocrWarning)
                                  setImproveErr(String(d.ocrWarning));
                              }
                            } catch {
                              /* ignore */
                            } finally {
                              setParseLoading(false);
                            }
                          })();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="gs-pill on"
                      onClick={() => pptxInputRef.current?.click()}
                    >
                      <UploadCloudIco /> Choose file
                    </button>
                    {improveFile ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,.6)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {parseLoading
                          ? enableOcr
                            ? "Parsing slides (OCR)…"
                            : "Parsing slides…"
                          : `✓ ${improveFile.name}${parsedSlides ? ` · ${parsedSlides.length} slides` : ""}`}
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: 12, color: "rgba(255,255,255,.3)" }}
                      >
                        .pptx or .pdf · max 50 MB
                      </span>
                    )}
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginTop: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "rgba(255,255,255,.65)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enableOcr}
                      onChange={(e) => setEnableOcr(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      Deep scan images (OCR) — slower; use ChatGPT or Gemini
                    </span>
                  </label>
                </div>

                {/* Instructions */}
                <div>
                  <SectionHead>What to improve</SectionHead>
                  <textarea
                    className="create-prompt-area"
                    rows={3}
                    maxLength={2000}
                    placeholder='e.g. "Make slides more concise", "Add a worked example after each concept", "Use a professional dark theme"…'
                    value={improveInstructions}
                    onChange={(e) => setImproveInstructions(e.target.value)}
                  />
                  <div className="create-prompt-hint">
                    {improveInstructions.length} / 2000
                  </div>
                </div>

                {/* Two columns for options */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px 24px",
                  }}
                >
                  {/* Left col */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div>
                      <SectionHead>Detail level</SectionHead>
                      <div className="create-pill-row">
                        {[
                          { value: "concise", label: "Concise" },
                          { value: "lecture", label: "Lecture" },
                          { value: "deep", label: "Deep" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`gs-pill${improveDetailLevel === opt.value ? " on" : ""}`}
                            onClick={() => setImproveDetailLevel(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <FieldLabel
                        style={{
                          marginTop: 4,
                          fontSize: 10.5,
                          color: "rgba(255,255,255,.3)",
                        }}
                      >
                        {improveDetailLevel === "concise" &&
                          "2+ bullets, brief notes"}
                        {improveDetailLevel === "lecture" &&
                          "3–6 bullets, 3–5 sentence notes"}
                        {improveDetailLevel === "deep" &&
                          "4–8 bullets, rich notes with examples"}
                      </FieldLabel>
                    </div>

                    <div>
                      <SectionHead>Edit mode</SectionHead>
                      <div className="create-pill-row">
                        <button
                          type="button"
                          className={`gs-pill${additiveImprove ? " on" : ""}`}
                          onClick={() => setAdditiveImprove(true)}
                        >
                          Additive
                        </button>
                        <button
                          type="button"
                          className={`gs-pill${!additiveImprove ? " on" : ""}`}
                          onClick={() => setAdditiveImprove(false)}
                        >
                          Full redesign
                        </button>
                      </div>
                      <FieldLabel
                        style={{
                          marginTop: 4,
                          fontSize: 10.5,
                          color: "rgba(255,255,255,.3)",
                        }}
                      >
                        {additiveImprove
                          ? "Keeps all original content, adds new bullets marked →"
                          : "AI may rewrite titles, bullets, and structure"}
                      </FieldLabel>
                    </div>

                    <div>
                      <SectionHead>AI model</SectionHead>
                      <div className="create-pill-row">
                        {["Gemini", "ChatGPT", "DeepSeek"].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`gs-pill${aiModel === m ? " on" : ""}`}
                            onClick={() => setAiModel(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right col */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div>
                      <SectionHead>2slides theme (optional)</SectionHead>
                      <div className="tag-hint" style={{ marginBottom: 6 }}>
                        Search for a visual template to apply to the improved
                        deck
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input
                          className="txt-inp"
                          placeholder="e.g. academic, minimal…"
                          value={themeQuery}
                          onChange={(e) => setThemeQuery(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleThemeSearch()
                          }
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="gs-pill on"
                          style={{ whiteSpace: "nowrap", padding: "0 10px" }}
                          onClick={handleThemeSearch}
                          disabled={themeSearchLoading}
                        >
                          {themeSearchLoading ? "…" : "Search"}
                        </button>
                      </div>
                      {themeSearchErr && (
                        <div className="tag-hint" style={{ color: "#f87171" }}>
                          {themeSearchErr}
                        </div>
                      )}
                      {themeResults.length > 0 && (
                        <select
                          className="txt-inp"
                          value={selectedThemeId || ""}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedThemeId(id || null);
                            const found = themeResults.find(
                              (t) => String(t?.id || t?.theme_id) === id,
                            );
                            setSelectedTemplateSpec(
                              found?.templateSpec ?? null,
                            );
                          }}
                          style={{ width: "100%", marginTop: 4 }}
                        >
                          <option value="">None (Alai picks design)</option>
                          {themeResults.map((t) => {
                            const id = String(t?.id || t?.theme_id || "");
                            const label =
                              String(t?.name || t?.title || "").trim() || id;
                            return (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <div>
                      <SectionHead>Stock images</SectionHead>
                      <label
                        className="chk-row"
                        onClick={() => setAddStockImages((v) => !v)}
                      >
                        <div
                          className={`chk-box ${addStockImages ? "on" : ""}`}
                        >
                          {addStockImages ? (
                            <span className="chk-tick">✓</span>
                          ) : null}
                        </div>
                        Search and add stock images
                      </label>
                      <div className="tag-hint" style={{ marginTop: 4 }}>
                        Alai finds relevant images from Unsplash
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error / progress */}
                {improveErr && <div className="improve-err">{improveErr}</div>}
                {improveGenLoading && (
                  <div className="gs-progress-bar-wrap">
                    <div className="gs-progress-track">
                      <div className="gs-progress-fill" />
                    </div>
                    <div className="gs-progress-label">
                      <span className="gs-progress-dot" />
                      Improving your slides with Alai…
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sl-foot">
                <button
                  type="button"
                  className="btn-create"
                  onClick={handleImproveGenerate}
                  disabled={
                    improveGenLoading ||
                    !improveFile ||
                    !improveInstructions.trim()
                  }
                >
                  {improveGenLoading ? (
                    <div className="mini-spin" />
                  ) : (
                    <SlidesIco />
                  )}
                  {improveGenLoading ? "Improving…" : "Improve Slides"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {alaiPreviewOpen && (
        <AlaiSlidesPreviewModal
          onClose={() => setAlaiPreviewOpen(false)}
          previewUrl={alaiPreviewUrl}
          remotePptUrl={alaiRemotePptUrl}
          provider={provider}
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
