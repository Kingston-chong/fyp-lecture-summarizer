"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HistorySummaryDetailsContent from "./HistorySummaryDetailsContent";
import {
  computeHistoryPopoverPosition,
  HISTORY_HOVER_CLOSE_MS,
  HISTORY_HOVER_OPEN_MS,
  HISTORY_POPOVER_WIDTH,
} from "./HistorySummaryExpand";
import "./HistorySummaryExpand.css";

/**
 * Compact title preview on hover (full title, date, role + asset counts).
 */
export default function HistoryTitleHoverPreview({
  summary,
  summarizeForLabel,
  timeAgoLabel,
  className = "",
  children,
  ...rest
}) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const hoverOpenTimer = useRef(null);
  const hoverCloseTimer = useRef(null);
  const pointerInZone = useRef(false);

  const [hoverOpen, setHoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPopoverStyle(computeHistoryPopoverPosition(el.getBoundingClientRect()));
  }, []);

  useEffect(() => {
    if (!hoverOpen) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [hoverOpen, updatePosition]);

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
    clearHoverTimers();
    hoverOpenTimer.current = setTimeout(() => {
      if (pointerInZone.current) setHoverOpen(true);
    }, HISTORY_HOVER_OPEN_MS);
  }, [clearHoverTimers]);

  const scheduleHoverClose = useCallback(() => {
    clearHoverTimers();
    hoverCloseTimer.current = setTimeout(() => {
      if (!pointerInZone.current) setHoverOpen(false);
    }, HISTORY_HOVER_CLOSE_MS);
  }, [clearHoverTimers]);

  useEffect(() => () => clearHoverTimers(), [clearHoverTimers]);

  const onZoneEnter = () => {
    pointerInZone.current = true;
    scheduleHoverOpen();
  };

  const onZoneLeave = () => {
    pointerInZone.current = false;
    scheduleHoverClose();
  };

  if (!summary) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={onZoneEnter}
        onMouseLeave={onZoneLeave}
        onFocus={onZoneEnter}
        onBlur={onZoneLeave}
        {...rest}
      >
        {children}
      </div>

      {portalTarget &&
        hoverOpen &&
        popoverStyle &&
        createPortal(
          <div
            ref={popoverRef}
            className="hist-details-popover hist-details-popover--title"
            style={{
              position: "fixed",
              left: popoverStyle.left,
              top: popoverStyle.top,
              width: HISTORY_POPOVER_WIDTH,
              maxHeight: popoverStyle.maxHeight,
              zIndex: 10025,
            }}
            role="tooltip"
            onMouseEnter={onZoneEnter}
            onMouseLeave={onZoneLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <HistorySummaryDetailsContent
              summary={summary}
              summarizeForLabel={summarizeForLabel}
              timeAgoLabel={timeAgoLabel}
              variant="preview"
              onNavigate={() => {}}
            />
          </div>,
          portalTarget,
        )}
    </>
  );
}
