"use client";

import { useEffect, useState } from "react";

const DOT_CYCLE = [".", "..", "..."];

/**
 * Animated trailing dots: "." → ".." → "..." (loops).
 * @param {{ intervalMs?: number, className?: string }} props
 */
export function LoadingDots({ intervalMs = 450, className }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % DOT_CYCLE.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return (
    <span className={className} aria-hidden="true">
      {DOT_CYCLE[index]}
    </span>
  );
}

/**
 * Button / label text with cycling dots while `active`.
 * Strips a trailing "…" or "..." from `children` before animating.
 *
 * @param {{
 *   active: boolean;
 *   idle?: import('react').ReactNode;
 *   children?: import('react').ReactNode;
 *   intervalMs?: number;
 * }} props
 */
export function LoadingText({ active, idle, children, intervalMs = 450 }) {
  if (!active) return idle ?? children ?? null;

  const base = String(children ?? "")
    .replace(/[.…]+\s*$/u, "")
    .trimEnd();

  return (
    <>
      {base}
      <LoadingDots intervalMs={intervalMs} />
    </>
  );
}
