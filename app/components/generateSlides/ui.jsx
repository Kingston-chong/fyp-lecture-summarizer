"use client";

import { useState } from "react";
import { useTheme } from "../ThemeProvider.jsx";

export const CloseIco = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const UploadCloudIco = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const ChevDownIco = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const SlidesIco = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <polygon points="10 8 16 11 10 14 10 8" />
  </svg>
);

export function Dropdown({ value, onChange, options, width = 120 }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", width }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%",
          height: 32,
          padding: "0 10px",
          background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`,
          borderRadius: 7,
          fontFamily: "'Sora',sans-serif",
          fontSize: 12,
          color: isDark ? "#c0c0d8" : "#4a4a5a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          gap: 6,
          transition: "all .18s",
        }}
      >
        {value} <ChevDownIco />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: isDark ? "rgba(22,22,34,.98)" : "rgba(255,255,255,.98)",
            border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`,
            borderRadius: 8,
            padding: 4,
            boxShadow: isDark
              ? "0 12px 32px rgba(0,0,0,.5)"
              : "0 12px 32px rgba(0,0,0,.15)",
          }}
        >
          {options.map((o) => (
            <div
              key={o}
              onMouseDown={() => {
                onChange(o);
                setOpen(false);
              }}
              style={{
                padding: "7px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                color: value === o ? "#6366f1" : isDark ? "#b0b0cc" : "#555568",
                background:
                  value === o ? "rgba(99,102,241,.18)" : "transparent",
                fontWeight: value === o ? 500 : 400,
                transition: "background .12s",
              }}
              onMouseEnter={(e) => {
                if (value !== o)
                  e.currentTarget.style.background = isDark
                    ? "rgba(255,255,255,.05)"
                    : "rgba(0,0,0,.05)";
              }}
              onMouseLeave={(e) => {
                if (value !== o)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionHead({ children }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div
      style={{
        fontSize: 13.5,
        fontWeight: 700,
        color: isDark ? "#ddddf0" : "#1e1b4b",
        marginBottom: 10,
        marginTop: 2,
      }}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children, style }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div
      style={{
        fontSize: 11.5,
        color: isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.5)",
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const Divider = () => (
  <div
    style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "16px 0" }}
  />
);
