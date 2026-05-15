"use client";

import { Spinner } from "@/app/components/icons";
import { formatSlideDeckSavedAt } from "../helpers";

export default function SlideDecksPanel({
  slideDecks,
  slideDecksLoading,
  slideDeckDeletingId,
  onRefresh,
  onPreview,
  onDownload,
  onDelete,
  panelClassName = "hl-panel sd-panel sd-panel--sources",
}) {
  return (
    <div className={panelClassName} aria-label="Saved slide decks">
      <div className="hl-head-row">
        <div className="hl-head">SLIDE DECKS</div>
        <button
          type="button"
          className="sd-refresh-btn"
          title="Refresh slide decks"
          disabled={slideDecksLoading}
          onClick={onRefresh}
        >
          {slideDecksLoading ? <Spinner size={11} /> : "↻"}
        </button>
      </div>
      <div className="sd-deck-list">
        {slideDecksLoading && slideDecks.length === 0 ? (
          <div className="hl-empty">
            <Spinner size={12} /> Loading…
          </div>
        ) : slideDecks.length === 0 ? (
          <div className="hl-empty">
            None yet. Generate slides — a copy saves here automatically.
          </div>
        ) : (
          slideDecks.map((d) => (
            <div key={d.id} className="sd-deck-row">
              <div className="sd-deck-title" title={d.title}>
                {d.title}
              </div>
              <div className="sd-deck-meta">
                {formatSlideDeckSavedAt(d.createdAt)}
              </div>
              <div className="sd-deck-actions">
                <button
                  type="button"
                  className="sd-deck-btn"
                  onClick={() => onPreview(d)}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="sd-deck-btn"
                  onClick={() => onDownload(d)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="sd-deck-btn"
                  disabled={slideDeckDeletingId === d.id}
                  onClick={() => onDelete(d)}
                >
                  {slideDeckDeletingId === d.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
