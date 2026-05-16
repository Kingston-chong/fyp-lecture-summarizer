/**
 * Build short follow-up prompts for the summary chat composer from markdown + headings.
 * @param {{ markdown?: string, headings?: { text: string }[], title?: string | null, max?: number, role?: 'student'|'lecturer' }} opts
 * @returns {string[]}
 */
export function buildChatSuggestions({
  markdown = "",
  headings = [],
  title = "",
  max = 4,
  role = "student",
}) {
  const md = String(markdown || "").trim();
  const maxOut = Math.min(5, Math.max(1, max));
  const isLecturer = role === "lecturer";
  const out = [];
  const seen = new Set();

  function push(s) {
    if (out.length >= maxOut) return;
    const t = String(s || "").trim();
    if (!t || t.length > 220) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  }

  const TOPIC_MAX = 72;
  function clipTopic(s) {
    const x = String(s || "")
      .trim()
      .replace(/\s+/g, " ");
    if (x.length <= TOPIC_MAX) return x;
    return `${x.slice(0, TOPIC_MAX - 1)}…`;
  }

  const headingTemplatesStudent = [
    (h) => `Explain “${h}” in simpler terms.`,
    (h) => `What are the key takeaways about “${h}”?`,
    (h) => `How does “${h}” relate to the rest of this summary?`,
    (h) => `Give me a concrete example that illustrates “${h}”.`,
  ];

  const headingTemplatesLecturer = [
    (h) =>
      `What evidence supports the claims in “${h}”? Cite sources with links.`,
    (h) => `Find academic and web references for “${h}”.`,
    (h) => `What limitations or caveats apply to “${h}”?`,
    (h) => `How would you teach “${h}” in a graduate seminar?`,
  ];

  const headingTemplates = isLecturer
    ? headingTemplatesLecturer
    : headingTemplatesStudent;

  const usableHeadings = (Array.isArray(headings) ? headings : [])
    .map((h) => String(h?.text || "").trim())
    .filter(Boolean)
    .filter((t) => t.length <= 200);

  for (let i = 0; i < usableHeadings.length && out.length < maxOut; i++) {
    const h = clipTopic(usableHeadings[i]);
    const fn = headingTemplates[i % headingTemplates.length];
    push(fn(h));
  }

  if (out.length >= maxOut) return out.slice(0, maxOut);

  const bodySnippet = extractBodySnippet(md);
  if (bodySnippet) {
    const sn = clipTopic(bodySnippet);
    if (isLecturer) {
      push(
        `Which claims in this section need stronger citations? Context: ${sn}`,
      );
      push(`List references with hyperlinks for: ${sn}`);
      push(`What should go on slides vs speaker notes for: ${sn}`);
    } else {
      push(
        `Summarize the main idea of this part in one short paragraph: ${sn}`,
      );
      push(`What should I remember most from this section? (${sn})`);
      push(`What questions might an exam ask about this? Context: ${sn}`);
    }
  }

  if (out.length >= maxOut) return out.slice(0, maxOut);

  const docTitle = String(title || "").trim();
  if (docTitle) {
    const dt = clipTopic(docTitle);
    if (isLecturer) {
      push(`Find academic and web sources with links for “${dt}”.`);
      push(`Which parts of “${dt}” are under-supported by evidence?`);
    } else {
      push(`What is the main takeaway from “${dt}”?`);
      push(`List the 3 most important points from “${dt}”.`);
    }
  }

  if (isLecturer) {
    push(
      "Find references with hyperlinks for the main topics in this summary.",
    );
    push("Which claims need citations or stronger evidence?");
    push("Draft 3 discussion questions for a graduate seminar.");
    push("What belongs on slides vs speaker notes for this lecture?");
  } else {
    push("What is the main takeaway from this summary?");
    push("Explain the hardest concept here as if I am new to the topic.");
    push("What should I review or look up next to go deeper?");
  }

  return out.slice(0, maxOut);
}

/**
 * Rough plain-text snippet from markdown when there are no headings to use.
 * @param {string} md
 * @returns {string}
 */
function extractBodySnippet(md) {
  if (!md) return "";

  let s = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+.+$/gm, " ")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length < 24) return "";

  const parts = s.split(/\.\s+/).filter((x) => x.length > 12);
  const first = parts[0] ? `${parts[0].trim()}.` : s.slice(0, 140);
  const second = parts[1] && parts[1].length < 100 ? `${parts[1].trim()}.` : "";
  const combined = second ? `${first} ${second}` : first;
  return combined.slice(0, 200);
}
