import { markdownToHtml } from "@/lib/markdown";
import { fmtDate, formatSummaryModelLabel } from "../helpers";

export function exportSummaryPdf(summary, messages, renderedSummaryHtml) {
  const dateStr = fmtDate(summary.createdAt);
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const stripPendingHighlights = (html) => {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("mark.s2n-hl-pending").forEach((m) => {
        const p = m.parentNode;
        if (!p) return;
        while (m.firstChild) p.insertBefore(m.firstChild, m);
        p.removeChild(m);
      });
      return doc.body.innerHTML;
    } catch {
      return html;
    }
  };
  const bodyHtml = renderedSummaryHtml
    ? stripPendingHighlights(renderedSummaryHtml)
    : markdownToHtml(summary.output || "");
  const msgsHtml = messages
    .map((m) => {
      const isUser = m.role === "user";
      const cls = isUser ? "msg-u" : "msg-a";
      const roleLabel = isUser
        ? "You"
        : escape(m.modelLabel || formatSummaryModelLabel(summary.model));
      let imgBlock = "";
      if (isUser && m.imagePreviews?.length) {
        imgBlock = `<div class="img-note">${m.imagePreviews.length} image(s) in export</div>`;
      } else if (isUser && m.lostPastedImageCount > 0) {
        imgBlock = `<div class="img-note">${m.lostPastedImageCount} pasted image(s) (not stored)</div>`;
      }
      const rawText = (m.content || "").trim();
      const mdSource =
        isUser &&
        rawText === "[Image message]" &&
        (m.imagePreviews?.length > 0 || m.lostPastedImageCount > 0)
          ? ""
          : m.content || "";
      const contentHtml = markdownToHtml(mdSource);
      return `<div class="msg ${cls}"><div class="role">${roleLabel}</div>${imgBlock}${contentHtml}</div>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escape(summary.title)} — Slide2Notes</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sora',sans-serif;color:#18182a;background:#fff;padding:52px;max-width:780px;margin:0 auto;font-size:13.5px;line-height:1.75}
.pdf-toolbar{position:sticky;top:0;z-index:20;display:flex;justify-content:flex-end;gap:8px;background:rgba(255,255,255,.95);backdrop-filter:blur(6px);padding:10px 0 12px;border-bottom:1px solid #ececf4;margin-bottom:12px}
.pdf-btn{border:1px solid #d6d6e5;border-radius:8px;background:#f8f8ff;color:#2a2a3e;font:600 12px 'Sora',sans-serif;padding:8px 12px;cursor:pointer}
.pdf-btn.primary{background:#6366f1;color:#fff;border-color:#6366f1}
.pdf-hint{font-size:11px;color:#666;align-self:center;margin-right:auto}
.brand{font-size:10px;font-weight:600;color:#6366f1;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
h1{font-size:24px;font-weight:600;color:#18182a;margin-bottom:14px;line-height:1.3}
.meta{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px}
.meta span{font-size:11.5px;color:#666}.meta b{color:#333}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:28px}
.chip{font-size:11px;padding:2px 10px;border-radius:4px;background:#f0f0ff;color:#6366f1;border:1px solid #ddd}
hr{border:none;border-top:1.5px solid #e8e8f0;margin:24px 0}
.sec{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6366f1;margin-bottom:14px}
.body{white-space:pre-wrap;color:#2a2a3e;line-height:1.8}
.msg{margin-bottom:12px;padding:11px 14px;border-radius:8px;font-size:13px}
.msg-u{background:#f0f0ff;border-left:3px solid #6366f1}
.msg-a{background:#f8f8fa;border-left:3px solid #ddd}
.role{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#999;margin-bottom:5px}
.footer{margin-top:44px;padding-top:14px;border-top:1px solid #e8e8f0;font-size:10.5px;color:#bbb;text-align:center}
@media print{.pdf-toolbar{display:none}body{padding:36px}}
</style></head><body>
<div class="pdf-toolbar">
  <div class="pdf-hint">Use Download PDF to save this page as a PDF.</div>
  <button class="pdf-btn primary" onclick="window.print()">Download PDF</button>
  <button class="pdf-btn" onclick="window.print()">Print</button>
</div>
<div class="brand">Slide2Notes — Summary Export</div>
<h1>${escape(summary.title)}</h1>
<div class="meta">
  <span><b>Model:</b> ${escape(summary.model)}</span>
  <span><b>Mode:</b> ${escape(summary.summarizeFor)}</span>
  <span><b>Generated:</b> ${dateStr}</span>
</div>
<div class="chips">${summary.files.map((f) => `<span class="chip">${escape(f.name)}</span>`).join("")}</div>
<div class="sec">Summary Content</div>
<div class="body">${bodyHtml}</div>
${messages.length ? `<hr/><div class="sec">Chat History</div>${msgsHtml}` : ""}
<div class="footer">Exported from Slide2Notes · ${new Date().toLocaleDateString()}</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}