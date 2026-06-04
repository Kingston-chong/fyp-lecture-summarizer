"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ShareChatDialog from "@/app/components/ShareChatDialog";
import { dispatchSummaryRenamed } from "@/lib/summaryRenameSync";
import {
  copyTextToClipboard,
  publishPublicChatShare,
} from "@/lib/publishPublicChatShare";

/**
 * Share, rename, and delete flows for summary history rows (shared by sidebars).
 */
export function useSummaryHistoryActions({ onRefresh }) {
  const router = useRouter();
  const [renameModal, setRenameModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [shareDialog, setShareDialog] = useState(null);
  const [shareLoadingId, setShareLoadingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  const openRenameModal = useCallback((summary) => {
    setRenameModal({ summary, value: summary?.title || "" });
  }, []);

  const submitRename = useCallback(async () => {
    if (!renameModal?.summary) return;
    const { summary } = renameModal;
    const next = renameModal.value?.trim() || "";
    const current = (summary.title || "").trim();
    if (!next || next === current) {
      setRenameModal(null);
      return;
    }
    setRenameModal(null);
    try {
      const res = await fetch(`/api/summary/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) {
        dispatchSummaryRenamed(summary.id, next);
        await onRefresh?.();
      }
    } catch {
      setToast({ message: "Could not rename summary." });
    }
  }, [renameModal, onRefresh]);

  const handleDeleteSummary = useCallback((summary) => {
    if (!summary?.id) return;
    setDeleteModal({ summary });
  }, []);

  const confirmDelete = useCallback(async () => {
    const s = deleteModal?.summary;
    setDeleteModal(null);
    if (!s?.id) return;
    try {
      const res = await fetch(`/api/summary/${s.id}`, { method: "DELETE" });
      if (res.ok) {
        await onRefresh?.();
        router.push("/dashboard");
      }
    } catch {
      setToast({ message: "Could not delete summary." });
    }
  }, [deleteModal, onRefresh, router]);

  const handleShareSummary = useCallback(async (summary) => {
    if (typeof window === "undefined" || !summary?.id) return;
    setShareLoadingId(summary.id);
    try {
      const { url, shareToken, unchanged } = await publishPublicChatShare(
        summary.id,
      );
      if (!unchanged) {
        await copyTextToClipboard(url);
      }
      setShareDialog({
        title: summary.title?.trim() || "Share conversation",
        shareUrl: url,
        shareToken,
        copiedOnOpen: !unchanged,
      });
    } catch (e) {
      setToast({
        message: e?.message || "Could not create share link.",
      });
    } finally {
      setShareLoadingId(null);
    }
  }, []);

  const renderModals = useCallback(() => {
    if (!portalTarget) return null;
    return createPortal(
      <>
        {renameModal ? (
          <div
            className="as-modal-backdrop"
            onClick={() => setRenameModal(null)}
          >
            <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="as-modal-title">Rename summary</div>
              <input
                type="text"
                className="as-modal-input"
                value={renameModal.value}
                onChange={(e) =>
                  setRenameModal((p) => ({ ...p, value: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && void submitRename()}
                placeholder="Summary title"
                autoFocus
              />
              <div className="as-modal-btns">
                <button
                  type="button"
                  className="as-modal-btn sec"
                  onClick={() => setRenameModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="as-modal-btn primary"
                  onClick={() => void submitRename()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteModal ? (
          <div
            className="as-modal-backdrop"
            onClick={() => setDeleteModal(null)}
          >
            <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="as-modal-title">Delete summary</div>
              <div className="as-modal-desc">
                Delete this summary permanently? This cannot be undone.
              </div>
              <div className="as-modal-btns">
                <button
                  type="button"
                  className="as-modal-btn sec"
                  onClick={() => setDeleteModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="as-modal-btn danger"
                  onClick={() => void confirmDelete()}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className="as-toast" role="status">
            {toast.message}
          </div>
        ) : null}

        <ShareChatDialog
          open={Boolean(shareDialog)}
          onClose={() => setShareDialog(null)}
          title={shareDialog?.title}
          shareUrl={shareDialog?.shareUrl}
          shareToken={shareDialog?.shareToken}
          copiedOnOpen={shareDialog?.copiedOnOpen ?? false}
        />
      </>,
      portalTarget,
    );
  }, [
    portalTarget,
    renameModal,
    deleteModal,
    toast,
    shareDialog,
    submitRename,
    confirmDelete,
  ]);

  return {
    shareLoadingId,
    openRenameModal,
    handleShareSummary,
    handleDeleteSummary,
    renderModals,
  };
}
