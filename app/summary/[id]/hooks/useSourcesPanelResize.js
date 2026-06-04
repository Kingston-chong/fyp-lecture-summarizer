"use client";

import { useEffect, useState, useRef } from "react";

const SOURCES_COLLAPSED_KEY = "sum-sources-panel-collapsed-v1";

function readSourcesCollapsedStored() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOURCES_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSourcesCollapsedStored(collapsed) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOURCES_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function useSourcesPanelResize() {
  const [sourcesWidth, setSourcesWidth] = useState(260);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [splitterDragging, setSplitterDragging] = useState(false);
  const splitterRef = useRef(null);

  useEffect(() => {
    setSourcesCollapsed(readSourcesCollapsedStored());
  }, []);

  const toggleSourcesCollapsed = () => {
    setSourcesCollapsed((prev) => {
      const next = !prev;
      writeSourcesCollapsedStored(next);
      return next;
    });
  };

  useEffect(() => {
    function onMove(e) {
      const drag = splitterRef.current;
      if (!drag) return;
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
      document.body.style.cursor = "";
      splitterRef.current = null;
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
    sourcesCollapsed,
    toggleSourcesCollapsed,
    splitterDragging,
    splitterRef,
    onSplitterMouseDown,
  };
}
