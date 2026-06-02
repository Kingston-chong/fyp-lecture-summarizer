"use client";

import "./sidebar-resize.css";

/**
 * Vertical splitter between a left sidebar and main content (shared with dashboard).
 */
export default function SidebarResizeSplitter({
  onMouseDown,
  className = "",
  active = false,
}) {
  return (
    <div
      className={`splitter-v ${className}${active ? " active" : ""}`.trim()}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={onMouseDown}
    />
  );
}
