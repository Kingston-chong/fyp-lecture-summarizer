/**
 * Reference bibliography rendering (markdown + HTML) with clickable URLs.
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {{ url?: string|null, doi?: string|null }} ref
 */
export function resolveReferenceUrl(ref) {
  const url = String(ref?.url || "").trim();
  if (isHttpUrl(url)) return url;
  const doi = String(ref?.doi || "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();
  if (doi) return `https://doi.org/${doi}`;
  return null;
}

/**
 * Build a minimal ref object for citation popovers when marker points at an upload
 * (markers [1]…[files.length] match summary.files order from summarization).
 */
export function syntheticUploadReference(marker, files) {
  const idx = Number(marker) - 1;
  const f = Array.isArray(files) ? files[idx] : null;
  if (!f) return null;
  return {
    id: null,
    marker: Number(marker),
    kind: "upload",
    title: String(f.name || "Uploaded file").trim(),
    authors: null,
    year: null,
    venue: null,
    doi: null,
    url: null,
    abstract: null,
    provider: null,
    anchorIds: [],
  };
}

/**
 * @param {string} markdown
 */
export function splitMarkdownBeforeReferences(markdown) {
  const m = String(markdown || "");
  const match = m.match(/\n(#{1,3}\s*references\s*\n[\s\S]*)$/i);
  if (!match) {
    return { body: m.trimEnd(), referencesMarkdown: "" };
  }
  return {
    body: m.slice(0, match.index).trimEnd(),
    referencesMarkdown: match[1].trim(),
  };
}

/**
 * @param {{ marker: number, kind: string, title: string, authors?: string|null, year?: number|null, url?: string|null, doi?: string|null, venue?: string|null }} ref
 */
function formatRefTitleMarkdown(ref) {
  const title = String(ref.title || "Untitled").trim();
  const href = resolveReferenceUrl(ref);
  if (ref.kind === "upload" || !href) return title;
  const safeTitle = title.replace(/]/g, "\\]");
  return `[${safeTitle}](${href})`;
}

/**
 * @param {{ marker: number, kind: string, title: string, authors?: string|null, year?: number|null, url?: string|null, doi?: string|null, venue?: string|null }[]} catalog
 */
export function buildReferencesSectionMarkdown(catalog) {
  if (!catalog?.length) {
    return "- No verifiable source references were produced for this summary.";
  }

  return catalog
    .map((ref) => {
      const titlePart = formatRefTitleMarkdown(ref);
      const parts = [`[${ref.marker}]`, titlePart];
      if (ref.kind !== "upload") {
        if (ref.authors) parts.push(`— ${ref.authors}`);
        if (ref.year) parts.push(`(${ref.year})`);
        if (ref.venue) parts.push(`· ${ref.venue}`);
        if (ref.doi && !resolveReferenceUrl(ref)) {
          parts.push(`DOI: ${ref.doi}`);
        }
      }
      return `- ${parts.join(" ")}`;
    })
    .join("\n");
}

/**
 * @param {{ marker: number, kind: string, title: string, authors?: string|null, year?: number|null, venue?: string|null, url?: string|null, doi?: string|null, abstract?: string|null }[]} references
 */
export function buildReferencesSectionHtml(references) {
  if (!references?.length) {
    return `<h2>References</h2><ul class="ref-biblio"><li class="ref-biblio-empty">No references available.</li></ul>`;
  }

  const items = references
    .map((ref) => {
      const marker = ref.marker;
      const title = escapeHtml(ref.title || "Untitled");
      const href = resolveReferenceUrl(ref);
      const titleHtml =
        href && ref.kind !== "upload"
          ? `<a href="${escapeHtmlAttr(href)}" class="ref-biblio-link" target="_blank" rel="noopener noreferrer">${title}</a>`
          : `<span class="ref-biblio-title">${title}</span>`;

      const meta = [ref.authors, ref.year, ref.venue]
        .filter(Boolean)
        .map((x) => escapeHtml(String(x)))
        .join(" · ");

      const kindLabel =
        ref.kind === "upload"
          ? "Uploaded file"
          : ref.kind === "paper"
            ? "Academic"
            : "Web";

      let doiHtml = "";
      if (ref.doi && !href) {
        const doiUrl = `https://doi.org/${escapeHtmlAttr(String(ref.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""))}`;
        doiHtml = `<span class="ref-biblio-doi"><a href="${doiUrl}" target="_blank" rel="noopener noreferrer">DOI</a></span>`;
      }

      return `<li id="ref-${marker}" class="ref-biblio-item" data-marker="${marker}">
        <span class="ref-biblio-marker">[${marker}]</span>
        <span class="ref-biblio-body">
          ${titleHtml}
          ${meta ? `<span class="ref-biblio-meta">${meta}</span>` : ""}
          <span class="ref-biblio-kind">${escapeHtml(kindLabel)}</span>
          ${doiHtml}
        </span>
      </li>`;
    })
    .join("");

  return `<h2>References</h2><ul class="ref-biblio">${items}</ul>`;
}
