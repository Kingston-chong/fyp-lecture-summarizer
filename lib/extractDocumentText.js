import { get } from "@vercel/blob";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export async function fetchBlobBuffer(url) {
  const result = await get(url, { access: "private", useCache: true });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Failed to fetch blob");
  }
  const res = new Response(result.stream);
  return Buffer.from(await res.arrayBuffer());
}

export async function extractDocumentTextFromBuffer(buffer, type) {
  switch (String(type || "").toUpperCase()) {
    case "PDF": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await unpdfExtractText(pdf, { mergePages: true });
      return text || "";
    }
    case "DOCX":
    case "DOC": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
    case "TXT":
    case "MD":
    case "CSV":
      return buffer.toString("utf-8");
    case "PPTX":
    case "PPT": {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      let text = "";
      const slideFiles = Object.keys(zip.files).filter(
        (f) => f.startsWith("ppt/slides/slide") && f.endsWith(".xml"),
      );
      for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async("string");
        text += xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") + "\n";
      }
      return text;
    }
    case "XLSX":
    case "XLS": {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let text = "";
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + "\n";
      }
      return text;
    }
    default:
      return buffer.toString("utf-8");
  }
}

export async function extractDocumentText(url, type) {
  const buffer = await fetchBlobBuffer(url);
  return extractDocumentTextFromBuffer(buffer, type);
}
