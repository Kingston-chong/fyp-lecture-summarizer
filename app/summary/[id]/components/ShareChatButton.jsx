"use client";

import { useEffect, useState } from "react";

import Button from "@/app/components/ui/Button";

import ShareChatDialog from "@/app/components/ShareChatDialog";

import { ShareIcon, Spinner } from "@/app/components/icons";

import {
  copyTextToClipboard,
  publishPublicChatShare,
} from "@/lib/publishPublicChatShare";

/**

 * Publish / refresh a public chat share link and show the share dialog.

 * variant="toolbar" — sits beside Generate quiz / Save as PDF.

 */

export default function ShareChatButton({
  summaryId,

  summaryTitle = "",

  disabled,

  disabledTitle = "Wait until the summary is ready to share",

  variant = "inline",
}) {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [published, setPublished] = useState(false);

  const [shareDialog, setShareDialog] = useState(null);

  useEffect(() => {
    if (!summaryId) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/summary/${summaryId}/chat/share`);

        const data = await res.json().catch(() => ({}));

        if (!cancelled && res.ok) {
          setPublished(Boolean(data.published));
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [summaryId]);

  const handleShare = async () => {
    if (!summaryId || disabled || loading) return;

    setLoading(true);

    setError("");

    try {
      const { url, shareToken, unchanged } =
        await publishPublicChatShare(summaryId);

      setPublished(true);

      if (!unchanged) {
        await copyTextToClipboard(url);
      }

      setShareDialog({
        title: summaryTitle?.trim() || "Share conversation",

        shareUrl: url,

        shareToken,

        copiedOnOpen: !unchanged,
      });
    } catch (e) {
      setError(e?.message || "Share failed");

      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const label =
    published && variant === "toolbar"
      ? "Share"
      : published
        ? "Update share link"
        : variant === "toolbar"
          ? "Share"
          : "Share chat";

  const title = disabled
    ? disabledTitle
    : "Copy a public view-only link (summary and any chat messages)";

  const dialog = (
    <ShareChatDialog
      open={Boolean(shareDialog)}
      onClose={() => setShareDialog(null)}
      title={shareDialog?.title}
      shareUrl={shareDialog?.shareUrl}
      shareToken={shareDialog?.shareToken}
      copiedOnOpen={shareDialog?.copiedOnOpen ?? false}
    />
  );

  if (variant === "toolbar") {
    return (
      <>
        <span className="share-chat-toolbar-wrap">
          <Button
            type="button"
            className="act-bar-btn act-bar-btn--share"
            variant="default"
            title={title}
            disabled={disabled || loading}
            onClick={() => void handleShare()}
          >
            {loading ? <Spinner size={13} /> : <ShareIcon />}

            {label}
          </Button>

          {error ? (
            <span className="share-chat-err" role="alert">
              {error}
            </span>
          ) : null}
        </span>

        {dialog}
      </>
    );
  }

  return (
    <>
      <span className="share-chat-wrap">
        <button
          type="button"
          className="share-chat-btn"
          title={title}
          disabled={disabled || loading}
          onClick={() => void handleShare()}
        >
          {loading ? <Spinner size={12} /> : <ShareIcon size={13} />}

          {label}
        </button>

        {error ? (
          <span className="share-chat-err" role="alert">
            {error}
          </span>
        ) : null}
      </span>

      {dialog}
    </>
  );
}
