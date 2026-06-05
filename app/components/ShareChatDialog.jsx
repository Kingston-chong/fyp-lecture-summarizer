"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { CloseIcon, ShareIcon } from "@/app/components/icons";
import { APP_LOGO_SRC } from "@/app/components/AppLogo";
import { copyTextToClipboard } from "@/lib/publishPublicChatShare";
import { qrDataUrlForText } from "@/lib/shareQrCode";
import "./ShareChatDialog.css";

function previewPlain(text, max = 260) {
  const plain = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

function SharePreview({ snapshot, loading }) {
  const userText = useMemo(() => {
    const msg = snapshot?.messages?.find((m) => m.role === "user");
    return previewPlain(msg?.content, 120);
  }, [snapshot]);

  const aiText = useMemo(() => {
    const msg = snapshot?.messages?.find((m) => m.role === "assistant");
    return previewPlain(msg?.content, 280);
  }, [snapshot]);

  if (loading) {
    return (
      <div className="share-chat-dialog-preview-empty">Loading preview…</div>
    );
  }

  if (!userText && !aiText) {
    return (
      <div className="share-chat-dialog-preview-empty">
        Summary and conversation preview
      </div>
    );
  }

  return (
    <>
      <div className="share-chat-dialog-preview-inner">
        {userText ? (
          <div className="share-chat-dialog-user-pill">{userText}</div>
        ) : null}
        {aiText ? <div className="share-chat-dialog-ai">{aiText}</div> : null}
      </div>
      <div className="share-chat-dialog-preview-fade" aria-hidden="true" />
      <div className="share-chat-dialog-brand" aria-hidden="true">
        <Image
          src={APP_LOGO_SRC}
          alt=""
          width={18}
          height={18}
          className="share-chat-dialog-brand-img"
        />
        <span>Slide2Notes</span>
      </div>
    </>
  );
}

function SocialIcon({ kind }) {
  if (kind === "x") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (kind === "linkedin") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.127 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }
  if (kind === "reddit") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M14.238 15.348c.085.085.085.221 0 .306-.465.462-1.194.687-2.231.687l-.008-.002-.008.002c-1.036 0-1.766-.225-2.231-.688-.085-.084-.085-.22 0-.305.084-.084.222-.084.307 0 .379.377 1.008.561 1.924.561.915 0 1.544-.184 1.922-.561.085-.084.223-.084.307 0zm-2.971-2.418c0 .414-.336.75-.75.75s-.75-.336-.75-.75.336-.75.75-.75.75.336.75.75zm4.572 0c0 .414-.337.75-.751.75-.414 0-.75-.336-.75-.75s.336-.75.75-.75.751.336.751.75zm6.856-1.455c-.505-.655-1.287-1.148-2.259-1.422-.231-.064-.472.066-.536.297-.064.231.066.472.297.536.803.224 1.439.609 1.798 1.14.363-.532.995-.916 1.798-1.14.231-.064.361-.305.297-.536-.064-.231-.305-.361-.536-.297-.972.274-1.754.767-2.259 1.422zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.344 11.785c0 2.455-2.864 4.444-6.344 4.444S5.656 14.24 5.656 11.785c0-2.455 2.864-4.444 6.344-4.444s6.344 1.989 6.344 4.444z" />
      </svg>
    );
  }
  return null;
}

function QrIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h2v3h-2zM18 18h1v1h-1zM20 18h1v1h-1zM18 20h1v1h-1zM20 20h3v3h-3z" />
    </svg>
  );
}

/**
 * ChatGPT-style dialog after a public chat link is created / copied.
 */
export default function ShareChatDialog({
  open,
  onClose,
  title,
  shareUrl,
  shareToken,
  copiedOnOpen = false,
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setCopied(Boolean(copiedOnOpen));
    if (!copiedOnOpen) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [open, copiedOnOpen]);

  useEffect(() => {
    if (!open || !shareToken) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/chat/share/${encodeURIComponent(shareToken)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setSnapshot(data.snapshot || null);
        }
      } catch {
        /* ignore preview errors */
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, shareToken]);

  useEffect(() => {
    if (!open) {
      setQrOpen(false);
      setQrDataUrl("");
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !shareUrl || !qrOpen) {
      if (!qrOpen) setQrDataUrl("");
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    void qrDataUrlForText(shareUrl, { size: 220 })
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
  }, [open, shareUrl, qrOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await copyTextToClipboard(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }, [shareUrl]);

  const openSocial = useCallback((href) => {
    if (!href) return;
    window.open(href, "_blank", "noopener,noreferrer");
  }, []);

  if (!mounted || !open || !shareUrl) return null;

  const encoded = encodeURIComponent(shareUrl);
  const social = [
    {
      key: "copy",
      label: copied ? "Copied!" : "Copy link",
      onClick: () => void handleCopy(),
      icon: <ShareIcon size={18} />,
      copied,
    },
    {
      key: "x",
      label: "X",
      onClick: () =>
        openSocial(
          `https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(title || "Slide2Notes conversation")}`,
        ),
      icon: <SocialIcon kind="x" />,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      onClick: () =>
        openSocial(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
        ),
      icon: <SocialIcon kind="linkedin" />,
    },
    {
      key: "reddit",
      label: "Reddit",
      onClick: () => openSocial(`https://www.reddit.com/submit?url=${encoded}`),
      icon: <SocialIcon kind="reddit" />,
    },
    {
      key: "qr",
      label: qrOpen ? "Hide QR" : "QR code",
      onClick: () => setQrOpen((v) => !v),
      icon: <QrIcon />,
      active: qrOpen,
    },
  ];

  return createPortal(
    <div
      className="share-chat-dialog-backdrop"
      role="presentation"
      onClick={() => onClose?.()}
    >
      <div
        className="share-chat-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-chat-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-chat-dialog-head">
          <h2 id="share-chat-dialog-title" className="share-chat-dialog-title">
            {title?.trim() || "Share conversation"}
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

        <div className="share-chat-dialog-preview">
          <SharePreview snapshot={snapshot} loading={previewLoading} />
        </div>

        {qrOpen ? (
          <div className="share-chat-dialog-qr" aria-live="polite">
            <p className="share-chat-dialog-qr-label">
              Scan to open on your phone
            </p>
            <div className="share-chat-dialog-qr-frame">
              {qrLoading ? (
                <span className="share-chat-dialog-qr-loading">
                  Creating QR…
                </span>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code for shared conversation link"
                  width={220}
                  height={220}
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
        ) : null}

        <div className="share-chat-dialog-actions">
          {social.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`share-chat-dialog-action${item.copied ? " copied" : ""}${item.active ? " active" : ""}`}
              onClick={item.onClick}
            >
              <span className="share-chat-dialog-action-ico">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <p className="share-chat-dialog-foot">
          Anyone with the link can view this summary and chat (read-only).
        </p>
      </div>
    </div>,
    document.body,
  );
}
