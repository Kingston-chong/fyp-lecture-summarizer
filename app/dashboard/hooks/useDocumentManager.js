"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swrFetcher";

const EMPTY_DOCS = [];

/**
 * Previous uploads list + selection + delete handlers (dashboard).
 * @param {{ status: string; setError: (msg: string) => void; setSelectedFiles: React.Dispatch<React.SetStateAction<unknown[]>> }} options
 */
export function useDocumentManager({ status, setError, setSelectedFiles }) {
  const {
    data: uploadsData,
    isLoading: prevLoading,
    mutate: mutateUploads,
  } = useSWR(status === "authenticated" ? "/api/documents" : null, swrFetcher);
  const prevUploads = uploadsData?.documents ?? EMPTY_DOCS;

  const [removingDocId, setRemovingDocId] = useState(null);
  const [selectedPrevDocIds, setSelectedPrevDocIds] = useState([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);

  useEffect(() => {
    setSelectedPrevDocIds((prev) => {
      const next = prev.filter((id) =>
        prevUploads.some((doc) => doc.id === id),
      );
      const unchanged =
        next.length === prev.length &&
        next.every((id, index) => id === prev[index]);
      return unchanged ? prev : next;
    });
  }, [prevUploads]);

  async function handleRemoveDocument(doc) {
    if (removingDocId != null || bulkRemoving) return;
    const confirmed = window.confirm(
      `Delete "${doc?.name ?? "this file"}" from server? This cannot be undone.`,
    );
    if (!confirmed) return;
    setRemovingDocId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setSelectedFiles((prev) =>
        prev.filter((f) => f.id !== doc.id && f.name !== doc.name),
      );
      setSelectedPrevDocIds((prev) => prev.filter((id) => id !== doc.id));
      mutateUploads();
    } catch (e) {
      setError("Could not remove document: " + (e?.message ?? "Unknown error"));
    } finally {
      setRemovingDocId(null);
    }
  }

  function togglePrevDocSelection(docId) {
    setSelectedPrevDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  }

  function toggleSelectAllPrevDocs() {
    if (selectedPrevDocIds.length === prevUploads.length) {
      setSelectedPrevDocIds([]);
      return;
    }
    setSelectedPrevDocIds(prevUploads.map((doc) => doc.id));
  }

  async function handleRemoveSelectedDocuments() {
    if (
      bulkRemoving ||
      removingDocId != null ||
      selectedPrevDocIds.length === 0
    )
      return;
    const docsToRemove = prevUploads.filter((doc) =>
      selectedPrevDocIds.includes(doc.id),
    );
    const confirmed = window.confirm(
      `Delete ${docsToRemove.length} selected file${docsToRemove.length !== 1 ? "s" : ""} from server? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBulkRemoving(true);
    setError("");
    let failed = 0;
    try {
      for (const doc of docsToRemove) {
        try {
          const res = await fetch(`/api/documents/${doc.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Failed to remove");
        } catch {
          failed += 1;
        }
      }
      const removedIds = new Set(docsToRemove.map((doc) => doc.id));
      const removedNames = new Set(docsToRemove.map((doc) => doc.name));
      setSelectedFiles((prev) =>
        prev.filter((f) => !(removedIds.has(f.id) || removedNames.has(f.name))),
      );
      setSelectedPrevDocIds([]);
      await mutateUploads();
      if (failed > 0) {
        setError(`Could not remove ${failed} file${failed !== 1 ? "s" : ""}.`);
      }
    } finally {
      setBulkRemoving(false);
    }
  }

  return {
    prevUploads,
    prevLoading,
    mutateUploads,
    removingDocId,
    selectedPrevDocIds,
    bulkRemoving,
    handleRemoveDocument,
    handleRemoveSelectedDocuments,
    togglePrevDocSelection,
    toggleSelectAllPrevDocs,
  };
}
