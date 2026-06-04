"use client";

import { ReadFocusExitIcon } from "@/app/components/icons";

export default function SummaryReadModeExit({ onExit }) {
  return (
    <button
      type="button"
      className="sum-read-exit"
      onClick={onExit}
      aria-label="Exit reading view"
    >
      <ReadFocusExitIcon size={15} />
      <span>Done reading</span>
    </button>
  );
}
