"use client";

import "./GenerateSlidesModal.css";
import { useState, useRef, useEffect } from "react";
import AlaiSlidesPreviewModal from "./AlaiSlidesPreviewModal";
import { CloseIco, SlidesIco } from "./generateSlides/ui.jsx";
import CreateSlidesForm from "./generateSlides/CreateSlidesForm.jsx";
import { useTheme } from "./ThemeProvider";

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

  /** Latest download action for the open Alai preview (fresh proxy vs saved blob) */
  const slideDownloadRef = useRef(null);

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

  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState("");
  const [generateProgress, setGenerateProgress] = useState("");
  const [alaiPreviewOpen, setAlaiPreviewOpen] = useState(false);
  const [alaiPreviewUrl, setAlaiPreviewUrl] = useState("");
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

  return (
    <>
      <div
        className={`sl-overlay slides-gen-overlay${isDark ? "" : " slides-modal-light"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sl-modal">
          <div className="sl-head">
            <div className="sl-title">
              <SlidesIco /> Presentation Slides
            </div>
            <button className="sl-close" onClick={onClose}>
              <CloseIco />
            </button>
          </div>

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
