"use client";

import { useState, useCallback, useMemo } from "react";
import { CloseIcon, Spinner, TrashIcon } from "@/app/components/icons";
import "../flashcard-manual.css";

function sortCards(cards) {
  return [...(cards || [])].sort((a, b) => a.order - b.order);
}

export default function FlashcardSetEditor({
  flashcardSet,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onReorderCards,
}) {
  const cards = useMemo(
    () => sortCards(flashcardSet?.cards),
    [flashcardSet?.cards],
  );

  const [drafts, setDrafts] = useState({});
  const [rowBusy, setRowBusy] = useState(null);
  const [dragId, setDragId] = useState(null);

  const getDraft = (card) => {
    const d = drafts[card.id];
    return {
      front: d?.front ?? card.front ?? "",
      back: d?.back ?? card.back ?? "",
    };
  };

  const setDraftField = (cardId, field, value) => {
    setDrafts((prev) => {
      const card = cards.find((c) => c.id === cardId);
      const cur = prev[cardId] ?? {
        front: card?.front ?? "",
        back: card?.back ?? "",
      };
      return { ...prev, [cardId]: { ...cur, [field]: value } };
    });
  };

  const handleSaveRow = async (card) => {
    const { front, back } = getDraft(card);
    if (!front.trim() || !back.trim()) {
      alert("Front and back cannot be empty.");
      return;
    }
    setRowBusy(card.id);
    try {
      await onUpdateCard(flashcardSet.id, card.id, {
        front: front.trim(),
        back: back.trim(),
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async (card) => {
    const ok = window.confirm("Delete this card?");
    if (!ok) return;
    setRowBusy(card.id);
    try {
      await onDeleteCard(flashcardSet.id, card.id);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setRowBusy(null);
    }
  };

  const moveCard = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= cards.length) return;
    const ids = cards.map((c) => c.id);
    const tmp = ids[index];
    ids[index] = ids[next];
    ids[next] = tmp;
    setRowBusy(`move-${index}`);
    try {
      await onReorderCards(flashcardSet.id, ids);
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setRowBusy(null);
    }
  };

  const onDragStart = (cardId) => setDragId(cardId);

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = useCallback(
    async (targetId) => {
      if (dragId == null || dragId === targetId) {
        setDragId(null);
        return;
      }
      const ids = cards.map((c) => c.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) {
        setDragId(null);
        return;
      }
      ids.splice(from, 1);
      ids.splice(to, 0, dragId);
      setDragId(null);
      setRowBusy("reorder");
      try {
        await onReorderCards(flashcardSet.id, ids);
      } catch (e) {
        alert(e?.message || String(e));
      } finally {
        setRowBusy(null);
      }
    },
    [dragId, cards, flashcardSet.id, onReorderCards],
  );

  return (
    <div
      className="fc-editor-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="fc-editor-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fc-editor-title"
      >
        <header className="fc-editor-head">
          <div
            id="fc-editor-title"
            className="fc-editor-title"
            title={flashcardSet?.title}
          >
            Edit: {flashcardSet?.title || "Flashcards"}
          </div>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            disabled={rowBusy != null}
            onClick={onClose}
            aria-label="Done"
          >
            <CloseIcon size={14} /> Done
          </button>
        </header>

        <div className="fc-editor-body">
          {cards.length === 0 ? (
            <p style={{ opacity: 0.7, fontSize: 13 }}>
              No cards in this set. Use Create flashcard to add one.
            </p>
          ) : (
            cards.map((card, index) => {
              const globalBusy = rowBusy != null;
              const busy =
                globalBusy ||
                rowBusy === card.id ||
                rowBusy === `move-${index}` ||
                rowBusy === "reorder";
              const draft = getDraft(card);
              const dirty =
                draft.front !== (card.front ?? "") ||
                draft.back !== (card.back ?? "");

              return (
                <div
                  key={card.id}
                  className={`fc-editor-card${dragId === card.id ? " fc-editor-card--dragging" : ""}`}
                  draggable={!globalBusy}
                  onDragStart={() => !globalBusy && onDragStart(card.id)}
                  onDragOver={globalBusy ? undefined : onDragOver}
                  onDrop={globalBusy ? undefined : () => void onDrop(card.id)}
                >
                  <div className="fc-editor-card-head">
                    <span
                      className="fc-editor-drag-handle"
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </span>
                    <span className="fc-editor-card-num">Card {index + 1}</span>
                    <div className="fc-editor-card-actions">
                      <button
                        type="button"
                        className="fc-editor-mini-btn"
                        disabled={busy || index === 0}
                        onClick={() => void moveCard(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="fc-editor-mini-btn"
                        disabled={busy || index === cards.length - 1}
                        onClick={() => void moveCard(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="fc-editor-mini-btn fc-editor-mini-btn--danger"
                        disabled={busy}
                        onClick={() => void handleDelete(card)}
                        aria-label="Delete card"
                        title="Delete card"
                      >
                        {rowBusy === card.id ? (
                          <Spinner size={12} />
                        ) : (
                          <TrashIcon size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                  <input
                    className="fc-editor-field"
                    value={draft.front}
                    onChange={(e) =>
                      setDraftField(card.id, "front", e.target.value)
                    }
                    placeholder="Question / term"
                    disabled={busy}
                  />
                  <textarea
                    className="fc-editor-field fc-editor-field--area"
                    value={draft.back}
                    onChange={(e) =>
                      setDraftField(card.id, "back", e.target.value)
                    }
                    placeholder="Answer / definition"
                    disabled={busy}
                  />
                  {dirty && (
                    <div className="fc-editor-save-row">
                      <button
                        type="button"
                        className="fc-editor-mini-btn"
                        disabled={busy}
                        onClick={() => void handleSaveRow(card)}
                      >
                        {rowBusy === card.id ? (
                          <>
                            <Spinner size={10} /> Saving…
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
