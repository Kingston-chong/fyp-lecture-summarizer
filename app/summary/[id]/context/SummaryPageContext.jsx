"use client";

import { createContext, useContext, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { parseNumericSummaryId } from "../helpers";

const SummaryPageContext = createContext(null);

export function SummaryPageProvider({ summary, children }) {
  const { data: session, status } = useSession();
  const params = useParams();
  const summaryId = params?.id;
  const numericSummaryId = useMemo(
    () => parseNumericSummaryId(summaryId),
    [summaryId],
  );

  const value = useMemo(
    () => ({ summaryId, numericSummaryId, summary, session, status }),
    [summaryId, numericSummaryId, summary, session, status],
  );

  return (
    <SummaryPageContext.Provider value={value}>
      {children}
    </SummaryPageContext.Provider>
  );
}

export function useSummaryPage() {
  const ctx = useContext(SummaryPageContext);
  if (!ctx)
    throw new Error("useSummaryPage must be used within SummaryPageProvider");
  return ctx;
}
