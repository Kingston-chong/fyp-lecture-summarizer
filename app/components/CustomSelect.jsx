"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "./icons";
import "./CustomSelect.css";

function normalizeOptions(options) {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

/**
 * Custom dropdown matching quiz/settings modal style (dark + light themes).
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: (string | { value: string, label: string, menuLabel?: string })[],
 *   width?: string | number,
 *   disabled?: boolean,
 *   className?: string,
 *   id?: string,
 *   "aria-labelledby"?: string,
 *   menuZIndex?: number,
 *   title?: string,
 * }} props
 */
export default function CustomSelect({
  value,
  onChange,
  options,
  width = "100%",
  disabled = false,
  className = "",
  id,
  "aria-labelledby": ariaLabelledBy,
  menuZIndex,
  title,
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => normalizeOptions(options), [options]);
  const selected = items.find((o) => o.value === value);
  const displayLabel = selected?.label ?? value ?? "";

  const wrapStyle = {
    width,
    ...(menuZIndex != null ? { "--custom-select-menu-z": menuZIndex } : {}),
  };

  return (
    <div
      className={`custom-select qsm-dropdown${open ? " custom-select--open" : ""} ${className}`.trim()}
      style={wrapStyle}
    >
      <button
        type="button"
        id={id}
        className="custom-select-btn qsm-dropdown-btn"
        title={title ?? displayLabel}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={ariaLabelledBy}
        onClick={() => !disabled && setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className="custom-select-label">{displayLabel}</span>
        <ChevronDownIcon size={12} />
      </button>
      {open && !disabled ? (
        <div className="custom-select-menu qsm-dropdown-menu" role="listbox">
          {items.map((o) => {
            const isSelected = value === o.value;
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-item qsm-dropdown-item${isSelected ? " custom-select-item--selected qsm-dropdown-item--selected" : ""}`}
                onMouseDown={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.menuLabel ?? o.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
