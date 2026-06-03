"use client";

import { useCallback, useEffect, useState } from "react";
import { ShareIcon, Spinner } from "@/app/components/icons";

/**
 * Publish / refresh a public chat share link and copy it to the clipboard.
 */
export default function ShareChatButton({ summaryId, disabled }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);

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

  const shareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/chat/share/`;
  }, []);

  const handleShare = async () => {
    if (!summaryId || disabled || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/summary/${summaryId}/chat/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not create share link");
      }
      const token = data.shareToken;
      if (!token) throw new Error("No share token returned");

      const url = `${shareUrl()}${token}`;
      setPublished(true);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (navigator.share) {
        await navigator.share({
          title: "Slide2Notes conversation",
          url,
        });
      } else {
        window.prompt("Copy this link:", url);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setError(e?.message || "Share failed");
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const label = copied
    ? "Link copied!"
    : published
      ? "Update share link"
      : "Share chat";

  return (
    <span className="share-chat-wrap">
      <button
        type="button"
        className={`share-chat-btn${copied ? " copied" : ""}`}
        title={
          disabled
            ? "Send at least one chat message to share"
            : "Create a public view-only link (no sign-in required)"
        }
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
  );
}
