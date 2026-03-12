export function markdownToHtml(markdown) {
  if (!markdown) return "";
  let text = String(markdown);

  // Escape HTML
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Preserve fenced code blocks
  const codeBlocks = [];
  text = text.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    const safe = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    codeBlocks.push(`<pre><code>${safe}</code></pre>`);
    return `@@CODE_BLOCK_${idx}@@`;
  });

  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  text = text.replace(/(\*|_)([^*_]+)\1/g, "<em>$2</em>");
  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Simple bullet lists
  text = text.replace(/^(?:-|\*) (.+)$/gm, "<li>$1</li>");
  text = text.replace(/(?:<li>.*<\/li>\s*)+/gm, (match) => {
    return `<ul>${match.trim()}</ul>`;
  });

  // Horizontal rules
  text = text.replace(/^[ \t]*(-{3,}|\*{3,})[ \t]*$/gm, "<hr/>");

  // Headings (#, ##, ###)
  text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Paragraphs & line breaks (avoid wrapping block elements)
  const blocks = text.split(/\n{2,}/);
  const parts = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(h[1-6]|ul|ol|pre|hr|blockquote)\b/i.test(trimmed)) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
  });
  let html = parts.join("");

  // Restore code blocks
  html = html.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, i) => codeBlocks[Number(i)] || "");

  return html;
}

