import { useEffect } from "react";
import { isGuestSummaryRouteId } from "@/lib/guestMode";
import { loadGuestSummarySession } from "@/lib/guestSessionStorage";
import { consumeGuestPendingSummarize } from "@/lib/guestPendingSummarize";
import { runGuestSummarizeStream } from "@/lib/guestSummarizeClient";
import { SUMMARIZE_PHASE } from "@/lib/summarizeProgress";

/**
 * Guest /summary/guest: load sessionStorage + optional autostart stream (no DB).
 */
export function useGuestSummaryBootstrap({
  summaryId,
  status,
  searchParams,
  router,
  setSummary,
  setSummaryLoading,
  setSummaryError,
  setSummarizing,
  setSummarizePhase,
  setSummarizeError,
}) {
  const isGuestMode = isGuestSummaryRouteId(summaryId);

  useEffect(() => {
    if (!isGuestMode) return;
    if (status === "loading") return;

    let cancelled = false;
    async function loadGuest() {
      setSummaryLoading(true);
      setSummaryError("");
      const session = loadGuestSummarySession();
      const autostart = searchParams?.get("autostart") === "1";

      if (!session?.output?.trim() && !autostart) {
        if (!cancelled) {
          setSummaryError(
            "No summary in this session. Start from the dashboard.",
          );
          setSummaryLoading(false);
        }
        return;
      }

      const guestSummary = {
        id: "guest",
        title: session?.title || "Summary",
        output: session?.output || "",
        summarizeFor: session?.summarizeFor || "student",
        model: session?.model || "chatgpt",
        files: (session?.fileNames || []).map((name) => ({
          name,
          type: name.split(".").pop()?.toUpperCase() || "FILE",
        })),
        references: [],
        pinned: false,
        createdAt: new Date().toISOString(),
      };

      if (!cancelled) {
        setSummary(guestSummary);
        setSummaryLoading(false);
      }
    }

    void loadGuest();
    return () => {
      cancelled = true;
    };
  }, [
    isGuestMode,
    status,
    searchParams,
    setSummary,
    setSummaryLoading,
    setSummaryError,
  ]);

  useEffect(() => {
    if (!isGuestMode) return;
    if (status === "loading") return;
    if (summaryId == null) return;
    if (searchParams?.get("autostart") !== "1") return;

    const pending = consumeGuestPendingSummarize();
    if (!pending?.files?.length) return;

    let cancelled = false;

    async function run() {
      setSummarizeError("");
      setSummarizing(true);
      setSummarizePhase(SUMMARIZE_PHASE.EXTRACTING);
      setSummary((prev) =>
        prev
          ? { ...prev, output: "" }
          : {
              id: "guest",
              title:
                pending.files[0]?.name?.replace(/\.[^/.]+$/, "") || "Summary",
              output: "",
              summarizeFor: pending.options.summarizeFor || "student",
              model: pending.options.modelVariant
                ? `${pending.options.model}:${pending.options.modelVariant}`
                : pending.options.model,
              files: pending.files.map((f) => ({
                name: f.name,
                type: f.name.split(".").pop()?.toUpperCase() || "FILE",
              })),
              references: [],
            },
      );

      try {
        await runGuestSummarizeStream(pending.files, {
          ...pending.options,
          onStatus: (phase) => {
            if (!cancelled) setSummarizePhase(phase);
          },
          onChunk: (text) => {
            if (cancelled) return;
            setSummarizePhase(SUMMARIZE_PHASE.WRITING_SUMMARY);
            setSummary((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                output: String(prev.output || "") + text,
              };
            });
          },
        });

        if (!cancelled) {
          router.replace("/summary/guest");
        }
      } catch (e) {
        if (!cancelled) {
          setSummarizeError(e?.message ?? "Summarization failed");
        }
      } finally {
        if (!cancelled) {
          setSummarizing(false);
          setSummarizePhase(null);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isGuestMode,
    status,
    summaryId,
    searchParams,
    router,
    setSummary,
    setSummarizing,
    setSummarizePhase,
    setSummarizeError,
  ]);

  return isGuestMode;
}
