"use client";

import { EditIcon, ShareIcon, TrashIcon } from "./icons";

/** Share / rename / delete row actions for history ⋮ menus (App + dashboard sidebars). */
export default function HistorySummaryMenuActions({
  summary,
  shareLoadingId,
  onRename,
  onShare,
  onDelete,
}) {
  if (!summary) return null;
  return (
    <>
      <button
        type="button"
        className="as-menu-btn"
        onClick={() => onRename?.(summary)}
      >
        <span className="as-menu-ico">
          <EditIcon size={16} />
        </span>
        Rename
      </button>
      <button
        type="button"
        className="as-menu-btn"
        disabled={shareLoadingId === summary.id}
        onClick={() => onShare?.(summary)}
      >
        <span className="as-menu-ico">
          <ShareIcon size={16} />
        </span>
        Share
      </button>
      <button
        type="button"
        className="as-menu-btn danger"
        onClick={() => onDelete?.(summary)}
      >
        <span className="as-menu-ico">
          <TrashIcon size={16} />
        </span>
        Delete
      </button>
    </>
  );
}
