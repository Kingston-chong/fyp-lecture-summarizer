function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/** Strip trailing sentence punctuation from an autolink / markdown URL when it is not part of the URL. */
function trimUrlTail(raw) {
  let u = String(raw || "").trim();
  while (u.length > 8) {
    const last = u[u.length - 1];
    if (!/[.,;:!?)\]]/.test(last)) break;
    const next = u.slice(0, -1);
    if (isHttpUrl(next)) u = next;
    else break;
  }
  return u;
}

/** Undo minimal entity encoding inside a URL captured from already-escaped markdown. */
function decodeUrlFromEscapedMd(s) {
  return String(s || "").replace(/&amp;/gi, "&");
}

function escapeHtmlBody(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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

  // Markdown [label](https://...) and bare https:// URLs → clickable links (http(s) only)
  const mdLinkHtml = [];
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi,
    (full, label, urlRaw) => {
      let url = trimUrlTail(decodeUrlFromEscapedMd(urlRaw.trim()));
      while (url.length > 8 && url.endsWith(")") && !isHttpUrl(url)) {
        url = url.slice(0, -1);
      }
      url = trimUrlTail(url);
      if (!isHttpUrl(url)) return full;
      const idx = mdLinkHtml.length;
      // Clickable, copy-friendly text is the URL itself (not only the bracket title).
      const labelTrim = label.trim();
      const showTitle =
        labelTrim.length > 0 && decodeUrlFromEscapedMd(labelTrim) !== url;
      const anchor = `<a href="${escapeHtmlAttr(url)}" rel="noopener noreferrer" target="_blank">${escapeHtmlBody(url)}</a>`;
      const inner = showTitle
        ? `<span class="md-link-preface">${label}</span> ${anchor}`
        : anchor;
      mdLinkHtml.push(inner);
      return `@@MDLINK_${idx}@@`;
    },
  );

  text = text.replace(/https?:\/\/[^\s<&]+/gi, (full) => {
    if (/^@@/.test(full)) return full;
    const url = trimUrlTail(full);
    if (!isHttpUrl(url) || url.length < 8) return full;
    return `<a href="${escapeHtmlAttr(url)}" rel="noopener noreferrer" target="_blank">${url}</a>`;
  });

  text = text.replace(
    /@@MDLINK_(\d+)@@/g,
    (_m, i) => mdLinkHtml[Number(i)] || "",
  );

  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  text = text.replace(/(\*|_)([^*_]+)\1/g, "<em>$2</em>");
  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings (# ## ### …) before lists so "### Title\n- item" does not get merged into one paragraph.
  text = text.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  text = text.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  text = text.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  text = text.replace(/^[ \t]*(-{3,}|\*{3,})[ \t]*$/gm, "<hr/>");

  // Ordered lists — allow leading indent so nested-style "  1. " still parses as a list block
  text = text.replace(/((?:^[ \t]*\d+[.)]\s+.+\n?)+)/gm, (block) => {
    const items = block
      .trimEnd()
      .split(/\n/)
      .map((line) => line.replace(/^[ \t]*\d+[.)]\s+(.+)$/, "<li>$1</li>"))
      .filter((x) => x.startsWith("<li>"));
    return items.length ? `<ol>${items.join("")}</ol>` : block;
  });

  // Bullet lists (- or *) — allow leading spaces/tabs so sub-bullets like "  - item" become <li>s
  text = text.replace(/((?:^[ \t]*[-*]\s+.+\n?)+)/gm, (block) => {
    const items = block
      .trimEnd()
      .split(/\n/)
      .map((line) => line.replace(/^[ \t]*[-*]\s+(.+)$/, "<li>$1</li>"))
      .filter((x) => x.startsWith("<li>"));
    return items.length ? `<ul>${items.join("")}</ul>` : block;
  });

  // Tables - robust line-by-line parser for varied AI output (| col | col | or col | col)
  const tableBlocks = [];
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  function parseCellCount(row) {
    const trimmed = row.trim();
    if (!trimmed.includes("|")) return 0;
    const parts = trimmed
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length >= 2 ? parts.length : 0;
  }

  function isSeparatorLine(row) {
    const t = row.trim();
    if (!t.includes("|")) return false;
    const inner = t.replace(/\|/g, "").trim();
    return inner.length >= 2 && /^[\s\-:]+$/.test(inner);
  }

  function parseRow(row) {
    const trimmed = row.trim();
    if (!trimmed.includes("|")) return [];
    const parts = trimmed.split("|").map((p) => p.trim());
    const start = trimmed.startsWith("|") ? 1 : 0;
    const end = trimmed.endsWith("|") ? parts.length - 1 : parts.length;
    return parts.slice(start, end).map((c) => c.trim());
  }

  while (i < lines.length) {
    const line = lines[i];
    const cellCount = parseCellCount(line);
    const nextLine = lines[i + 1];
    const nextIsSeparator = nextLine != null && isSeparatorLine(nextLine);

    if (cellCount >= 2 && nextIsSeparator) {
      const headerCells = parseRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length) {
        if (isSeparatorLine(lines[i])) {
          i++;
          continue;
        }
        const cells = parseRow(lines[i]);
        if (cells.length !== headerCells.length) break;
        bodyRows.push(cells);
        i++;
      }
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`
        : "";
      const idx = tableBlocks.length;
      tableBlocks.push(`<table>${thead}${tbody}</table>`);
      result.push(`\n\n@@TABLE_${idx}@@\n\n`);
      continue;
    }
    result.push(line + (i < lines.length - 1 ? "\n" : ""));
    i++;
  }

  text = result.join("");

  // Paragraphs & line breaks - split blocks; handle blocks that mix table placeholder with trailing content
  const blocks = text.split(/\n{2,}/);
  const parts = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(h[1-6]|ul|ol|table|pre|hr|blockquote|p)\b/i.test(trimmed))
      return trimmed;
    if (/^@@TABLE_\d+@@$/.test(trimmed)) return trimmed;
    // Block has table placeholder + more content: emit table then process the rest as paragraphs/headings
    if (trimmed.includes("@@TABLE_")) {
      return trimmed
        .split(/(@@TABLE_\d+@@)/)
        .map((seg) => {
          const s = seg.trim();
          if (!s) return "";
          if (/^@@TABLE_\d+@@$/.test(s)) return s;
          return s
            .split(/\n+/)
            .map((line) => {
              const t = line.trim();
              if (!t) return "";
              if (/^<h[1-6]\b/i.test(t) || /^<(ol|ul)\b/i.test(t)) return t;
              return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
            })
            .join("");
        })
        .join("");
    }
    return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
  });
  let html = parts.join("");

  // Restore code blocks
  html = html.replace(
    /@@CODE_BLOCK_(\d+)@@/g,
    (_m, i) => codeBlocks[Number(i)] || "",
  );

  // Restore tables
  html = html.replace(
    /@@TABLE_(\d+)@@/g,
    (_m, i) => tableBlocks[Number(i)] || "",
  );

  return html;
}
