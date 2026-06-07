/**
 * Render an HTML document string to a multi-page A4 PDF download (client-only).
 * @param {{
 *   html: string;
 *   filename: string;
 *   captureRootClass?: string;
 *   inlineStyles?: string;
 *   stripFontImport?: boolean;
 * }} options
 */
export async function downloadHtmlDocumentAsPdf({
  html,
  filename,
  captureRootClass = "pdf-capture-root",
  inlineStyles = "",
  stripFontImport = true,
}) {
  if (typeof document === "undefined") return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const mount = document.createElement("div");
  mount.className = captureRootClass;
  mount.style.cssText =
    "position:fixed;left:-12000px;top:0;width:800px;z-index:-1;pointer-events:none;";
  mount.innerHTML = doc.body?.innerHTML || "";

  if (inlineStyles) {
    const styleEl = document.createElement("style");
    styleEl.textContent = stripFontImport
      ? inlineStyles.replace(/@import[^;]+;/g, "")
      : inlineStyles;
    mount.prepend(styleEl);
  }

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

    pdf.save(filename);
  } finally {
    mount.remove();
  }
}

/**
 * @param {string} title
 * @param {string} [suffix]
 */
export function sanitizePdfFilename(title, suffix = "") {
  const base =
    String(title || "export")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 72) || "export";
  const tail = suffix ? `-${suffix}` : "";
  return `${base}${tail}.pdf`;
}
