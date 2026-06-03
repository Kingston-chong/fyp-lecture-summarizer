"use client";

import "./GenerateSlidesModal.css";
import { useState, useRef, useEffect } from "react";
import { CloseIco, SlidesIco } from "./generateSlides/ui.jsx";
import CreateSlidesForm from "./generateSlides/CreateSlidesForm.jsx";
import { useTheme } from "./ThemeProvider";
import { getAlaiSlideGenLoadingMessage } from "@/lib/alaiSlideGenLoadingMessage";
import {
  buildSlidePptxDownloadUrl,
  triggerDirectFileDownload,
  triggerSlidePptxApiDownload,
} from "@/lib/slidePptxClientDownload";
import {
  pickThemeIdAfterListLoad,
  readStoredThemeChoice,
  writeStoredThemeChoice,
} from "@/lib/themeSelection";

// ─── Main Modal ───────────────────────────────────────────
export default function GenerateSlidesModal({
  onClose,
  summaryText = "",
  summarizeFor = "student",
  /** When set, completed Alai decks are archived for this summary */
  summaryId = null,
  /** Called after a deck is successfully saved to the server (e.g. refresh sidebar) */
  onSlideDecksChanged = null,
  /**
   * When slides are ready with a preview URL — parent closes this modal and
   * shows AlaiSlidesPreviewModal on the summary page.
   */
  onOpenPreview = null,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  /** Latest download action for the open Alai preview (fresh proxy vs saved blob) */
  const slideDownloadRef = useRef(null);
  const alaiLoadingTimerRef = useRef(null);
  const alaiLoadingStartRef = useRef(0);
  const alaiApiStatusRef = useRef("");

  function clearAlaiLoadingTimer() {
    if (alaiLoadingTimerRef.current) {
      clearInterval(alaiLoadingTimerRef.current);
      alaiLoadingTimerRef.current = null;
    }
  }

  function startAlaiLoadingTimer() {
    clearAlaiLoadingTimer();
    alaiLoadingStartRef.current = Date.now();
    alaiApiStatusRef.current = "Preparing your presentation…";
    setGenerateProgress(
      getAlaiSlideGenLoadingMessage(0, alaiApiStatusRef.current),
    );
    alaiLoadingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alaiLoadingStartRef.current;
      setGenerateProgress(
        getAlaiSlideGenLoadingMessage(elapsed, alaiApiStatusRef.current),
      );
    }, 1000);
  }

  function setAlaiApiStatus(message) {
    const msg = String(message || "").trim();
    if (msg) alaiApiStatusRef.current = msg;
    if (alaiLoadingTimerRef.current) {
      const elapsed = Date.now() - alaiLoadingStartRef.current;
      setGenerateProgress(
        getAlaiSlideGenLoadingMessage(elapsed, alaiApiStatusRef.current),
      );
    }
  }

  useEffect(() => () => clearAlaiLoadingTimer(), []);

  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [title, setTitle] = useState("");
  const [slideUserPrompt, setSlideUserPrompt] = useState("");
  const [slideLength, setSlideLength] = useState("Short (summary)");
  const [maxSlides, setMaxSlides] = useState("");
  const [strictness, setStrictness] = useState("Strict");
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
  const [twoSlidesThemes, setTwoSlidesThemes] = useState([]);
  const [twoSlidesThemesLoading, setTwoSlidesThemesLoading] = useState(false);
  const [twoSlidesThemesHint, setTwoSlidesThemesHint] = useState("");
  const [twoSlidesThemeQuery, setTwoSlidesThemeQuery] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Auto");
  const [alaiLanguage, setAlaiLanguage] = useState("");
  const [includeAiImages, setIncludeAiImages] = useState(true);
  const [includeWebImages, setIncludeWebImages] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState("");
  const [generateProgress, setGenerateProgress] = useState("");
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
    const directUrl = String(pollData.remote_download_url || "").trim();
    if (!dl && !directUrl) {
      slideDownloadRef.current = null;
      return;
    }
    const t = title || "presentation";
    const prov = slideProvider || "alai";
    slideDownloadRef.current = async () => {
      if (directUrl) {
        triggerDirectFileDownload(directUrl);
        return;
      }
      const href = buildSlidePptxDownloadUrl(dl, {
        title: t,
        provider: prov,
      });
      triggerSlidePptxApiDownload(href);
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
          remotePptxUrl: String(remotePptxUrl || "").trim() || undefined,
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

  useEffect(() => {
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
            const stored = readStoredThemeChoice("generate", "alai");
            const want = prev || stored?.id || null;
            return pickThemeIdAfterListLoad(want, themes);
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
        setSelectedThemeId((prev) => {
          const stored = readStoredThemeChoice("generate", "2slides");
          const want = prev || stored?.id || null;
          return pickThemeIdAfterListLoad(want, themes);
        });
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

  useEffect(() => {
    if (provider !== "2slides") return;
    if (twoSlidesThemes.length > 0) return;
    void handleTwoSlidesThemeSearch();
  }, [provider]);

  function handleProviderChange(next) {
    setProvider(next);
    const stored = readStoredThemeChoice("generate", next);
    if (next === "2slides") {
      const themes = twoSlidesThemes;
      if (themes.length > 0) {
        setSelectedThemeId(
          pickThemeIdAfterListLoad(stored?.id || selectedThemeId, themes),
        );
      } else {
        setSelectedThemeId(stored?.id || null);
      }
      return;
    }
    if (alaiThemes.length > 0) {
      setSelectedThemeId(
        pickThemeIdAfterListLoad(stored?.id || selectedThemeId, alaiThemes),
      );
    } else {
      setSelectedThemeId(stored?.id || null);
    }
  }

  useEffect(() => {
    if (!selectedThemeId) return;
    const list = provider === "2slides" ? twoSlidesThemes : alaiThemes;
    const hit = list.find(
      (t) => String(t?.id || t?.theme_id || "").trim() === selectedThemeId,
    );
    if (hit) writeStoredThemeChoice("generate", provider, hit);
  }, [selectedThemeId, provider, alaiThemes, twoSlidesThemes]);

  const canGenerate =
    !generating &&
    (provider !== "2slides" || Boolean(selectedThemeId?.trim()));

  async function handleCreate() {
    setGenerateErr("");
    setGenerateProgress("");
    setGenerating(true);
    setLastGenerationId("");
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
          bulletLimit:
            provider === "alai"
              ? String(bulletLimit || "").trim() || undefined
              : undefined,
          alaiLanguage: provider === "alai" ? alaiLanguage || undefined : undefined,
          includeAiImages: provider === "alai" ? includeAiImages : undefined,
          includeWebImages:
            provider === "alai" ? includeWebImages : undefined,
          responseLanguage:
            provider === "2slides" ? responseLanguage : undefined,
          slideLength: provider === "alai" ? slideLength : undefined,
          textStyle: provider === "alai" ? textStyle : undefined,
          strictness: provider === "alai" ? strictness : undefined,
          highlightDefs: provider === "alai" ? highlightDefs : undefined,
          boldKeywords: provider === "alai" ? boldKeywords : undefined,
          speakerNotes: provider === "alai" ? speakerNotes : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      const genId = data.generation_id;
      if (!genId) throw new Error("No generation ID returned");
      const activeProvider = String(data.provider || provider).toLowerCase();
      setLastGenerationId(String(genId));

      const pollIntervalMs = activeProvider === "2slides" ? 20_000 : 3_000;
      const isAlaiProvider = activeProvider === "alai";
      if (isAlaiProvider) startAlaiLoadingTimer();

      /** Alai often sets `completed` before `formats.ppt` is populated — keep polling. */
      let exportWaitAttempts = 0;
      const MAX_EXPORT_WAIT_ATTEMPTS = 60;

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
          setFreshSlideDownload(pollData, activeProvider);

          if (pollData.preview_url) {
            setGenerateProgress("Ready — opening preview...");
            const previewPayload = {
              previewUrl: pollData.preview_url || "",
              remotePptUrl: pollData.remote_download_url || "",
              provider: activeProvider,
              title:
                title.trim() || "Create Presentation Slides...",
              onDownload: slideDownloadRef.current,
            };
            if (typeof onOpenPreview === "function") {
              onOpenPreview(previewPayload);
              onClose?.();
            }
          } else if (pollData.download_url) {
            setGenerateProgress("Slides are ready. Starting download…");
            const t = title || "presentation";
            triggerSlidePptxApiDownload(
              buildSlidePptxDownloadUrl(pollData.download_url, {
                title: t,
                provider: activeProvider,
              }),
            );
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
          const exportMsg =
            String(pollData.error || "").trim() || "Waiting for PPTX export…";
          if (isAlaiProvider) setAlaiApiStatus(exportMsg);
          else setGenerateProgress(exportMsg);
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
        const statusMsg =
          statusMessages[pollData.status] ??
          `Working… (${pollData.status})`;
        if (isAlaiProvider) setAlaiApiStatus(statusMsg);
        else setGenerateProgress(statusMsg);
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
    } catch (e) {
      setGenerateErr(e.message || String(e));
    } finally {
      clearAlaiLoadingTimer();
      setGenerating(false);
      setGenerateProgress("");
    }
  }

  return (
    <>
      <div
        className={`sl-overlay slides-gen-overlay${isDark ? "" : " slides-modal-light"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sl-modal">
          <div className="sl-head">
            <div className="sl-title">
              <SlidesIco /> Generate Slides from Summary
            </div>
            <button className="sl-close" onClick={onClose}>
              <CloseIco />
            </button>
          </div>

          <div className="sl-body slides-sl-body">
            <CreateSlidesForm
              provider={provider}
              setProvider={handleProviderChange}
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
              alaiLanguage={alaiLanguage}
              setAlaiLanguage={setAlaiLanguage}
              includeAiImages={includeAiImages}
              setIncludeAiImages={setIncludeAiImages}
              includeWebImages={includeWebImages}
              setIncludeWebImages={setIncludeWebImages}
            />
          </div>

          <div className="sl-foot">
            <button
              type="button"
              className="btn-create"
              onClick={handleCreate}
              disabled={!canGenerate}
              title={
                provider === "2slides" && !selectedThemeId
                  ? "Search and select a 2slides theme first"
                  : undefined
              }
            >
              {generating ? <div className="mini-spin" /> : <SlidesIco />}
              Generate {generating && generateProgress ? "" : "Slides"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
