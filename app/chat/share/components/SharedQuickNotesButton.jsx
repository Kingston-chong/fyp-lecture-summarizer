"use client";

import { useState } from "react";
import { Spinner } from "@/app/components/icons";
import {
  buildRevisionSheetHtml,
  downloadRevisionSheetPdf,
} from "@/app/summary/[id]/lib/revisionSheetPdf";

/**
 * Generate quick revision notes from shared summary and download PDF.
 */
export default function SharedQuickNotesButton({ token, snapshot }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasSummary = Boolean(snapshot?.summaryOutput?.trim());
  const isStudent =
    String(snapshot?.summarizeFor || "").toLowerCase() === "student";

  if (!hasSummary || !isStudent) return null;

  async function handleGenerate() {
    if (!token || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/chat/share/${encodeURIComponent(token)}/quick-notes`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not generate quick notes.");
      }
      const html = buildRevisionSheetHtml({
        title: data.title || snapshot.title,
        markdown: data.markdown || "",
      });
      await downloadRevisionSheetPdf(html, data.title || snapshot.title);
    } catch (e) {
      setError(e?.message || "Could not generate quick notes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-share-quick-notes">
      <button
        type="button"
        className="chat-share-btn chat-share-btn--notes"
        onClick={() => void handleGenerate()}
        disabled={loading}
      >
        {loading ? (
          <>
            <Spinner size={14} /> Generating quick notes…
          </>
        ) : (
          "Download quick notes (PDF)"
        )}
      </button>
      <p className="chat-share-quick-notes-hint">
        AI-generated study notes from this summary — saves as PDF when ready.
      </p>
      {error ? (
        <p className="chat-share-quick-notes-err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
