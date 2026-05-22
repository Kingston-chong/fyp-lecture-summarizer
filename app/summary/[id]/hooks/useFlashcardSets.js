"use client";

import { useState, useCallback, useEffect } from "react";
import { parseNumericSummaryId } from "../helpers";

const NEW_SET_VALUE = "__new__";

export { NEW_SET_VALUE };

export function useFlashcardSets({
  summaryId,
  status,
  setFlashcardData,
  setFlashcardView,
}) {
  const numericSummaryId = parseNumericSummaryId(summaryId);
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [flashcardSetsLoading, setFlashcardSetsLoading] = useState(false);
  const [flashcardSetOpeningId, setFlashcardSetOpeningId] = useState(null);
  const [flashcardSetDeletingId, setFlashcardSetDeletingId] = useState(null);
  const [flashcardEditorSet, setFlashcardEditorSet] = useState(null);
  const [flashcardEditorLoading, setFlashcardEditorLoading] = useState(false);

  const fetchFlashcardSets = useCallback(async () => {
    if (!numericSummaryId) return;
    setFlashcardSetsLoading(true);
    try {
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets`,
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.flashcardSets)) {
        setFlashcardSets(data.flashcardSets);
      } else {
        setFlashcardSets([]);
      }
    } catch {
      setFlashcardSets([]);
    } finally {
      setFlashcardSetsLoading(false);
    }
  }, [numericSummaryId]);

  useEffect(() => {
    if (status !== "authenticated" || !numericSummaryId) return;
    void fetchFlashcardSets();
  }, [status, numericSummaryId, fetchFlashcardSets]);

  const fetchSetDetails = useCallback(
    async (setId) => {
      if (!numericSummaryId || !setId) return null;
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.flashcardSet) return null;
      return data.flashcardSet;
    },
    [numericSummaryId],
  );

  const syncFlashcardDataIfOpen = useCallback(
    (flashcardSet) => {
      if (!flashcardSet || typeof setFlashcardData !== "function") return;
      setFlashcardData((prev) =>
        prev?.id === flashcardSet.id ? flashcardSet : prev,
      );
    },
    [setFlashcardData],
  );

  const openFlashcardSet = useCallback(
    async (setId) => {
      if (!numericSummaryId || !setId) return;
      setFlashcardSetOpeningId(setId);
      try {
        const flashcardSet = await fetchSetDetails(setId);
        if (!flashcardSet) {
          console.warn("Failed to load flashcard set");
          return;
        }
        setFlashcardData(flashcardSet);
        setFlashcardView(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setFlashcardSetOpeningId(null);
      }
    },
    [
      numericSummaryId,
      fetchSetDetails,
      setFlashcardData,
      setFlashcardView,
    ],
  );

  const openFlashcardSetEditor = useCallback(
    async (setId) => {
      if (!numericSummaryId || !setId) return;
      setFlashcardEditorLoading(true);
      try {
        const flashcardSet = await fetchSetDetails(setId);
        if (!flashcardSet) {
          alert("Could not load flashcard set");
          return;
        }
        setFlashcardEditorSet(flashcardSet);
      } catch (e) {
        alert(e?.message || String(e));
      } finally {
        setFlashcardEditorLoading(false);
      }
    },
    [numericSummaryId, fetchSetDetails],
  );

  const closeFlashcardSetEditor = useCallback(() => {
    setFlashcardEditorSet(null);
  }, []);

  const deleteFlashcardSet = useCallback(
    async (set) => {
      const setId = Number.parseInt(String(set?.id ?? ""), 10);
      if (!Number.isFinite(setId) || setId <= 0) return;
      const ok = window.confirm(
        `Delete flashcard set "${String(set?.title || "Flashcards")}"?`,
      );
      if (!ok) return;
      if (!numericSummaryId) {
        alert("Invalid summary id");
        return;
      }
      setFlashcardSetDeletingId(setId);
      try {
        const res = await fetch(
          `/api/summary/${numericSummaryId}/flashcard-sets/${setId}`,
          { method: "DELETE" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Delete failed");
        setFlashcardSets((prev) => prev.filter((s) => s.id !== setId));
        if (flashcardEditorSet?.id === setId) setFlashcardEditorSet(null);
        setFlashcardData((prev) => {
          if (prev?.id === setId) {
            setFlashcardView(false);
            return null;
          }
          return prev;
        });
      } catch (e) {
        alert(e?.message || String(e));
      } finally {
        setFlashcardSetDeletingId(null);
      }
    },
    [
      numericSummaryId,
      flashcardEditorSet,
      setFlashcardData,
      setFlashcardView,
    ],
  );

  const createFlashcardSet = useCallback(
    async (title) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "My flashcards" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create set");
      await fetchFlashcardSets();
      return data.flashcardSet;
    },
    [numericSummaryId, fetchFlashcardSets],
  );

  const addCard = useCallback(
    async (setId, { front, back, atPosition }) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}/cards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front, back, atPosition }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to add card");
      const flashcardSet = data.flashcardSet;
      syncFlashcardDataIfOpen(flashcardSet);
      if (flashcardEditorSet?.id === setId) setFlashcardEditorSet(flashcardSet);
      await fetchFlashcardSets();
      return flashcardSet;
    },
    [
      numericSummaryId,
      syncFlashcardDataIfOpen,
      flashcardEditorSet,
      fetchFlashcardSets,
    ],
  );

  const updateCard = useCallback(
    async (setId, cardId, payload = {}) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const body = {};
      if (payload.front !== undefined) body.front = payload.front;
      if (payload.back !== undefined) body.back = payload.back;
      if (payload.studyStatus !== undefined) body.studyStatus = payload.studyStatus;
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}/cards/${cardId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update card");
      const flashcardSet = data.flashcardSet;
      syncFlashcardDataIfOpen(flashcardSet);
      if (flashcardEditorSet?.id === setId) setFlashcardEditorSet(flashcardSet);
      return flashcardSet;
    },
    [numericSummaryId, syncFlashcardDataIfOpen, flashcardEditorSet],
  );

  const deleteCard = useCallback(
    async (setId, cardId) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}/cards/${cardId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete card");
      const flashcardSet = data.flashcardSet;
      syncFlashcardDataIfOpen(flashcardSet);
      if (flashcardEditorSet?.id === setId) setFlashcardEditorSet(flashcardSet);
      await fetchFlashcardSets();
      return flashcardSet;
    },
    [
      numericSummaryId,
      syncFlashcardDataIfOpen,
      flashcardEditorSet,
      fetchFlashcardSets,
    ],
  );

  const resetStudyProgress = useCallback(
    async (setId) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}/study-progress`,
        { method: "PUT" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reset study progress");
      }
      const flashcardSet = data.flashcardSet;
      syncFlashcardDataIfOpen(flashcardSet);
      return flashcardSet;
    },
    [numericSummaryId, syncFlashcardDataIfOpen],
  );

  const reorderCards = useCallback(
    async (setId, cardIds) => {
      if (!numericSummaryId) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${numericSummaryId}/flashcard-sets/${setId}/cards/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardIds }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to reorder");
      const flashcardSet = data.flashcardSet;
      syncFlashcardDataIfOpen(flashcardSet);
      if (flashcardEditorSet?.id === setId) setFlashcardEditorSet(flashcardSet);
      return flashcardSet;
    },
    [numericSummaryId, syncFlashcardDataIfOpen, flashcardEditorSet],
  );

  return {
    flashcardSets,
    flashcardSetsLoading,
    flashcardSetOpeningId,
    flashcardSetDeletingId,
    flashcardEditorSet,
    flashcardEditorLoading,
    fetchFlashcardSets,
    fetchSetDetails,
    openFlashcardSet,
    openFlashcardSetEditor,
    closeFlashcardSetEditor,
    deleteFlashcardSet,
    createFlashcardSet,
    addCard,
    updateCard,
    resetStudyProgress,
    deleteCard,
    reorderCards,
  };
}
