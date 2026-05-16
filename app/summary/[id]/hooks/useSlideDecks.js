"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { parseNumericSummaryId } from "../helpers";

export function useSlideDecks({ summaryId, status }) {
  const numericSummaryId = parseNumericSummaryId(summaryId);
  const [slideDecks, setSlideDecks] = useState([]);
  const [slideDecksLoading, setSlideDecksLoading] = useState(false);
  const [slideDeckDeletingId, setSlideDeckDeletingId] = useState(null);
  const [slideDeckPreviewOpen, setSlideDeckPreviewOpen] = useState(false);
  const [slideDeckPreviewUrl, setSlideDeckPreviewUrl] = useState("");
  const [slideDeckRemotePptUrl, setSlideDeckRemotePptUrl] = useState("");
  const [slideDeckPreviewTitle, setSlideDeckPreviewTitle] = useState("");
  const slideDeckDlRef = useRef(null);
  const slideDeckPdfDlRef = useRef(null);

  function deckDownloadFilename(title, ext) {
    const base =
      String(title || "presentation")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase() || "presentation";
    return `${base}.${ext}`;
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  async function openSlideDeckPreview(deck) {
    setSlideDeckPreviewUrl("");
    setSlideDeckPreviewTitle(
      String(deck.title || "Presentation").trim() || "Presentation",
    );
    slideDeckDlRef.current = async () => {
      await downloadSlideDeck(deck);
    };
    slideDeckPdfDlRef.current = async () => {
      await downloadSlideDeckPdf(deck);
    };
    setSlideDeckPreviewOpen(true);
    try {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/slide-decks/${deck.id}/view-token`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not prepare preview");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const viewUrl = `${origin}/api/summary/${numericSummaryId}/slide-decks/${deck.id}/view?t=${encodeURIComponent(
        data.token,
      )}`;
      setSlideDeckRemotePptUrl(viewUrl);
    } catch (e) {
      setSlideDeckRemotePptUrl("");
      alert(e?.message || String(e));
    }
  }

  async function downloadSlideDeck(deck) {
    try {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const r = await fetch(
        `/api/summary/${numericSummaryId}/slide-decks/${deck.id}/view?v=${Date.now()}`,
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "Download failed");
      }
      const blob = await r.blob();
      triggerBlobDownload(blob, deckDownloadFilename(deck.title, "pptx"));
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  async function downloadSlideDeckPdf(deck) {
    try {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const r = await fetch(
        `/api/summary/${numericSummaryId}/slide-decks/${deck.id}/pdf?v=${Date.now()}`,
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "PDF download failed");
      }
      const blob = await r.blob();
      triggerBlobDownload(blob, deckDownloadFilename(deck.title, "pdf"));
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
