"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloseIcon } from "@/app/components/icons";
import "./RegisterPromptModal.css";

const FEATURE_LABELS = {
  quiz: "generate quizzes",
  flashcards: "generate flashcards",
  slides: "generate slides",
  chat: "use AI chat on your summary",
  highlights: "save highlights",
  share: "share your work",
  history: "save summaries to your history",
  revision: "create revision sheets",
  save: "save your summaries and uploads",
  default: "use this feature",
};

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   feature?: keyof typeof FEATURE_LABELS | string;
 * }} props
 */
export default function RegisterPromptModal({
  open,
  onClose,
  feature = "default",
}) {
  const pathname = usePathname();
  const callbackUrl = encodeURIComponent(pathname || "/try");
  const action = FEATURE_LABELS[feature] || FEATURE_LABELS.default;

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="register-prompt-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="register-prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-prompt-title"
      >
        <button
          type="button"
          className="register-prompt-close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        <h2 id="register-prompt-title" className="register-prompt-title">
          Create a free account
        </h2>
        <p className="register-prompt-body">
          Sign up to {action}. Your trial summary stays on this device only
          until you register — we will not save uploads or summaries without an
          account.
        </p>
        <div className="register-prompt-actions">
          <Link
            href={`/register?callbackUrl=${callbackUrl}`}
            className="register-prompt-btn register-prompt-btn-primary"
            onClick={onClose}
          >
            Register free
          </Link>
          <Link
            href={`/login?callbackUrl=${callbackUrl}`}
            className="register-prompt-btn register-prompt-btn-secondary"
            onClick={onClose}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
