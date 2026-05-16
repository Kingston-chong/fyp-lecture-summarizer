"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveReferenceUrl } from "@/lib/referenceDisplay";

const ABSTRACT_CLAMP = 280;

export default function CitationPreviewPopover({
  reference,
  anchorRect,
  onClose,
  onViewInSidebar,
}) {
  const cardRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const url = reference ? resolveReferenceUrl(reference) : null;
  const abstract = String(reference?.abstract || "").trim();
  const showMore = abstract.length > ABSTRACT_CLAMP;

  useLayoutEffect(() => {
    if (!anchorRect || !cardRef.current) return;
    const card = cardRef.current;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth || 340;
    const ch = card.offsetHeight || 200;

    let left = anchorRect.left + anchorRect.width / 2 - cw / 2;
    let top = anchorRect.bottom + margin;

    if (top + ch > vh - margin) {
      top = anchorRect.top - ch - margin;
    }
    if (top < margin) top = margin;
    left = Math.max(margin, Math.min(left, vw - cw - margin));

    setPos({ top, left });
  }, [anchorRect, expanded, abstract]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const onPointer = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  if (!reference || !anchorRect) return null;

  const meta = [reference.authors, reference.year, reference.venue]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <div
      ref={cardRef}
      className="citation-preview"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label={`Reference ${reference.marker}`}
    >
      <button
        type="button"
        className="citation-preview-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className="citation-preview-marker">[{reference.marker}]</div>
      <h4 className="citation-preview-title">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {reference.title}
          </a>
        ) : (
          reference.title
        )}
      </h4>
      {meta ? <div className="citation-preview-meta">{meta}</div> : null}
      {abstract ? (
        <div className="citation-preview-abstract">
          <p>
            {expanded || !showMore
              ? abstract
              : `${abstract.slice(0, ABSTRACT_CLAMP)}…`}
          </p>
          {showMore ? (
            <button
              type="button"
              className="citation-preview-more"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="citation-preview-abstract citation-preview-abstract--empty">
          No abstract available.
        </p>
      )}
      <div className="citation-preview-actions">
        {url ? (
          <a
            href={url}
            className="citation-preview-open"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open source
          </a>
        ) : null}
        {onViewInSidebar && reference?.kind !== "upload" ? (
          <button
            type="button"
            className="citation-preview-side"
            onClick={() => {
              onViewInSidebar(reference);
              onClose?.();
            }}
          >
            View in sidebar
          </button>
        ) : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
