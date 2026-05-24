"use client";

import { useCallback, useId, useState } from "react";

export const SIDEBAR_SECTIONS_STORAGE_KEY = "sum-sources-sections-v1";

export function readSidebarSectionsStored() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeSidebarSectionsStored(next) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export default function CollapsibleSidebarSection({
  id,
  title,
  badge,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  actions = null,
  persist = true,
  children,
}) {
  const panelId = useId();
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(() => {
    if (!persist || !id) return defaultOpen;
    const stored = readSidebarSectionsStored();
    return typeof stored[id] === "boolean" ? stored[id] : defaultOpen;
  });
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next) => {
      if (isControlled) {
        onOpenChange?.(next);
      } else {
        setInternalOpen(next);
      }
      if (persist && id) {
        writeSidebarSectionsStored({
          ...readSidebarSectionsStored(),
          [id]: next,
        });
      }
    },
    [id, isControlled, onOpenChange, persist],
  );

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  return (
    <section className={`src-section${open ? " is-open" : " is-collapsed"}`}>
      <div className="src-section-head-row">
        <button
          type="button"
          className="src-section-head"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <svg
            className="src-section-chevron"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden
          >
            <path
              d="M3 2l4 3-4 3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="src-section-title">{title}</span>
          {badge != null && badge !== "" && (
            <span className="src-section-badge">{badge}</span>
          )}
        </button>
        {actions ? (
          <div
            className="src-section-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {open ? (
        <div id={panelId} className="src-section-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
