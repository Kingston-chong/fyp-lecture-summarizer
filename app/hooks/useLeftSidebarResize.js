"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const LEFT_SIDEBAR_MIN_WIDTH = 176;
export const LEFT_SIDEBAR_MAX_WIDTH = 440;

/**
 * Drag-to-resize for a left-docked sidebar (dashboard history panel, AppShell sidebar).
 * Same behavior as the original dashboard implementation.
 */
export function useLeftSidebarResize(initialWidth = 220) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const dragRef = useRef({ active: false, startX: 0, startW: initialWidth });

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const w = Math.min(
        LEFT_SIDEBAR_MAX_WIDTH,
        Math.max(LEFT_SIDEBAR_MIN_WIDTH, dragRef.current.startW + dx),
      );
      setSidebarWidth(w);
    };
    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
        document.body.classList.remove("no-select");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("no-select");
    };
  }, []);

  const onSidebarResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startW: sidebarWidth,
      };
      document.body.classList.add("no-select");
    },
    [sidebarWidth],
  );

  return { sidebarWidth, onSidebarResizeStart };
}
