const QA_HEADING_RE = /^#\s*Quick Q&A/i;

/**
 * Normalize Q&A section: bold question line, answer below, no Q:/A: labels.
 * @param {string} markdown
 */
export function formatRevisionSheetQaMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  const out = [];
  let inQa = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (QA_HEADING_RE.test(trimmed)) {
      inQa = true;
      out.push(line);
      continue;
    }

    if (inQa && /^#\s+/.test(trimmed) && !QA_HEADING_RE.test(trimmed)) {
      inQa = false;
    }

    if (inQa && trimmed) {
      const qBold = trimmed.match(/^\*\*Q:\*\*\s*(.+)$/i);
      if (qBold) {
        out.push(`**${qBold[1].trim()}**`);
        continue;
      }
      const aPlain = trimmed.match(/^\*\*A:\*\*\s*(.+)$/i);
      if (aPlain) {
        out.push(aPlain[1].trim());
        continue;
      }
      if (/^\*\*Q:\*\*$/i.test(trimmed)) continue;
      if (/^\*\*A:\*\*$/i.test(trimmed)) continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/**
 * @param {string} markdown
 * @returns {{ before: string; qa: string | null }}
 */
export function splitRevisionSheetAtQuickQa(markdown) {
  const text = String(markdown || "");
  const match = text.match(/^#\s*Quick Q&A[^\n]*\n/im);
  if (!match || match.index == null) {
    return { before: text, qa: null };
  }
  const idx = match.index;
  return {
    before: text.slice(0, idx).trimEnd(),
    qa: text.slice(idx).trim(),
  };
}
