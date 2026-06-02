"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HistorySummaryDetailsContent from "./HistorySummaryDetailsContent";
import { historyItemHasDetails } from "./HistorySummaryExpand";

/**
 * Portaled history ⋮ menu — full height, no inner scroll.
 */
export default function HistorySummaryMenuPortal({
  summary,
  anchor,
  onClose,
  onNavigate,
  summarizeForLabel,
  timeAgoLabel,
  shiftRightPx = 0,
  menuWidth = 300,
  children,
}) {
  const menuRef = useRef(null);
  const [top, setTop] = useState(null);

  const [left, setLeft] = useState(null);

  useLayoutEffect(() => {
    if (!anchor || !summary) {
      setTop(null);
      setLeft(null);
      return;
    }
    const el = menuRef.current;
    const gap = 8;
    const pad = 12;

    let nextLeft = anchor.right + gap + shiftRightPx;
    if (nextLeft + menuWidth > window.innerWidth - pad) {
      nextLeft = anchor.left - menuWidth - gap + shiftRightPx;
    }
    nextLeft = Math.max(pad, Math.min(nextLeft, window.innerWidth - menuWidth - pad));
    setLeft(nextLeft);

    let nextTop = anchor.top ?? anchor.bottom;
    if (el) {
      const h = el.offsetHeight;
      if (nextTop + h > window.innerHeight - pad) {
        nextTop = Math.max(pad, window.innerHeight - pad - h);
      }
    }
    setTop(nextTop);
  }, [anchor, summary, summarizeForLabel, timeAgoLabel, children, menuWidth, shiftRightPx]);

  if (!summary || !anchor || typeof document === "undefined") return null;

  const showDetails =
    historyItemHasDetails(summary) || Boolean(summarizeForLabel);

  const fallbackLeft = Math.max(12, anchor.right + 8 + shiftRightPx);

  return createPortal(
    <div
      ref={menuRef}
      className="as-menu as-history-menu-portal hist-history-menu"
      style={{
        position: "fixed",
        top: top ?? anchor.top ?? anchor.bottom,
        left: left ?? fallbackLeft,
        width: menuWidth,
        zIndex: 10020,
      }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {showDetails ? (
        <>
          <div className="as-menu-details-wrap">
            <HistorySummaryDetailsContent
              summary={summary}
              summarizeForLabel={summarizeForLabel}
              timeAgoLabel={timeAgoLabel}
              variant="menu"
              onNavigate={(id, sources) => {
                onClose();
                onNavigate(id, sources);
              }}
            />
          </div>
          {children ? <div className="as-menu-divider" aria-hidden /> : null}
        </>
      ) : null}
      {children}
    </div>,
    document.body,
  );
}
