"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CloseIcon,
  EditIcon,
  Spinner,
  TrashIcon,
} from "@/app/components/icons";
import { flashcardRatingsFromCards } from "@/lib/flashcardStudyStatus";

function sortCards(cards) {
  return [...(cards || [])].sort((a, b) => a.order - b.order);
}

export default function FlashcardStudyView({
  flashcardSet,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onResetStudyProgress,
  onFlashcardSetChange,
}) {
  const cards = useMemo(
    () =>
      Array.isArray(flashcardSet?.cards) ? sortCards(flashcardSet.cards) : [],
    [flashcardSet?.cards],
  );

  const [deck, setDeck] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState(() => new Set());
  const [unknownIds, setUnknownIds] = useState(() => new Set());
  const [sessionComplete, setSessionComplete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDeck(cards);
  }, [cards]);

  useEffect(() => {
    const { knownIds: known, unknownIds: unknown } =
      flashcardRatingsFromCards(cards);
    setKnownIds(known);
    setUnknownIds(unknown);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionComplete(false);
    setEditing(false);
  }, [flashcardSet?.id]);

  const current = deck[currentIndex];
  const total = deck.length;

  const goNext = useCallback(() => {
    if (deleting) return;
    setFlipped(false);
    setEditing(false);
    if (currentIndex >= total - 1) {
      setSessionComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, total, deleting]);

  const goPrev = useCallback(() => {
    if (deleting || currentIndex <= 0) return;
    setFlipped(false);
    setEditing(false);
    setCurrentIndex((i) => i - 1);
  }, [currentIndex, deleting]);

  const currentRating = useMemo(() => {
    if (!current) return null;
    if (knownIds.has(current.id)) return "known";
    if (unknownIds.has(current.id)) return "learning";
    return null;
  }, [current, knownIds, unknownIds]);

  const persistStudyStatus = useCallback(
    async (cardId, studyStatus) => {
      if (!cardId || !flashcardSet?.id || typeof onUpdateCard !== "function") {
        return;
      }
      try {
        const updated = await onUpdateCard(flashcardSet.id, cardId, {
          studyStatus,
        });
        if (updated) onFlashcardSetChange?.(updated);
      } catch (e) {
        console.warn("Failed to save study status:", e);
        if (studyStatus === "known") {
          setKnownIds((prev) => {
            const next = new Set(prev);
            next.delete(cardId);
            return next;
          });
        } else {
          setUnknownIds((prev) => {
            const next = new Set(prev);
            next.delete(cardId);
            return next;
          });
        }
      }
    },
    [flashcardSet?.id, onUpdateCard, onFlashcardSetChange],
  );

  const markKnown = useCallback(() => {
    if (!current || editing || deleting) return;
    const cardId = current.id;
    setKnownIds((prev) => new Set(prev).add(cardId));
    setUnknownIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    void persistStudyStatus(cardId, "known");
    goNext();
  }, [current, editing, deleting, goNext, persistStudyStatus]);

  const markUnknown = useCallback(() => {
    if (!current || editing || deleting) return;
    const cardId = current.id;
    setUnknownIds((prev) => new Set(prev).add(cardId));
    setKnownIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    void persistStudyStatus(cardId, "learning");
    goNext();
  }, [current, editing, deleting, goNext, persistStudyStatus]);

  const startEdit = useCallback(() => {
    if (!current || typeof onUpdateCard !== "function") return;
    setEditFront(current.front ?? "");
    setEditBack(current.back ?? "");
    setEditError("");
    setEditing(true);
    setFlipped(false);
  }, [current, onUpdateCard]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditError("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!current || !flashcardSet?.id) return;
    const front = editFront.trim();
    const back = editBack.trim();
    if (!front || !back) {
      setEditError("Question and answer cannot be empty.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const cardId = current.id;
      const updated = await onUpdateCard(flashcardSet.id, cardId, {
        front,
        back,
      });
      const nextDeck = sortCards(updated?.cards ?? deck);
      setDeck(nextDeck);
      const idx = nextDeck.findIndex((c) => c.id === cardId);
      if (idx >= 0) setCurrentIndex(idx);
      onFlashcardSetChange?.(updated);
      setEditing(false);
    } catch (e) {
      setEditError(e?.message || String(e));
    } finally {
      setEditSaving(false);
    }
  }, [
    current,
    flashcardSet?.id,
    editFront,
    editBack,
    onUpdateCard,
    onFlashcardSetChange,
    deck,
  ]);

  const retryUnknown = useCallback(() => {
    const unknown = cards.filter((c) => unknownIds.has(c.id));
    if (unknown.length === 0) return;
    setDeck(unknown);
    setCurrentIndex(0);
    setFlipped(false);
    setEditing(false);
    setSessionComplete(false);
  }, [cards, unknownIds]);

  const studyAgain = useCallback(async () => {
    if (flashcardSet?.id && typeof onResetStudyProgress === "function") {
      try {
        const updated = await onResetStudyProgress(flashcardSet.id);
        if (updated) {
          onFlashcardSetChange?.(updated);
          const sorted = sortCards(updated.cards);
          setDeck(sorted);
          setKnownIds(new Set());
          setUnknownIds(new Set());
          setCurrentIndex(0);
          setFlipped(false);
          setSessionComplete(false);
          setEditing(false);
          return;
        }
      } catch (e) {
        console.warn("Failed to reset study progress:", e);
      }
    }
    setDeck(cards);
    setCurrentIndex(0);
    setFlipped(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setSessionComplete(false);
    setEditing(false);
  }, [cards, flashcardSet?.id, onResetStudyProgress, onFlashcardSetChange]);

  useEffect(() => {
    const onKey = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (sessionComplete || editing || deleting) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionComplete, editing, deleting, goNext, goPrev]);

  const canEdit = typeof onUpdateCard === "function";
  const canDelete = typeof onDeleteCard === "function";

  const handleDeleteCard = useCallback(async () => {
    if (!current || !flashcardSet?.id || !canDelete || deleting || editing) {
      return;
    }
    if (!window.confirm("Delete this card?")) return;

    const cardId = current.id;
    setDeleting(true);
    try {
      const updated = await onDeleteCard(flashcardSet.id, cardId);
      const nextDeck = sortCards(updated?.cards ?? []);
      onFlashcardSetChange?.(updated);
      setKnownIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      setUnknownIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      setDeck(nextDeck);
      setFlipped(false);
      setEditing(false);
      setSessionComplete(false);
      if (nextDeck.length === 0) {
        setCurrentIndex(0);
        return;
      }
      setCurrentIndex((i) => Math.min(i, nextDeck.length - 1));
    } catch (e) {
      console.warn("Failed to delete card:", e);
      window.alert(e?.message || "Failed to delete card");
    } finally {
      setDeleting(false);
    }
  }, [
    current,
    flashcardSet?.id,
    canDelete,
    deleting,
    editing,
    onDeleteCard,
    onFlashcardSetChange,
  ]);

  if (!cards.length) {
    return (
      <div className="fc-study-view" role="dialog" aria-modal="true">
        <div className="fc-study-inner">
          <p>No cards in this set.</p>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const knownCount = cards.filter((c) => knownIds.has(c.id)).length;
    const unknownCount = cards.filter((c) => unknownIds.has(c.id)).length;
    return (
      <div className="fc-study-view" role="dialog" aria-modal="true">
        <div className="fc-study-inner fc-session-end">
          <h2 className="fc-session-title">Session complete</h2>
          <p className="fc-session-stats">
            {knownCount} / {cards.length} cards known
            {unknownCount > 0 ? ` · ${unknownCount} still learning` : ""}
          </p>
          <div className="fc-session-actions">
            {unknownCount > 0 && (
              <button
                type="button"
                className="fc-btn fc-btn--learn"
                onClick={retryUnknown}
              >
                Retry unknown
              </button>
            )}
            <button
              type="button"
              className="fc-btn fc-btn--ghost"
              onClick={() => void studyAgain()}
            >
              Study again
            </button>
            <button
              type="button"
              className="fc-btn fc-btn--know"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const studyBusy = editing || deleting;

  return (
    <div className="fc-study-view" role="dialog" aria-modal="true">
      <div
        className={`fc-study-inner${deleting ? " fc-study-inner--busy" : ""}`}
      >
        <header className="fc-header">
          <button
            type="button"
            className="fc-back-btn"
            disabled={deleting}
            onClick={onClose}
            aria-label="Back"
          >
            ← Back
          </button>
          <div className="fc-header-title" title={flashcardSet?.title}>
            {flashcardSet?.title || "Flashcards"}
          </div>
          <div className="fc-header-count">
            {currentIndex + 1} / {total}
          </div>
          <button
            type="button"
            className="fc-close-btn"
            disabled={deleting}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </header>

        <div className="fc-progress-dots" aria-hidden>
          {deck.map((c, i) => (
            <span
              key={c.id}
              className={`fc-dot${i === currentIndex ? " fc-dot--active" : ""}${knownIds.has(c.id) ? " fc-dot--known" : ""}${unknownIds.has(c.id) ? " fc-dot--unknown" : ""}`}
            />
          ))}
        </div>

        <div className="fc-card-wrap">
          {!editing && (canEdit || canDelete) && (
            <div className="fc-card-toolbar">
              {canEdit && (
                <button
                  type="button"
                  className="fc-card-tool-btn"
                  disabled={deleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit();
                  }}
                  aria-label="Edit this card"
                  title="Edit card"
                >
                  <EditIcon size={15} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="fc-card-tool-btn fc-card-tool-btn--danger"
                  disabled={deleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteCard();
                  }}
                  aria-label="Delete this card"
                  title="Delete card"
                >
                  {deleting ? <Spinner size={14} /> : <TrashIcon size={15} />}
                </button>
              )}
            </div>
          )}

          {editing ? (
            <div className="fc-card-edit-panel">
              <label className="fc-card-edit-label" htmlFor="fc-edit-front">
                Question / term
              </label>
              <textarea
                id="fc-edit-front"
                className="fc-card-edit-input"
                rows={2}
                value={editFront}
                onChange={(e) => setEditFront(e.target.value)}
                disabled={editSaving}
              />
              <label className="fc-card-edit-label" htmlFor="fc-edit-back">
                Answer
              </label>
              <textarea
                id="fc-edit-back"
                className="fc-card-edit-input fc-card-edit-input--area"
                rows={3}
                value={editBack}
                onChange={(e) => setEditBack(e.target.value)}
                disabled={editSaving}
              />
              {editError && <p className="fc-card-edit-error">{editError}</p>}
              <div className="fc-card-edit-actions">
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  disabled={editSaving}
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fc-btn fc-btn--know"
                  disabled={editSaving}
                  onClick={() => void saveEdit()}
                >
                  {editSaving ? (
                    <>
                      <Spinner size={12} /> Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`fc-card${flipped ? " flipped" : ""}`}
              disabled={studyBusy}
              onClick={() => setFlipped((f) => !f)}
              aria-pressed={flipped}
            >
              <div className="fc-card-face fc-card-front">
                <span className="fc-card-label">Term</span>
                <p className="fc-card-text">{current?.front}</p>
                <span className="fc-card-hint">Click or Space to flip</span>
              </div>
              <div className="fc-card-face fc-card-back">
                <span className="fc-card-label">Answer</span>
                <p className="fc-card-text">{current?.back}</p>
              </div>
            </button>
          )}
        </div>

        <div className="fc-actions fc-actions--study">
          <button
            type="button"
            className={`fc-btn fc-btn--know${currentRating === "known" ? " fc-btn--selected" : ""}`}
            disabled={studyBusy}
            aria-pressed={currentRating === "known"}
            onClick={markKnown}
          >
            Know it
          </button>
          <button
            type="button"
            className={`fc-btn fc-btn--learn${currentRating === "learning" ? " fc-btn--selected" : ""}`}
            disabled={studyBusy}
            aria-pressed={currentRating === "learning"}
            onClick={markUnknown}
          >
            Still learning
          </button>
        </div>

        <div className="fc-nav-row fc-nav-row--study">
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            disabled={currentIndex === 0 || studyBusy}
            onClick={goPrev}
          >
            Previous
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            disabled={studyBusy}
            onClick={() => setFlipped((f) => !f)}
          >
            {flipped ? "Show front" : "Flip"}
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--ghost"
            disabled={studyBusy}
            onClick={goNext}
            title="Next card"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
