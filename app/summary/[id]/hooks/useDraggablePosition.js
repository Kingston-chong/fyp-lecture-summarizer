"use client";

import { useState, useRef, useCallback } from "react";

const PANEL_MARGIN = 12;

/**
 * Draggable fixed panel position. Drag from header via onPointerDown on handle.
 */
export function useDraggablePosition({
  defaultRight = 24,
  defaultTop = 80,
  panelWidth = 360,
  panelHeight = 420,
}) {
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return null;
    return {
      left: Math.max(
        PANEL_MARGIN,
        window.innerWidth - panelWidth - defaultRight,
      ),
      top: defaultTop,
    };
  });
  const dragRef = useRef(null);

  const onDragPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      const el = e.currentTarget.closest(".fc-drag-panel");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top,
      };
      e.preventDefault();

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        const maxLeft = window.innerWidth - panelWidth - PANEL_MARGIN;
        const maxTop = window.innerHeight - panelHeight - PANEL_MARGIN;
        const left = Math.min(
          maxLeft,
          Math.max(PANEL_MARGIN, d.startLeft + (ev.clientX - d.startX)),
        );
        const top = Math.min(
          maxTop,
          Math.max(PANEL_MARGIN, d.startTop + (ev.clientY - d.startY)),
        );
        setPosition({ left, top });
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelWidth, panelHeight],
  );

  return { position, onDragPointerDown };
}
