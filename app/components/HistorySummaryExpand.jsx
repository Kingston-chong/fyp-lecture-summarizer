"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./HistorySummaryExpand.css";
import HistorySummaryDetailsContent from "./HistorySummaryDetailsContent";
import { ChevronDownIcon } from "./icons";

export const HISTORY_EXPAND_TABS = ["files", "slideDecks", "quizzes"];

export function historyItemHasDetails(h) {
  return (
    (h.files?.length ?? 0) > 0 ||
    (h.slideDecks?.length ?? 0) > 0 ||
    (h.quizzes?.length ?? 0) > 0
  );
}

export function defaultHistoryExpandTab(h) {
  if ((h.files?.length ?? 0) > 0) return "files";
  if ((h.slideDecks?.length ?? 0) > 0) return "slideDecks";
  if ((h.quizzes?.length ?? 0) > 0) return "quizzes";
  return "files";
}

export function formatHistoryMetaParts(h) {
  const parts = [];
  const fileCount = h.files?.length ?? 0;
  const deckCount = h.slideDecks?.length ?? 0;
  const quizCount = h.quizzes?.length ?? 0;
  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
  }
  if (deckCount > 0) {
    parts.push(`${deckCount} deck${deckCount !== 1 ? "s" : ""}`);
  }
  if (quizCount > 0) {
    parts.push(`${quizCount} quiz${quizCount !== 1 ? "zes" : ""}`);
  }
  return parts;
}

