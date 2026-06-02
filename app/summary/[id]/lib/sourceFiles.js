/** Original summary sources plus chat-attached documents (deduped by id). */
export function mergeSummarySourceFiles(summary, extraSources = []) {
  const base = summary?.files || [];
  const extras = (extraSources || []).filter(
    (es) => es?.id != null && !base.some((f) => f.id === es.id),
  );
  return [...base, ...extras];
}
