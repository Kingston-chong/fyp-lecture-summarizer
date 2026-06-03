"use client";

import { useState } from "react";
import {
  PUBLISHED_YEAR_PRESETS,
  formatPublishedYearRangeLabel,
  parseYearInput,
  resolvePublishedYearRange,
} from "@/lib/publishedYearFilter";

/**
 * Lecturer-only: filter academic references by publication year.
 * @param {{ mode: string; onModeChange: (id: string) => void; customFrom: string; customTo: string; onCustomFromChange: (v: string) => void; onCustomToChange: (v: string) => void; appliedCustom: { from: number | null; to: number | null }; onApplyCustom: (range: { from: number | null; to: number | null }) => void }}
 */
export default function PublishedYearFilter({
  mode,
  onModeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  appliedCustom,
  onApplyCustom,
}) {
  const [customErr, setCustomErr] = useState("");

  const activeRange = resolvePublishedYearRange({
    mode,
    from: mode === "custom" ? appliedCustom.from : undefined,
    to: mode === "custom" ? appliedCustom.to : undefined,
  });

  function handleApplyCustom() {
    const from = parseYearInput(customFrom);
    const to = parseYearInput(customTo);
    if (from == null && to == null) {
      setCustomErr("Enter at least a from or to year.");
      return;
    }
    setCustomErr("");
    onApplyCustom({ from, to });
  }

  return (
    <div className="pub-year-filter">
      <div className="pub-year-label">Search by time published</div>
      <div className="pub-year-hint">
        Limits journal references found for lecturer summaries.
        {activeRange.active ? (
          <span className="pub-year-active">
            {" "}
            Active: {formatPublishedYearRangeLabel(activeRange)}
          </span>
        ) : null}
      </div>
      <div className="pub-year-pills" role="group" aria-label="Publication year">
        {PUBLISHED_YEAR_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pub-year-pill${mode === p.id ? " on" : ""}`}
            aria-pressed={mode === p.id}
            onClick={() => {
              setCustomErr("");
              onModeChange(p.id);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {mode === "custom" ? (
        <div className="pub-year-custom">
          <div className="pub-year-range-row">
            <input
              type="text"
              inputMode="numeric"
              className="pub-year-inp"
              placeholder="From"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              aria-label="Publication year from"
            />
            <span className="pub-year-dash" aria-hidden>
              –
            </span>
            <input
              type="text"
              inputMode="numeric"
              className="pub-year-inp"
              placeholder="To"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              aria-label="Publication year to"
            />
          </div>
          <button
            type="button"
            className="pub-year-search-btn"
            onClick={handleApplyCustom}
          >
            Search
          </button>
          {customErr ? (
            <div className="pub-year-err" role="alert">
              {customErr}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Build API payload fields from dashboard state.
 * Custom mode uses typed inputs first, then last applied range from Search.
 */
export function publishedYearStateToPayload(
  mode,
  customFrom,
  customTo,
  appliedCustom = { from: null, to: null },
) {
  const fromInput =
    mode === "custom" ? parseYearInput(customFrom) : null;
  const toInput = mode === "custom" ? parseYearInput(customTo) : null;
  const range = resolvePublishedYearRange({
    mode,
    from:
      mode === "custom"
        ? fromInput ?? appliedCustom.from ?? null
        : undefined,
    to:
      mode === "custom" ? toInput ?? appliedCustom.to ?? null : undefined,
  });
  return {
    publishedYearMode: mode,
    publishedYearFrom: range.from,
    publishedYearTo: range.to,
  };
}
