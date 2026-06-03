"use client";

import { CloseIcon, SaveIco, Spinner } from "@/app/components/icons";
import { LoadingText } from "@/app/components/LoadingText";

/** Save / cancel pills for unsaved highlights — tag styling, right-aligned in header. */
export default function SummaryHighlightTags({
  count = 0,
  hlSaving = false,
  disabled = false,
  onSave,
  onCancel,
}) {
  if (count <= 0) return null;

  const n = Math.min(99, count);

  return (
    <div className="sum-hl-tag-actions" role="group" aria-label="Unsaved highlights">
      <button
        type="button"
        className="tag tag-hl-action tag-save"
        title={`Save ${n} unsaved highlight(s)`}
        aria-label={`Save ${n} highlights`}
        onClick={onSave}
        disabled={disabled || hlSaving}
      >
        {hlSaving ? (
          <Spinner size={13} color="currentColor" />
        ) : (
          <SaveIco size={13} />
        )}
        <span>
          {hlSaving ? (
            <LoadingText active>Saving</LoadingText>
          ) : (
            `Save · ${n}`
          )}
        </span>
      </button>
      <button
        type="button"
        className="tag tag-hl-action tag-cancel"
        title="Discard all unsaved highlights"
        aria-label="Cancel unsaved highlights"
        onClick={onCancel}
        disabled={disabled || hlSaving}
      >
        <CloseIcon size={12} />
        <span>Cancel</span>
      </button>
    </div>
  );
}
