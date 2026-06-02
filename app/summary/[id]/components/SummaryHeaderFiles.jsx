"use client";

import { DocIco } from "@/app/components/icons";

/** Source file chips in the summary header (desktop spans; mobile tappable buttons). */
export default function SummaryHeaderFiles({
  files = [],
  className = "sum-files",
  asButton = false,
  disabled = false,
  onFileClick,
}) {
  if (!files.length) return null;

  return (
    <div className={className}>
      {files.map((f) => {
        const content = (
          <>
            <DocIco ext={f.type} />
            <span className="fchip-name">{f.name}</span>
          </>
        );
        if (asButton) {
          return (
            <button
              key={f.id}
              type="button"
              className="fchip fchip-btn"
              title={f.name}
              disabled={disabled}
              onClick={onFileClick}
            >
              {content}
            </button>
          );
        }
        return (
          <span key={f.id} className="fchip" title={f.name}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
