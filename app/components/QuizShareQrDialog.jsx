"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import { qrDataUrlForText } from "@/lib/shareQrCode";
import "./ShareChatDialog.css";

/** QR code dialog for a published quiz share link. */
export default function QuizShareQrDialog({
  open,
  onClose,
  title = "Quiz",
  shareUrl = "",
}) {
  const [mounted, setMounted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !shareUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    void qrDataUrlForText(shareUrl, { size: 240 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const downloadQr = useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${
      String(title || "quiz")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 40) || "quiz"
    }-qr.png`;
    a.click();
  }, [qrDataUrl, title]);

  if (!mounted || !open || !shareUrl) return null;

  return createPortal(
    <div
      className="share-chat-dialog-backdrop"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div
        className="share-chat-dialog share-chat-dialog--qr-only"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-share-qr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-chat-dialog-head">
          <h2 id="quiz-share-qr-title" className="share-chat-dialog-title">
            Share quiz by QR code
          </h2>
          <button
            type="button"
            className="share-chat-dialog-close"
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <p className="share-chat-dialog-qr-label" style={{ marginTop: 4 }}>
          Display this on your slides so students can scan and open the quiz on
          their phones.
        </p>

        <div className="share-chat-dialog-qr" aria-live="polite">
          <div className="share-chat-dialog-qr-frame">
            {qrLoading ? (
              <span className="share-chat-dialog-qr-loading">Creating QR…</span>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code for quiz link"
                width={240}
                height={240}
              />
            ) : (
              <span className="share-chat-dialog-qr-loading">
                Could not create QR
              </span>
            )}
          </div>
          <p className="share-chat-dialog-qr-url" title={shareUrl}>
            {shareUrl}
          </p>
        </div>

        <div className="share-chat-dialog-actions">
          <button
            type="button"
            className="share-chat-dialog-action"
            disabled={!qrDataUrl}
            onClick={downloadQr}
          >
            Download QR image
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
