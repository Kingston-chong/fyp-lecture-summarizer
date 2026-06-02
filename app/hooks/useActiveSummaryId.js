"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

/** Numeric summary id from `/summary/[id]` when that summary is open. */
export function useActiveSummaryId() {
  const pathname = usePathname();
  return useMemo(() => {
    const m = pathname?.match(/\/summary\/([^/]+)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [pathname]);
}
