"use client";

import { useState, useRef, useEffect } from "react";

export function useSourcesPanelResize() {
  const [sourcesWidth, setSourcesWidth] = useState(260);
  const [splitterDragging, setSplitterDragging] = useState(false);
  const splitterRef = useRef(null);

  useEffect(() => {
    function onMove(e) {
      const drag = splitterRef.current;
      if (!drag) return;
      // Panel is on the right: moving the splitter left widens sources, right narrows it.
      const dx = e.clientX - drag.startX;
      const next = drag.startWidth - dx;
      setSourcesWidth(Math.max(220, Math.min(420, next)));
    }
    function onUp() {
      if (!splitterRef.current) return;
      splitterRef.current = null;
      setSplitterDragging(false);
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onSplitterMouseDown(e) {
    splitterRef.current = {
      startX: e.clientX,
      startWidth: sourcesWidth,
    };
    setSplitterDragging(true);
    document.body.style.cursor = "col-resize";
  }

  return {
    sourcesWidth,
    splitterDragging,
    splitterRef,
    onSplitterMouseDown,
  };
}
