import { markdownToHtml } from "@/lib/markdown";
import {
  formatRevisionSheetQaMarkdown,
  splitRevisionSheetAtQuickQa,
} from "@/lib/revisionSheetQa";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qaSectionToHtml(qaMarkdown) {
  const lines = String(qaMarkdown || "").split("\n");
  let html = "";
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    i += 1;
    if (!trimmed) continue;

    if (/^#\s/.test(trimmed)) {
      html += markdownToHtml(`${trimmed}\n`);
      continue;
    }

    const qMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (qMatch) {
      const answerLines = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) {
          i += 1;
          continue;
        }
        if (/^#\s/.test(next) || /^\*\*.+\*\*$/.test(next)) break;
        answerLines.push(next);
        i += 1;
      }
      html += `<div class="rs-qa-item"><p class="rs-qa-q"><strong>${escapeHtml(qMatch[1].trim())}</strong></p>`;
      if (answerLines.length) {
        html += `<p class="rs-qa-a">${markdownToHtml(answerLines.join("\n\n"))}</p>`;
      }
      html += "</div>";
      continue;
    }

    html += markdownToHtml(`${trimmed}\n`);
  }

  return html;
}

function revisionSheetBodyHtml(markdown) {
  const formatted = formatRevisionSheetQaMarkdown(markdown || "");
  const { before, qa } = splitRevisionSheetAtQuickQa(formatted);
  let html = "";
  if (before) html += markdownToHtml(before);
  if (qa) {
    html += `<div class="rs-qa">${qaSectionToHtml(qa)}</div>`;
  }
  return html || markdownToHtml(formatted);
}

const REVISION_SHEET_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body,.rs-pdf-capture-root{font-family:'Sora',sans-serif;color:#18182a;background:#fff;padding:48px 52px 56px;max-width:800px;font-size:13.5px;line-height:1.72}
.brand{font-size:10px;font-weight:600;color:#6366f1;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
h1.doc-title{font-size:22px;font-weight:700;color:#18182a;margin-bottom:8px;line-height:1.3}
.meta{font-size:11.5px;color:#666;margin-bottom:28px}
.rs-body h1{font-size:18px;font-weight:700;margin:28px 0 12px;color:#1e1e32}
.rs-body h2{font-size:14px;font-weight:700;margin:20px 0 10px;color:#3730a3}
.rs-body h3{font-size:13px;font-weight:600;margin:14px 0 8px}
.rs-body p{margin:0 0 10px}
.rs-body ul,.rs-body ol{margin:0 0 12px 0 0 1.2em;padding:0}
.rs-body li{margin-bottom:6px}
.rs-body strong{font-weight:600;color:#1a1a2e}
.rs-body code{font-size:12px;background:#f4f4fb;padding:1px 5px;border-radius:4px}
.rs-body pre{background:#f4f4fb;padding:12px;border-radius:8px;overflow-x:auto;margin-bottom:12px}
.rs-body hr{border:none;border-top:1px solid #e8e8f0;margin:24px 0}
.rs-body blockquote{border-left:3px solid #6366f1;padding-left:12px;color:#444;margin:12px 0}
.rs-qa{margin-top:8px;padding-top:8px;border-top:1px solid #e8e8f0}
.rs-qa h1{font-size:18px;font-weight:700;margin:20px 0 14px;color:#1e1e32}
.rs-qa-item{margin-bottom:18px}
.rs-qa-q{margin:0 0 6px;font-weight:700;font-size:13.5px;color:#1a1a2e;line-height:1.45}
.rs-qa-q strong{font-weight:700}
.rs-qa-a{margin:0;color:#2a2a3e;line-height:1.65}
.rs-qa-a p{margin:0 0 6px}
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e8e8f0;font-size:10.5px;color:#999;text-align:center}
`;

/**
 * @param {{ title: string; markdown: string }} params
 * @returns {string} full HTML document for preview
 */
export function buildRevisionSheetHtml({ title, markdown }) {
  const bodyHtml = revisionSheetBodyHtml(markdown);
  const safeTitle = escapeHtml(title || "Revision sheet");
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${safeTitle} — Revision Sheet</title>
<style>${REVISION_SHEET_STYLES}</style></head><body>
<div class="brand">Slide2Notes — Student Revision Sheet</div>
<h1 class="doc-title">${safeTitle}</h1>
<div class="meta">Generated ${escapeHtml(dateStr)} · For exam preparation</div>
<div class="rs-body">${bodyHtml}</div>
<div class="footer">Slide2Notes revision sheet · ${escapeHtml(dateStr)}</div>
</body></html>`;
}

/**
 * @param {string} html
 * @returns {string} blob URL (caller must revoke)
 */
export function createRevisionSheetPreviewUrl(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function sanitizePdfFilename(title) {
  const base =
    String(title || "revision-sheet")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 72) || "revision-sheet";
  return `${base}-revision-sheet.pdf`;
}

/**
 * Render revision sheet HTML to a PDF file download (no print dialog).
 * @param {string} html full document from buildRevisionSheetHtml
 * @param {string} [title]
 */
export async function downloadRevisionSheetPdf(html, title) {
  if (typeof document === "undefined") return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const mount = document.createElement("div");
  mount.className = "rs-pdf-capture-root";
  mount.style.cssText =
    "position:fixed;left:-12000px;top:0;width:800px;z-index:-1;pointer-events:none;";
  mount.innerHTML = doc.body?.innerHTML || "";

  const styleEl = document.createElement("style");
  styleEl.textContent = REVISION_SHEET_STYLES.replace(
    "@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');",
    "",
  );
  mount.prepend(styleEl);

  document.body.appendChild(mount);

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    await document.fonts?.ready;

    const canvas = await html2canvas(mount, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const pageContentHeight = pageHeight - margin * 2;

    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor(pageContentHeight * pxPerMm);

    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();

      const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const img = slice.toDataURL("image/jpeg", 0.92);
      const sliceHeightMm = sliceHeight / pxPerMm;
      pdf.addImage(img, "JPEG", margin, margin, contentWidth, sliceHeightMm);

      offsetY += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(sanitizePdfFilename(title));
  } finally {
    mount.remove();
  }
}
