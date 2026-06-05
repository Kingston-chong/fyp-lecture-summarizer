"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/app/components/icons";

/** @param {string} prev @param {string} suggestion @param {number} max */
export function appendPromptSuggestion(prev, suggestion, max = 500) {
  const cur = (prev || "").trim();
  if (!cur) return suggestion.slice(0, max);
  return `${cur}\n- ${suggestion}`.slice(0, max);
}

/**
 * @param {{
 *   suggestions: string[];
 *   onSelect: (text: string) => void;
 *   textareaClassName?: string;
 *   placeholder?: string;
 *   value: string;
 *   onChange: (value: string) => void;
 *   maxLength?: number;
 *   countLabel?: string;
 * }} props
 */
export default function PromptSuggestionsMenu({
  suggestions,
  onSelect,
  textareaClassName = "prompt-area",
  placeholder,
  value,
  onChange,
  maxLength = 500,
  countLabel,
}) {
  const [open, setOpen] = useState(false);

  const handlePick = (s) => {
    onSelect(appendPromptSuggestion(value, s, maxLength));
    setOpen(false);
  };

  return (
    <div className="prompt-editor">
      <div className="prompt-input-wrap">
        <div className="prompt-suggestions-anchor">
          <button
            type="button"
            className={`prompt-suggestions-btn${open ? " open" : ""}`}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          >
            <span>Suggestions</span>
            <ChevronDownIcon />
          </button>
          {open && (
            <ul
              className="prompt-suggestions-menu"
              role="listbox"
              aria-label="Prompt suggestions"
            >
              {suggestions.map((s) => (
                <li key={s} role="option">
                  <button
                    type="button"
                    className="prompt-suggestions-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(s)}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <textarea
          className={textareaClassName}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        />
      </div>
      {countLabel != null ? (
        <div className="prompt-count">{countLabel}</div>
      ) : null}
    </div>
  );
}