export function historyMatchesSearch(h, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (
    String(h.title || "")
      .toLowerCase()
      .includes(needle)
  )
    return true;
  if (
    (h.files || []).some((f) =>
      String(f.name || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  if (
    (h.slideDecks || []).some((d) =>
      String(d.title || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  if (
    (h.quizzes || []).some((quiz) =>
      String(quiz.title || "")
        .toLowerCase()
        .includes(needle),
    )
  ) {
    return true;
  }
  return false;
}

export const HISTORY_POPOVER_WIDTH = 288;
export const HISTORY_HOVER_OPEN_MS = 280;
export const HISTORY_HOVER_CLOSE_MS = 120;

const POPOVER_WIDTH = HISTORY_POPOVER_WIDTH;
const HOVER_OPEN_MS = HISTORY_HOVER_OPEN_MS;
const HOVER_CLOSE_MS = HISTORY_HOVER_CLOSE_MS;

export function computeHistoryPopoverPosition(anchorRect) {
  const pad = 12;
  const maxH = Math.min(420, window.innerHeight - pad * 2);
  let left = anchorRect.right + 10;
  let top = anchorRect.top;

  if (left + POPOVER_WIDTH > window.innerWidth - pad) {
    left = anchorRect.left - POPOVER_WIDTH - 10;
  }
  if (left < pad) left = pad;

  top = Math.max(pad, Math.min(top, window.innerHeight - maxH - pad));

  return { left, top, maxHeight: maxH };
}

/**
 * Meta chips + chevron; details in a hover / pinned popover (Canva-style).
 */
export default function HistorySummaryExpand({
  summary,
  expanded,
  onToggleExpand,
  onNavigate,
  summarizeForLabel,
  timeAgoLabel,
  chevronClassName = "hist-expand-chev",
  metaClassName = "hist-expand-meta",
  suppressPopover = false,
}) {
  const hasAssets = historyItemHasDetails(summary);
  const showPopover =
    !suppressPopover && (hasAssets || Boolean(summarizeForLabel));

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const hoverOpenTimer = useRef(null);
  const hoverCloseTimer = useRef(null);
  const pointerInZone = useRef(false);

  const [hoverOpen, setHoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);

  const pinnedOpen = Boolean(expanded);
  const popoverVisible = showPopover && (pinnedOpen || hoverOpen);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPopoverStyle(computeHistoryPopoverPosition(el.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    if (!popoverVisible) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [popoverVisible, updatePosition]);

  const clearHoverTimers = useCallback(() => {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  const scheduleHoverOpen = useCallback(() => {
    if (pinnedOpen || !showPopover) return;
    clearHoverTimers();
    hoverOpenTimer.current = setTimeout(() => {
      if (pointerInZone.current) setHoverOpen(true);
    }, HOVER_OPEN_MS);
  }, [pinnedOpen, showPopover, clearHoverTimers]);

  const scheduleHoverClose = useCallback(() => {
    clearHoverTimers();
    hoverCloseTimer.current = setTimeout(() => {
      if (!pointerInZone.current && !pinnedOpen) setHoverOpen(false);
    }, HOVER_CLOSE_MS);
  }, [pinnedOpen, clearHoverTimers]);

  useEffect(() => {
    if (!pinnedOpen) return;
    setHoverOpen(false);
    clearHoverTimers();
  }, [pinnedOpen, clearHoverTimers]);

  useEffect(() => {
    if (!pinnedOpen) return;
    function onDocPointer(e) {
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      onToggleExpand?.();
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [pinnedOpen, onToggleExpand]);

  useEffect(() => () => clearHoverTimers(), [clearHoverTimers]);

  const onZoneEnter = () => {
    pointerInZone.current = true;
    scheduleHoverOpen();
  };

  const onZoneLeave = () => {
    pointerInZone.current = false;
    scheduleHoverClose();
  };

  return (
    <>
      <div className="hist-expand-meta-row">
        {hasAssets && (
          <button
            type="button"
            className={`${chevronClassName}${pinnedOpen ? " expanded" : ""}`}
            aria-expanded={pinnedOpen}
            aria-label={
              pinnedOpen ? "Close details" : "Show files, decks, and quizzes"
            }
            title={
              pinnedOpen ? "Close details" : "Show files, decks, and quizzes"
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
          >
            <ChevronDownIcon size={10} />
          </button>
        )}
        <div
          ref={triggerRef}
          className={`hist-expand-meta-trigger${metaClassName ? ` ${metaClassName}` : ""}`}
          onMouseEnter={showPopover ? onZoneEnter : undefined}
          onMouseLeave={showPopover ? onZoneLeave : undefined}
          onFocus={showPopover ? onZoneEnter : undefined}
          onBlur={showPopover ? onZoneLeave : undefined}
        >
          <span className="hist-expand-meta-chips">
            {(summary.files?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--file">
                {summary.files.length} file
                {summary.files.length !== 1 ? "s" : ""}
              </span>
            )}
            {(summary.slideDecks?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--deck">
                {summary.slideDecks.length} deck
                {summary.slideDecks.length !== 1 ? "s" : ""}
              </span>
            )}
            {(summary.quizzes?.length ?? 0) > 0 && (
              <span className="hist-expand-count-chip hist-expand-count-chip--quiz">
                {summary.quizzes.length} quiz
                {summary.quizzes.length !== 1 ? "zes" : ""}
              </span>
            )}
          </span>
          {summarizeForLabel ? (
            <span className="hist-expand-role-chip">{summarizeForLabel}</span>
          ) : null}
        </div>
      </div>
      {timeAgoLabel != null && (
        <div className="hist-expand-date">{timeAgoLabel}</div>
      )}

      {portalTarget &&
        popoverVisible &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            className="hist-details-popover"
            style={{
              position: "fixed",
              left: popoverStyle.left,
              top: popoverStyle.top,
              width: POPOVER_WIDTH,
              maxHeight: popoverStyle.maxHeight,
              zIndex: 10025,
            }}
            role="dialog"
            aria-label="Summary details"
            onMouseEnter={onZoneEnter}
            onMouseLeave={onZoneLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <HistorySummaryDetailsContent
              summary={summary}
              summarizeForLabel={summarizeForLabel}
              timeAgoLabel={timeAgoLabel}
              onNavigate={onNavigate}
              variant="popover"
            />
          </div>,
          portalTarget,
        )}
    </>
  );
}
