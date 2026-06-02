"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { isViewTokenUnavailableStatus } from "@/lib/viewTokenPreview";
import { parseNumericSummaryId } from "../helpers";

export function useSlideDecks({ summaryId, status }) {
  const numericSummaryId = parseNumericSummaryId(summaryId);
  const [slideDecks, setSlideDecks] = useState([]);
  const [slideDecksLoading, setSlideDecksLoading] = useState(false);
  const [slideDeckDeletingId, setSlideDeckDeletingId] = useState(null);
  const [slideDeckPreviewOpen, setSlideDeckPreviewOpen] = useState(false);
  const [slideDeckPreviewUrl, setSlideDeckPreviewUrl] = useState("");
  const [slideDeckRemotePptUrl, setSlideDeckRemotePptUrl] = useState("");
  const [slideDeckPreviewLoading, setSlideDeckPreviewLoading] = useState(false);
  const [slideDeckPreviewUnavailable, setSlideDeckPreviewUnavailable] =
    useState(false);
  const [slideDeckPreviewTitle, setSlideDeckPreviewTitle] = useState("");
  const slideDeckDlRef = useRef(null);
  const slideDeckPdfDlRef = useRef(null);
  const slideDeckViewTokenRef = useRef(null);

  function filenameFromContentDisposition(cd, fallback) {
    const match = String(cd || "").match(/filename="?([^"]+)"?/i);
    return match?.[1] || fallback;
  }

  /** Native navigation download — streams from CDN, does not buffer in JS. */
  function triggerNativeDownload(deck, viewToken) {
    if (!numericSummaryId) throw new Error("Invalid summary id");
    const base = `/api/summary/${numericSummaryId}/slide-decks/${deck.id}/download`;
    const qs = viewToken
      ? `t=${encodeURIComponent(viewToken)}`
      : `v=${Date.now()}`;
    const a = document.createElement("a");
    a.href = `${base}?${qs}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const fetchSlideDecks = useCallback(async () => {
    if (!numericSummaryId) return;
    setSlideDecksLoading(true);
    try {
      const res = await fetch(`/api/summary/${numericSummaryId}/slide-decks`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.decks)) setSlideDecks(data.decks);
      else setSlideDecks([]);
    } catch {
      setSlideDecks([]);
    } finally {
      setSlideDecksLoading(false);
    }
  }, [numericSummaryId]);

  useEffect(() => {
    if (status !== "authenticated" || !numericSummaryId) return;
    void fetchSlideDecks();
  }, [status, numericSummaryId, fetchSlideDecks]);

  async function downloadSlideDeckPdf(deck) {
    if (!numericSummaryId) throw new Error("Invalid summary id");
    const deckId = Number.parseInt(String(deck?.id ?? ""), 10);
    if (!Number.isFinite(deckId) || deckId <= 0) {
      throw new Error("Invalid slide deck");
    }
    const res = await fetch(
      `/api/summary/${numericSummaryId}/slide-decks/${deckId}/pdf?v=${Date.now()}`,
    );
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let message = "Could not download PDF";
      if (contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        message = data?.error || message;
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const slug =
      String(deck.title || "presentation")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "slides";
    const filename = filenameFromContentDisposition(
      res.headers.get("content-disposition"),
      `${slug}.pdf`,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function openSlideDeckPreview(deck) {
    setSlideDeckPreviewUrl("");
    setSlideDeckRemotePptUrl("");
    setSlideDeckPreviewUnavailable(false);
    setSlideDeckPreviewTitle(
      String(deck.title || "Presentation").trim() || "Presentation",
    );
    slideDeckViewTokenRef.current = null;
    slideDeckDlRef.current = () => {
      downloadSlideDeck(deck, slideDeckViewTokenRef.current);
    };
    slideDeckPdfDlRef.current = async () => {
      await downloadSlideDeckPdf(deck);
    };
    setSlideDeckPreviewOpen(true);
    setSlideDeckPreviewLoading(true);
    try {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/slide-decks/${deck.id}/view-token`,
      );
      const data = await res.json().catch(() => ({}));
      if (isViewTokenUnavailableStatus(res.status)) {
        setSlideDeckPreviewUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Could not prepare preview");
      slideDeckViewTokenRef.current = data.token;
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const viewUrl = `${origin}/api/summary/${numericSummaryId}/slide-decks/${deck.id}/view?t=${encodeURIComponent(
        data.token,
      )}`;
      setSlideDeckRemotePptUrl(viewUrl);
    } catch (e) {
      setSlideDeckRemotePptUrl("");
      alert(e?.message || String(e));
    } finally {
      setSlideDeckPreviewLoading(false);
    }
  }

  function downloadSlideDeck(deck, viewToken = null) {
    try {
      triggerNativeDownload(deck, viewToken);
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  async function deleteSlideDeck(deck) {
    const deckId = Number.parseInt(String(deck?.id ?? ""), 10);
    if (!Number.isFinite(deckId) || deckId <= 0) return;
    const ok = window.confirm(
      `Delete slide deck "${String(deck?.title || "Presentation")}"?`,
    );
    if (!ok) return;
    if (!numericSummaryId) {
      alert("Invalid summary id");
      return;
    }
    setSlideDeckDeletingId(deckId);
    try {
      const res = await fetch(`/api/summary/${numericSummaryId}/slide-decks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setSlideDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSlideDeckDeletingId(null);
    }
  }

  return {
    slideDecks,
    slideDecksLoading,
    slideDeckDeletingId,
    slideDeckPreviewOpen,
    setSlideDeckPreviewOpen,
    slideDeckPreviewUrl,
    slideDeckRemotePptUrl,
    slideDeckPreviewLoading,
    slideDeckPreviewUnavailable,
    slideDeckPreviewTitle,
    slideDeckDlRef,
    slideDeckPdfDlRef,
    fetchSlideDecks,
    openSlideDeckPreview,
    downloadSlideDeck,
    downloadSlideDeckPdf,
    deleteSlideDeck,
  };
}
