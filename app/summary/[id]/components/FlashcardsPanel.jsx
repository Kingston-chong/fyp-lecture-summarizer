"use client";

import { Spinner } from "@/app/components/icons";
import { formatSlideDeckSavedAt } from "../helpers";

export default function FlashcardsPanel({
  flashcardSets,
  flashcardSetsLoading,
  flashcardSetOpeningId,
  flashcardSetDeletingId,
  onRefresh,
  onOpenSet,
  onEditSet,
  onDeleteSet,
  flashcardEditorLoading = false,
  panelClassName = "hl-panel sd-panel sd-panel--sources",
  showHelpText = true,
  embedded = false,
}) {
  return (
    <div className={panelClassName} aria-label="Saved flashcards">
      {!embedded && (
        <div className="hl-head-row">
          <div className="hl-head">SAVED FLASHCARDS</div>
          <button
            type="button"
            className="sd-refresh-btn"
            title="Refresh saved flashcards"
            disabled={flashcardSetsLoading}
            onClick={onRefresh}
          >
            {flashcardSetsLoading ? <Spinner size={11} /> : "↻"}
          </button>
        </div>
      )}
      {showHelpText && !embedded && (
        <div className="hl-sub" style={{ marginTop: -4, marginBottom: 6 }}>
          Flashcard sets are saved here. Create your own cards, edit a set, or
          open one to study.
        </div>
      )}
      <div className="sd-deck-list">
        {flashcardSetsLoading && flashcardSets.length === 0 ? (
          <div className="hl-empty">
            <Spinner size={12} /> Loading…
          </div>
        ) : flashcardSets.length === 0 ? (
          <div className="hl-empty">
            None yet. Generate or create flashcards — they save here
            automatically.
          </div>
        ) : (
          flashcardSets.map((s) => (
            <div key={s.id} className="sd-deck-row">
              <div className="sd-deck-title" title={s.title}>
                {s.title}
              </div>
              <div className="sd-deck-meta">
                {formatSlideDeckSavedAt(s.createdAt)}
                {typeof s._count?.cards === "number"
                  ? ` · ${s._count.cards} cards`
                  : ""}
              </div>
              <div className="sd-deck-actions">
                <button
                  type="button"
                  className="sd-deck-btn"
                  disabled={flashcardSetOpeningId === s.id}
                  onClick={() => onOpenSet(s.id)}
                >
                  {flashcardSetOpeningId === s.id ? "…" : "Open"}
                </button>
                {typeof onEditSet === "function" && (
                  <button
                    type="button"
                    className="sd-deck-btn"
                    disabled={flashcardEditorLoading}
                    onClick={() => onEditSet(s.id)}
                  >
                    Edit All
                  </button>
                )}
                <button
                  type="button"
                  className="sd-deck-btn"
                  disabled={flashcardSetDeletingId === s.id}
                  onClick={() => onDeleteSet(s)}
                >
                  {flashcardSetDeletingId === s.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
