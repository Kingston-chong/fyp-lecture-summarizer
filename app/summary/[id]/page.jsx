"use client";

import {
  Fragment,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";
import { buildChatSuggestions } from "@/lib/chatSuggestionsFromSummary";
import GenerateSlidesModal from "@/app/components/GenerateSlidesModal";
import AlaiSlidesPreviewModal from "@/app/components/AlaiSlidesPreviewModal";
import QuizSettingsModal from "@/app/components/QuizSettingsModal";
import QuizViewModal from "@/app/components/QuizViewModal";
import Button from "@/app/components/ui/Button";
import {
  Chevron,
  Spinner,
  SendIco,
  CopyIco,
  RegenIco,
  HighlightIco,
  SaveIco,
  BotIco,
  UserIco,
  DocIco,
  QuizIco,
  PdfIco,
  SlidesIco,
  ClipIco,
} from "@/app/components/icons";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}, ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSlideDeckSavedAt(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Build QuizViewModal settings from persisted QuizSet.settings (and defaults for older rows). */
function settingsFromQuizSet(quizSet) {
  const s =
    quizSet?.settings && typeof quizSet.settings === "object"
      ? quizSet.settings
      : {};
  return {
    answerShowMode: s.answerShowMode ?? "Immediately",
    quizMode: s.quizMode ?? "Practice",
    timeLimit:
      typeof s.timeLimit === "number" && !Number.isNaN(s.timeLimit)
        ? s.timeLimit
        : 0,
  };
}

/** Display label for stored summary model e.g. `gemini:gemini-2.0-flash` → Gemini */
function formatSummaryModelLabel(stored) {
  if (!stored) return "—";
  const s = String(stored);
  const i = s.indexOf(":");
  const key = (i === -1 ? s : s.slice(0, i)).toLowerCase();
  const map = { chatgpt: "ChatGPT", deepseek: "DeepSeek", gemini: "Gemini" };
  return map[key] || key;
}

const HIGHLIGHT_PRESETS = [
  { hex: "#fef08a", label: "Yellow" },
  { hex: "#fca5a5", label: "Red" },
  { hex: "#86efac", label: "Green" },
  { hex: "#93c5fd", label: "Blue" },
  { hex: "#f0abfc", label: "Magenta" },
  { hex: "#fdba74", label: "Orange" },
  { hex: "#67e8f9", label: "Cyan" },
];

const DEFAULT_HL_HEX = HIGHLIGHT_PRESETS[0].hex;

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return `rgba(254, 240, 138, ${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function unwrapHighlightMarks(root) {
  if (!root) return;
  root.querySelectorAll("mark.s2n-hl").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
}

/** Translucent fill + inherited text color so overlapping <mark>s stack like Edge / PDF highlighters */
function applyHighlightBlockStyle(mark, colorHex) {
  const color =
    colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const fill = hexToRgba(color, 0.38);
  mark.style.background = "none";
  mark.style.backgroundColor = fill;
  mark.style.color = "inherit";
  mark.style.boxDecorationBreak = "clone";
  mark.style.webkitBoxDecorationBreak = "clone";
  mark.style.padding = "0.12em 0.14em";
  mark.style.borderRadius = "2px";
}

function collectTextNodesInOrder(root) {
  const nodes = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentElement?.closest?.("script,style")) continue;
    nodes.push(n);
  }
  return nodes;
}

/** Map first occurrence of quote to a Range (may span multiple text nodes / cross <mark> boundaries). */
function findRangeForSubstring(root, quote) {
  if (!root || !quote) return null;
  const nodes = collectTextNodesInOrder(root);
  if (!nodes.length) return null;
  const big = nodes.map((node) => node.textContent ?? "").join("");
  const idx = big.indexOf(quote);
  if (idx === -1) return null;
  const endIdx = idx + quote.length;
  let pos = 0;
  let startNode = null;
  let startOff = 0;
  let endNode = null;
  let endOff = 0;
  for (const node of nodes) {
    const t = node.textContent ?? "";
    const len = t.length;
    const a = pos;
    const b = pos + len;
    if (startNode === null && idx >= a && idx < b) {
      startNode = node;
      startOff = idx - a;
    }
    if (endIdx > a && endIdx <= b) {
      endNode = node;
      endOff = endIdx - a;
    }
    pos = b;
  }
  if (!startNode || endNode == null) return null;
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  return range;
}

/** Wrap first occurrence of quote; supports overlaps via extractContents + insertNode (not surroundContents). */
function wrapQuoteInRoot(root, quote, hlId, colorHex, pending) {
  if (!root || !quote) return false;
  const color =
    colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const range = findRangeForSubstring(root, quote);
  if (!range) return false;
  const mark = document.createElement("mark");
  mark.className = pending ? "s2n-hl s2n-hl-pending" : "s2n-hl";
  mark.dataset.hlId = String(hlId);
  mark.dataset.hlColor = color;
  applyHighlightBlockStyle(mark, color);
  try {
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);
    return true;
  } catch {
    return false;
  }
}

const MODELS = ["ChatGPT", "DeepSeek", "Gemini"];
const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";
/** Documents + images (one file picker for the clip button) */
const ATTACH_ACCEPT = `${ACCEPTED},image/*`;
const MAX_CHAT_PASTE_IMAGES = 6;
const CHAT_PASTE_MAX_EDGE = 1600;
const CHAT_PASTE_JPEG_QUALITY = 0.88;

/** Stable object so React does not treat summary body props as changing every render */
const SUMMARY_BODY_INNER_STYLE = { paddingTop: 8 };

/** @param {File} file */
function downscaleImageFileToJpegDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const max = CHAT_PASTE_MAX_EDGE;
        if (width > max || height > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", CHAT_PASTE_JPEG_QUALITY);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/** @param {{ role: string, content?: string, imagePreviews?: string[] }} m */
function chatMessageToApiPayload(m) {
  if (m.role === "ai") {
    return { role: "assistant", content: m.content || "" };
  }
  const text = (m.content || "").trim();
  const urls = m.imagePreviews || [];
  if (urls.length === 0) {
    return { role: "user", content: text };
  }
  /** @type {{ type: string, text?: string, image_url?: { url: string } }[]} */
  const parts = [];
  if (text) parts.push({ type: "text", text });
  for (const url of urls) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  return { role: "user", content: parts };
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportPDF(summary, messages, renderedSummaryHtml) {
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

// Component
export default function SummaryView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const summaryId = params?.id;

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [chatModel, setChatModel] = useState("ChatGPT");
  const [modelOpen, setModelOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  // Web fallback is automatic server-side (ChatGPT-like). No UI toggle needed.
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [sourceUploadLoading, setSourceUploadLoading] = useState(false);
  const [extraSources, setExtraSources] = useState([]);
  const [pendingSourceFiles, setPendingSourceFiles] = useState([]); // { clientId, file, name, type }
  /** Pasted screenshots for the next chat send — { clientId, dataUrl } */
  const [pendingPasteImages, setPendingPasteImages] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [slidesModal, setSlidesModal] = useState(false);
  const [quizModal, setQuizModal] = useState(false);
  const [quizView, setQuizView] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [quizSettings, setQuizSettings] = useState(null);
  const [slideDecks, setSlideDecks] = useState([]);
  const [slideDecksLoading, setSlideDecksLoading] = useState(false);
  const [slideDeckDeletingId, setSlideDeckDeletingId] = useState(null);
  const [slideDeckPreviewOpen, setSlideDeckPreviewOpen] = useState(false);
  const [slideDeckPreviewUrl, setSlideDeckPreviewUrl] = useState("");
  const [slideDeckRemotePptUrl, setSlideDeckRemotePptUrl] = useState("");
  const [slideDeckPreviewTitle, setSlideDeckPreviewTitle] = useState("");
  const slideDeckDlRef = useRef(null);
  const [quizSets, setQuizSets] = useState([]);
  const [quizSetsLoading, setQuizSetsLoading] = useState(false);
  const [quizSetOpeningId, setQuizSetOpeningId] = useState(null);
  const [quizHistoryOpenId, setQuizHistoryOpenId] = useState(null);
  const [quizHistoryLoading, setQuizHistoryLoading] = useState(false);
  const [quizHistoryList, setQuizHistoryList] = useState([]);
  const [quizHistoryQuestions, setQuizHistoryQuestions] = useState([]);
  const [quizAttemptDetail, setQuizAttemptDetail] = useState(null);
  const quizHistoryFetchTargetRef = useRef(null);
  const [highlights, setHighlights] = useState([]);
  const [pendingHighlights, setPendingHighlights] = useState([]);
  const [hlLoading, setHlLoading] = useState(false);
  const [hlModeActive, setHlModeActive] = useState(false);
  const [hlColorHex, setHlColorHex] = useState(DEFAULT_HL_HEX);
  const [hlColorMenuOpen, setHlColorMenuOpen] = useState(false);
  const [hlSaving, setHlSaving] = useState(false);
  /** Mobile: "More" bottom-sheet (shows full right panel content) */
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  /** Narrow layout: shorter action-bar labels + compact buttons */
  const [compactActBar, setCompactActBar] = useState(false);

  // Sources sidebar width + splitter (desktop)
  const [sourcesWidth, setSourcesWidth] = useState(260);
  const [splitterDragging, setSplitterDragging] = useState(false);
  const splitterRef = useRef(null); // { startX, startWidth }
  const [open, setOpen] = useState(false);

  const [chatTitleEditing, setChatTitleEditing] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [chatTitleSaving, setChatTitleSaving] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const chatTitleInputRef = useRef(null);
  const sourceInputRef = useRef(null);
  const summaryBodyRef = useRef(null);
  const hlToolbarRef = useRef(null);
  const lastSelectionTriggerRef = useRef(0);

  // Drag-to-resize sources sidebar (desktop)
  useEffect(() => {
    function onMove(e) {
      const drag = splitterRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const next = drag.startWidth + dx;
      setSourcesWidth(Math.max(220, Math.min(420, next)));
    }
    function onUp() {
      if (!splitterRef.current) return;
      splitterRef.current = null;
      setSplitterDragging(false);
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setCompactActBar(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  /** Turn off highlighter when switching summaries (same route, new id) */
  useEffect(() => {
    setHlModeActive(false);
    setHlColorMenuOpen(false);
    setPendingHighlights([]);
    setChatTitleEditing(false);
    setPendingPasteImages([]);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, [summaryId]);

  useEffect(() => {
    if (!chatTitleEditing) return;
    const id = requestAnimationFrame(() => {
      const el = chatTitleInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [chatTitleEditing]);

  useEffect(() => {
    function onCancelHighlighter() {
      setHlModeActive(false);
      setHlColorMenuOpen(false);
      setPendingHighlights([]);
      window.getSelection()?.removeAllRanges();
    }
    window.addEventListener("s2n-cancel-highlighter", onCancelHighlighter);
    return () =>
      window.removeEventListener("s2n-cancel-highlighter", onCancelHighlighter);
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Load summary
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId) return;

    let cancelled = false;
    async function load() {
      setSummaryLoading(true);
      setSummaryError("");
      try {
        const res = await fetch(`/api/summary/${summaryId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load summary");
        if (!cancelled) setSummary(data.summary);
      } catch (e) {
        if (!cancelled) setSummaryError(e?.message ?? "Failed to load summary");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  // Load persisted chat turns (so refresh/resume keeps the conversation)
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId) return;

    let cancelled = false;
    setMessages([]);

    async function loadChat() {
      try {
        const res = await fetch(`/api/summary/${summaryId}/chat`, {
          method: "GET",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load chat");
        if (cancelled) return;

        const dbMessages = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(
          dbMessages.map((m) => {
            const role = m.role === "assistant" ? "ai" : "user";
            if (
              role === "user" &&
              typeof m.content === "string" &&
              m.content.startsWith('{"v":1')
            ) {
              try {
                const o = JSON.parse(m.content);
                return {
                  id: m.id,
                  role: "user",
                  content: typeof o.t === "string" ? o.t : "",
                  lostPastedImageCount: Number(o.n) > 0 ? Number(o.n) : 0,
                  modelLabel: null,
                };
              } catch {
                /* fall through */
              }
            }
            return {
              id: m.id,
              role,
              content: m.content,
              modelLabel: m.role === "assistant" ? m.modelLabel : null,
            };
          }),
        );
      } catch {
        // If chat loading fails, keep the chat empty (fallback behavior).
        if (!cancelled) setMessages([]);
      }
    }

    loadChat();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  useEffect(() => {
    if (status !== "authenticated" || !summaryId) return;
    let cancelled = false;
    async function loadHl() {
      setHlLoading(true);
      try {
        const res = await fetch(`/api/summary/${summaryId}/highlights`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to load highlights");
        if (!cancelled) setHighlights(data.highlights || []);
      } catch {
        if (!cancelled) setHighlights([]);
      } finally {
        if (!cancelled) setHlLoading(false);
      }
    }
    loadHl();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  useLayoutEffect(() => {
    const root = summaryBodyRef.current;
    if (!root || !summary?.output) return;
    unwrapHighlightMarks(root);
    const pendingRows = pendingHighlights.map((p) => ({
      id: p.clientId,
      quote: p.quote,
      color: p.color,
      pending: true,
    }));
    const savedRows = highlights.map((h) => ({
      id: h.id,
      quote: h.quote,
      color: h.color,
      pending: false,
    }));
    const sorted = [...pendingRows, ...savedRows].sort(
      (a, b) => b.quote.length - a.quote.length,
    );
    for (const h of sorted) {
      const c =
        h.color && /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : DEFAULT_HL_HEX;
      wrapQuoteInRoot(root, h.quote, h.id, c, h.pending);
    }
  }, [summaryHtml, summary?.output, highlights, pendingHighlights]);

  useEffect(() => {
    function onDocDown(e) {
      if (hlToolbarRef.current?.contains(e.target)) return;
      setHlColorMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (pendingHighlights.length === 0) return;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingHighlights.length]);

  // Extract headings from markdown and broadcast for sidebar navigation
  useEffect(() => {
    if (!summary || !summary.output) {
      setHeadings([]);
      setSummaryHtml("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("s2n-summary-headings", { detail: [] }),
        );
      }
      return;
    }

    const md = summary.output;
    const found = [];
    const re = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = re.exec(md))) {
      const level = match[1].length;
      const text = match[2].trim();
      const slugBase =
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `section-${found.length}`;
      const id = `s2n-h-${slugBase}-${found.length}`;
      found.push({ id, level, text });
    }

    let html = markdownToHtml(md);
    found.forEach((h) => {
      const tag = `h${h.level}`;
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`<${tag}>${escaped}</${tag}>`);
      html = html.replace(pattern, `<${tag} id="${h.id}">${h.text}</${tag}>`);
    });

    setHeadings(found);
    setSummaryHtml(html);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("s2n-summary-headings", { detail: found }),
      );
    }
  }, [summary]);

  // Handle jump-to-heading requests from sidebar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const id = e.detail;
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("s2n-jump-to-heading", handler);
    return () => window.removeEventListener("s2n-jump-to-heading", handler);
  }, []);

  function handleCopySummary() {
    const text = summary?.output?.trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    });
  }

  function handleCopyMessage(m) {
    const text = (m?.content || "").trim();
    const imgN =
      (m?.imagePreviews?.length || 0) + (m?.lostPastedImageCount || 0);
    if (!text && !imgN) return;
    const clip =
      text +
      (imgN
        ? `${text ? "\n\n" : ""}[${imgN} image(s) in this message — copy text only]`
        : "");
    navigator.clipboard?.writeText(clip).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  async function addPastedImageFromFile(file) {
    if (!file?.type?.startsWith("image/")) return;
    try {
      const dataUrl = await downscaleImageFileToJpegDataUrl(file);
      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      let added = false;
      setPendingPasteImages((p) => {
        if (p.length >= MAX_CHAT_PASTE_IMAGES) return p;
        added = true;
        return [...p, { clientId, dataUrl }];
      });
      if (added) setChatNotice("");
      else {
        setChatNotice(
          `You can attach at most ${MAX_CHAT_PASTE_IMAGES} images per message.`,
        );
      }
    } catch {
      setChatNotice(
        "Could not add image. Try a different file or smaller image.",
      );
    }
  }

  async function addChatImagesFromFileList(fileList) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    for (const file of files) {
      await addPastedImageFromFile(file);
    }
  }

  async function handleAttachmentFilesSelected(fileList) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const docs = files.filter((f) => !f.type.startsWith("image/"));
    if (docs.length) handleSourceUpload(docs);
    if (images.length) await addChatImagesFromFileList(images);
  }

  function removePendingPasteByClientId(clientId) {
    setPendingPasteImages((p) => p.filter((x) => x.clientId !== clientId));
  }

  async function appendAssistantReplyGradually(reply, modelLabel, webSearch = null) {
    const text = String(reply || "");
    const msgId = Date.now() + 1;
    setMessages((p) => [
      ...p,
      {
        id: msgId,
        role: "ai",
        content: "",
        modelLabel,
        ...(webSearch ? { webSearch } : {}),
      },
    ]);

    const pieces = text.match(/.{1,16}(\s+|$)/g) || [text];
    for (const piece of pieces) {
      setMessages((p) =>
        p.map((m) =>
          m.id === msgId ? { ...m, content: `${m.content || ""}${piece}` } : m,
        ),
      );
      await new Promise((r) => setTimeout(r, 14));
    }
  }

  async function sendMessage(text) {
    const msg = (text ?? inputVal).trim();
    if (
      (!msg &&
        pendingPasteImages.length === 0 &&
        pendingSourceFiles.length === 0) ||
      chatLoading ||
      sourceUploadLoading
    )
      return;
    if (!summary?.output) return;
    const threadHasInlineImages = messages.some(
      (m) => m.role === "user" && (m.imagePreviews?.length || 0) > 0,
    );
    if (
      chatModel === "DeepSeek" &&
      (pendingPasteImages.length > 0 || threadHasInlineImages)
    ) {
      setChatNotice(
        "DeepSeek cannot view pasted images in this thread. Choose ChatGPT or Gemini, or refresh if you no longer need image context.",
      );
      return;
    }
    setChatNotice("");
    setInputVal("");
    const pasteSnapshot = pendingPasteImages.map((x) => x.dataUrl);
    const stagedDocSnapshot = pendingSourceFiles.map((f) => ({
      name: f.name,
      type: f.type,
    }));
    setPendingPasteImages([]);
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: msg,
      ...(pasteSnapshot.length > 0 ? { imagePreviews: pasteSnapshot } : {}),
      ...(stagedDocSnapshot.length > 0
        ? { attachedFiles: stagedDocSnapshot }
        : {}),
    };
    const historyPayload = [...messages, userMsg].map(chatMessageToApiPayload);
    const modelParam =
      chatModel === "DeepSeek"
        ? "deepseek"
        : chatModel === "Gemini"
          ? "gemini"
          : "chatgpt";
    setMessages((p) => [...p, userMsg]);
    setChatLoading(true);
    try {
      // Upload staged attachments right before sending (ChatGPT-like "upload on send").
      let nextExtraSources = extraSources;
      if (pendingSourceFiles.length > 0) {
        setSourceUploadLoading(true);
        try {
          const formData = new FormData();
          pendingSourceFiles.forEach((p) => formData.append("files", p.file));
          const upRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const upData = await upRes.json().catch(() => ({}));
          if (!upRes.ok) {
            throw new Error(upData?.error || "Attachment upload failed");
          }
          const docs = Array.isArray(upData?.documents) ? upData.documents : [];
          const baseIds = new Set(
            (summary?.files || []).map((d) => d?.id).filter(Boolean),
          );
          const existing = new Set(
            nextExtraSources.map((d) => d?.id).filter(Boolean),
          );
          const merged = docs.filter((d) => {
            if (!d?.id) return false;
            if (baseIds.has(d.id)) return false;
            if (existing.has(d.id)) return false;
            return true;
          });
          nextExtraSources = [...nextExtraSources, ...merged];
          setExtraSources(nextExtraSources);
          setPendingSourceFiles([]);
        } finally {
          setSourceUploadLoading(false);
        }
      }

      const attachedDocumentIds = nextExtraSources
        .map((d) => d?.id)
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: Number(summaryId),
          model: modelParam,
          modelLabel: chatModel,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Chat request failed");
      }
      const reply = (data?.reply || "").trim();
      if (!reply) throw new Error("Empty reply from assistant");
      const ws =
        data?.webSearch && typeof data.webSearch === "object"
          ? data.webSearch
          : null;
      await appendAssistantReplyGradually(reply, chatModel, ws);
    } catch (e) {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content:
            e?.message ??
            "Something went wrong (including possible attachment upload). Please try again.",
          error: true,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function regenerateLastResponse() {
    if (chatLoading || sourceUploadLoading || !summary?.output) return;
    const threadHasInlineImages = messages.some(
      (m) => m.role === "user" && (m.imagePreviews?.length || 0) > 0,
    );
    if (chatModel === "DeepSeek" && threadHasInlineImages) {
      setChatNotice(
        "Regenerate is unavailable with DeepSeek while this thread still has pasted image previews.",
      );
      return;
    }
    const idx = messages.length - 1;
    const last = messages[idx];
    if (!last || last.role !== "ai" || last.error) return;
    const prev = messages[idx - 1];
    if (!prev || prev.role !== "user") return;

    const removed = last;
    const historyPayload = messages.slice(0, -1).map(chatMessageToApiPayload);
    const modelParam =
      chatModel === "DeepSeek"
        ? "deepseek"
        : chatModel === "Gemini"
          ? "gemini"
          : "chatgpt";

    setChatNotice("");
    setMessages((p) => p.slice(0, -1));
    setChatLoading(true);
    try {
      const attachedDocumentIds = extraSources
        .map((d) => d?.id)
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: Number(summaryId),
          model: modelParam,
          modelLabel: chatModel,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
          regenerate: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Regenerate failed");
      }
      const reply = (data?.reply || "").trim();
      if (!reply) throw new Error("Empty reply from assistant");
      const ws =
        data?.webSearch && typeof data.webSearch === "object"
          ? data.webSearch
          : null;
      await appendAssistantReplyGradually(reply, chatModel, ws);
    } catch (e) {
      setMessages((p) => [...p, removed]);
      setChatNotice(
        (e?.message || "Could not regenerate. Try again.").toString(),
      );
    } finally {
      setChatLoading(false);
    }
  }

  function startChatTitleEdit() {
    if (!summary || summaryLoading || chatTitleSaving) return;
    setChatTitleDraft(summary.title || "");
    setChatTitleEditing(true);
  }

  async function saveChatTitle() {
    if (!summaryId || !summary) return;
    const next = chatTitleDraft.trim();
    const prev = (summary.title || "").trim();
    if (!next) {
      setChatTitleDraft(prev);
      setChatTitleEditing(false);
      return;
    }
    if (next === prev) {
      setChatTitleEditing(false);
      return;
    }
    setChatTitleSaving(true);
    try {
      const res = await fetch(`/api/summary/${summaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save title");
      setSummary((s) => (s ? { ...s, title: next } : s));
      setChatTitleEditing(false);
    } catch {
      setChatTitleDraft(prev);
      setChatTitleEditing(false);
    } finally {
      setChatTitleSaving(false);
    }
  }

  function onChatTitleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      chatTitleInputRef.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setChatTitleDraft((summary?.title || "").trim());
      setChatTitleEditing(false);
    }
  }

  function handlePDF() {
    if (!summary) return;
    setPdfLoading(true);
    exportPDF(summary, messages, summaryBodyRef.current?.innerHTML || "");
    setTimeout(() => setPdfLoading(false), 900);
  }

  const handleSummarySelectionTrigger = useCallback(() => {
    const root = summaryBodyRef.current;
    if (!root || !hlModeActive || hlSaving) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text || text.length > 2000) return;
    const anchor = sel.anchorNode;
    if (!anchor || !root.contains(anchor)) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) return;
    const clientId = `p-${crypto.randomUUID()}`;
    setPendingHighlights((prev) => [
      { clientId, quote: text, color: hlColorHex },
      ...prev,
    ]);
    window.getSelection()?.removeAllRanges();
  }, [hlModeActive, hlSaving, hlColorHex]);

  const handleSummaryMouseUp = useCallback(
    (e) => {
      const now = Date.now();
      if (now - lastSelectionTriggerRef.current < 350) return;
      lastSelectionTriggerRef.current = now;

      const isTouch =
        (e && e.pointerType === "touch") || (e && e.type === "touchend");

      // On touch devices the selection can finalize slightly after the event.
      if (isTouch) {
        setTimeout(() => handleSummarySelectionTrigger(), 0);
      } else {
        handleSummarySelectionTrigger();
      }
    },
    [handleSummarySelectionTrigger],
  );

  async function flushPendingHighlights() {
    if (!summaryId || hlSaving || pendingHighlights.length === 0) return;
    const queue = [...pendingHighlights];
    setHlSaving(true);
    const created = [];
    const stillPending = [];
    try {
      for (const p of queue) {
        const res = await fetch(`/api/summary/${summaryId}/highlights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: p.quote, color: p.color }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.highlight) {
          stillPending.push(p);
          continue;
        }
        created.push(data.highlight);
      }
      if (created.length) {
        setHighlights((prev) => [...created, ...prev]);
      }
      setPendingHighlights(stillPending);
      if (stillPending.length) {
        alert(
          stillPending.length === queue.length
            ? queue.length === 1
              ? "Could not save the highlight. Please try again."
              : "Could not save highlights. Please try again."
            : `Saved ${created.length} highlight(s); ${stillPending.length} could not be saved.`,
        );
      }
    } finally {
      setHlSaving(false);
    }
  }

  function removePendingHighlight(clientId) {
    setPendingHighlights((prev) => prev.filter((p) => p.clientId !== clientId));
  }

  async function deleteHighlight(hid) {
    try {
      const res = await fetch(`/api/summary/${summaryId}/highlights/${hid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setHighlights((p) => p.filter((h) => h.id !== hid));
    } catch (e) {
      alert(e?.message ?? "Could not remove highlight");
    }
  }

  function scrollToHighlight(hid) {
    const id = String(hid);
    const safe =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(id)
        : id.replace(/"/g, '\\"');
    const el = document.querySelector(`mark.s2n-hl[data-hl-id="${safe}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const summaryBodyDangerousHtml = useMemo(() => {
    const raw =
      summaryHtml ||
      markdownToHtml(summary?.output ?? "No summary output found.");
    return { __html: raw };
  }, [summaryHtml, summary?.output]);

  const chatSuggestions = useMemo(() => {
    if (aiChatSuggestions.length > 0) return aiChatSuggestions;
    return buildChatSuggestions({
      markdown: summary?.output || "",
      headings,
      title: summary?.title || "",
      max: 4,
    });
  }, [aiChatSuggestions, summary?.output, summary?.title, headings]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId || !summary?.output) {
      setAiChatSuggestions([]);
      return;
    }
    let cancelled = false;
    async function loadAiSuggestions() {
      try {
        const res = await fetch(`/api/summary/${summaryId}/chat-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max: 4 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.error || "Failed to load suggestions");
        const next = Array.isArray(data?.suggestions) ? data.suggestions : [];
        if (!cancelled) setAiChatSuggestions(next);
      } catch {
        if (!cancelled) setAiChatSuggestions([]);
      }
    }
    loadAiSuggestions();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId, summary?.output]);

  function fileExtUpper(name) {
    const parts = String(name || "").split(".");
    const ext = parts.length > 1 ? parts[parts.length - 1] : "";
    return ext ? ext.toUpperCase() : "FILE";
  }

  function handleSourceUpload(files) {
    // Stage files locally; actual upload happens when user presses Send.
    if (!files || !files.length) return;
    const incoming = Array.from(files).map((f) => ({
      clientId: `local-${crypto.randomUUID()}`,
      file: f,
      name: f.name,
      type: fileExtUpper(f.name),
    }));
    setPendingSourceFiles((prev) => {
      const names = new Set(prev.map((p) => p.name));
      const deduped = incoming.filter((p) => !names.has(p.name));
      return [...prev, ...deduped];
    });
  }

  function removePendingSourceByClientId(clientId) {
    setPendingSourceFiles((prev) =>
      prev.filter((p) => p.clientId !== clientId),
    );
  }

  const fetchSlideDecks = useCallback(async () => {
    const n = Number.parseInt(String(summaryId ?? ""), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setSlideDecksLoading(true);
    try {
      const res = await fetch(`/api/summary/${n}/slide-decks`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.decks)) setSlideDecks(data.decks);
      else setSlideDecks([]);
    } catch {
      setSlideDecks([]);
    } finally {
      setSlideDecksLoading(false);
    }
  }, [summaryId]);

  const fetchQuizSets = useCallback(async () => {
    const n = Number.parseInt(String(summaryId ?? ""), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setQuizSetsLoading(true);
    try {
      const res = await fetch(`/api/summary/${n}/quiz-sets`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.quizSets)) setQuizSets(data.quizSets);
      else setQuizSets([]);
    } catch {
      setQuizSets([]);
    } finally {
      setQuizSetsLoading(false);
    }
  }, [summaryId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const n = Number.parseInt(String(summaryId ?? ""), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    void fetchSlideDecks();
  }, [status, summaryId, fetchSlideDecks]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const n = Number.parseInt(String(summaryId ?? ""), 10);
    if (!Number.isFinite(n) || n <= 0) return;
    void fetchQuizSets();
  }, [status, summaryId, fetchQuizSets]);

  const fetchQuizAttemptHistory = useCallback(
    async (setId) => {
      const n = Number.parseInt(String(summaryId ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0 || !setId) return;
      quizHistoryFetchTargetRef.current = setId;
      setQuizHistoryLoading(true);
      try {
        const res = await fetch(
          `/api/summary/${n}/quiz-sets/${setId}/attempts`,
        );
        const data = await res.json().catch(() => ({}));
        if (quizHistoryFetchTargetRef.current !== setId) return;
        if (res.ok && Array.isArray(data.attempts)) {
          setQuizHistoryList(data.attempts);
          setQuizHistoryQuestions(
            Array.isArray(data.questions) ? data.questions : [],
          );
        } else {
          setQuizHistoryList([]);
          setQuizHistoryQuestions([]);
        }
      } catch {
        if (quizHistoryFetchTargetRef.current === setId) {
          setQuizHistoryList([]);
          setQuizHistoryQuestions([]);
        }
      } finally {
        if (quizHistoryFetchTargetRef.current === setId)
          setQuizHistoryLoading(false);
      }
    },
    [summaryId],
  );

  const toggleQuizHistoryPanel = useCallback(
    (setId) => {
      if (quizHistoryOpenId === setId) {
        setQuizHistoryOpenId(null);
        setQuizAttemptDetail(null);
        return;
      }
      setQuizHistoryOpenId(setId);
      setQuizHistoryList([]);
      setQuizHistoryQuestions([]);
      setQuizAttemptDetail(null);
      void fetchQuizAttemptHistory(setId);
    },
    [quizHistoryOpenId, fetchQuizAttemptHistory],
  );

  const openQuizAttemptDetail = useCallback(
    (attempt) => {
      if (!attempt) return;
      const answers =
        attempt.answers && typeof attempt.answers === "object"
          ? attempt.answers
          : {};
      const rows = quizHistoryQuestions.map((q, idx) => {
        const userAnswer = answers[String(idx)] ?? null;
        const correctAnswer = q.answer ?? "";
        return {
          id: q.id ?? `${idx}`,
          questionNumber: idx + 1,
          question: q.question ?? "",
          userAnswer,
          correctAnswer,
          isCorrect:
            userAnswer != null &&
            String(userAnswer).trim() === String(correctAnswer).trim(),
        };
      });
      setQuizAttemptDetail({
        id: attempt.id,
        createdAt: attempt.createdAt,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        rows,
      });
    },
    [quizHistoryQuestions],
  );

  const openSavedQuizSet = useCallback(
    async (setId) => {
      const n = Number.parseInt(String(summaryId ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0 || !setId) return;
      setQuizSetOpeningId(setId);
      try {
        const res = await fetch(`/api/summary/${n}/quiz-sets/${setId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.quizSet) {
          console.warn(data?.error || "Failed to load quiz");
          return;
        }
        setQuizData(data.quizSet);
        setQuizSettings(settingsFromQuizSet(data.quizSet));
        setQuizView(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setQuizSetOpeningId(null);
      }
    },
    [summaryId],
  );

  async function openSlideDeckPreview(deck) {
    setSlideDeckPreviewUrl("");
    setSlideDeckPreviewTitle(
      String(deck.title || "Presentation").trim() || "Presentation",
    );
    const baseTitle =
      String(deck.title || "presentation").trim() || "presentation";
    slideDeckDlRef.current = async () => {
      const n = Number.parseInt(String(summaryId ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid summary id");
      const r = await fetch(
        `/api/summary/${n}/slide-decks/${deck.id}/view?v=${Date.now()}`,
      );
      if (!r.ok) throw new Error("Failed to download file");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName =
        baseTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "presentation";
      a.download = `${fileName}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    };
    setSlideDeckPreviewOpen(true);
    try {
      const n = Number.parseInt(String(summaryId ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid summary id");
      const res = await fetch(
        `/api/summary/${n}/slide-decks/${deck.id}/view-token`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not prepare preview");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const viewUrl = `${origin}/api/summary/${n}/slide-decks/${deck.id}/view?t=${encodeURIComponent(
        data.token,
      )}`;
      setSlideDeckRemotePptUrl(viewUrl);
    } catch (e) {
      setSlideDeckRemotePptUrl("");
      alert(e?.message || String(e));
    }
  }

  async function downloadSlideDeck(deck) {
    try {
      const n = Number.parseInt(String(summaryId ?? ""), 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid summary id");
      const r = await fetch(
        `/api/summary/${n}/slide-decks/${deck.id}/view?v=${Date.now()}`,
      );
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName =
        String(deck.title || "presentation")
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase() || "presentation";
      a.download = `${fileName}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  async function deleteSlideDeck(deck) {
    const deckId = Number.parseInt(String(deck?.id ?? ""), 10);
    if (!Number.isFinite(deckId) || deckId <= 0) return;
    const ok = window.confirm(
      `Delete slide deck "${String(deck?.title || "Presentation")}"?`,
    );
    if (!ok) return;

    const n = Number.parseInt(String(summaryId ?? ""), 10);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Invalid summary id");
      return;
    }

    setSlideDeckDeletingId(deckId);
    try {
      const res = await fetch(`/api/summary/${n}/slide-decks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete slide deck");
      setSlideDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSlideDeckDeletingId(null);
    }
  }

  return (
    <>
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; background: var(--sum-page-bg); }
      @keyframes spin   { to { transform: rotate(360deg); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes msgIn  { from { opacity: 0; transform: translateY(5px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes blink  { 0%,80%,100% { transform: scale(0); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }

      .wrap   { height: 100%; display: flex; flex-direction: column; background: var(--sum-page-bg); font-family: 'Sora', sans-serif; overflow: hidden; }

      /* ── atmosphere ── */
      .atm    { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
      .atm-a  { position: absolute; top: -15%; right: -8%; width: 560px; height: 560px; background: var(--app-blob-1); }
      .atm-b  { position: absolute; bottom: -12%; left: 5%;  width: 440px; height: 440px; background: var(--app-blob-2); }

      /* ── body ── */
      .body   { display: flex; flex: 1; overflow: hidden; position: relative; z-index: 5; }

      /* ── main area + sources panel ── */
      .main-wrap { flex: 1; display: flex; min-width: 0; }
      .sum-splitter {
        width: 8px;
        flex-shrink: 0;
        cursor: col-resize;
        background: transparent;
        position: relative;
        z-index: 10;
      }
      .sum-splitter::after {
        content: '';
        position: absolute;
        top: 10px;
        bottom: 10px;
        left: 3px;
        width: 2px;
        border-radius: 999px;
        background: rgba(255,255,255,0.06);
      }
      .sum-splitter:hover::after {
        background: rgba(99,102,241,0.35);
      }
      .main   { flex: 1; display: flex; flex-direction: column; padding: 14px; gap: 10px; overflow: hidden; min-width: 0; }

      .sources {
        width: 260px;
        flex-shrink: 0;
        border-left: 1px solid var(--sum-sources-border);
        background: var(--sum-sources-bg);
        display: flex;
        flex-direction: column;
      }
      .src-header {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .src-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: .1em;
        text-transform: uppercase;
        color: rgba(255,255,255,.55);
      }
      .src-add-btn {
        height: 26px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.03);
        font-family: 'Sora',sans-serif;
        font-size: 11px;
        color: rgba(255,255,255,.72);
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      .src-add-btn:hover {
        background: rgba(255,255,255,.06);
      }
      .src-list {
        padding: 10px 12px 12px;
        max-height: 50%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .src-list::-webkit-scrollbar { width: 3px; }
      .src-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }
      .hl-panel {
        padding: 8px 12px 10px;
        border-bottom: 1px solid rgba(255,255,255,.07);
        max-height: 220px;
        overflow-y: auto;
        flex-shrink: 0;
      }
      /* Three-dot More button — hidden on desktop, revealed in mobile media query */
      .mob-more-btn {
        display: none;
        position: relative;
        width: 30px;
        height: 28px;
        padding: 0;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.55);
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all .18s;
        flex-shrink: 0;
      }
      .mob-more-btn:hover {
        border-color: rgba(255,255,255,.15);
        color: rgba(255,255,255,.85);
        background: rgba(255,255,255,.06);
      }
      .hl-list-badge {
        position: absolute;
        top: -7px;
        right: -7px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: rgba(248,113,113,.25);
        border: 1px solid rgba(248,113,113,.4);
        color: #fca5a5;
        font-size: 10px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 22px rgba(0,0,0,.25);
      }
      .hl-panel::-webkit-scrollbar { width: 3px; }
      .hl-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }
      .hl-head {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: .1em;
        text-transform: uppercase;
        color: rgba(255,255,255,.42);
        margin-bottom: 8px;
      }
      .hl-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .hl-head-row .hl-head { margin-bottom: 0; }
      .hl-save-btn {
        flex-shrink: 0;
        width: 30px;
        height: 28px;
        padding: 0;
        border-radius: 8px;
        border: 1px solid rgba(52,211,153,.28);
        background: rgba(52,211,153,.1);
        color: #6ee7b7;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background .15s, border-color .15s, opacity .15s;
      }
      .hl-save-btn:hover:not(:disabled) {
        background: rgba(52,211,153,.18);
        border-color: rgba(52,211,153,.45);
      }
      .hl-save-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      .hl-sub {
        font-size: 10px;
        color: rgba(250,204,21,.55);
        margin: -4px 0 8px;
        line-height: 1.35;
      }
      .hl-item {
        display: flex;
        gap: 6px;
        align-items: flex-start;
        padding: 6px 8px;
        border-radius: 8px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.08);
        border-left: 5px solid var(--hl-accent, #fef08a);
        margin-bottom: 6px;
        cursor: pointer;
      }
      .hl-item:hover { background: rgba(255,255,255,.06); }
      .hl-item.pending {
        border-style: dashed;
        background: rgba(99,102,241,.06);
        border-color: rgba(99,102,241,.22);
      }
      .hl-item.pending:hover { background: rgba(99,102,241,.1); }
      .hl-color-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.38);
        background: var(--hl-accent, #fef08a);
        margin-top: 3px;
        flex-shrink: 0;
        box-shadow: 0 0 0 1px rgba(0,0,0,.2);
      }
      .hl-quote {
        font-size: 11px;
        color: rgba(255,255,255,.72);
        line-height: 1.45;
        flex: 1;
        min-width: 0;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .hl-x {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border: none;
        border-radius: 6px;
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.45);
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
        padding: 0;
      }
      .hl-x:hover { background: rgba(248,113,113,.15); color: #fca5a5; }
      .hl-empty {
        font-size: 10.5px;
        color: rgba(255,255,255,.22);
        font-style: italic;
      }

      .hl-panel.sd-panel {
        max-height: 200px;
        flex-shrink: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .sd-refresh-btn {
        flex-shrink: 0;
        width: 30px;
        height: 28px;
        padding: 0;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.55);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        transition: all .15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sd-refresh-btn:hover:not(:disabled) {
        border-color: rgba(99,102,241,.35);
        color: #a5b4fc;
        background: rgba(99,102,241,.1);
      }
      .sd-refresh-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .sd-deck-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        margin-top: 4px;
        padding-right: 2px;
      }
      .sd-deck-list::-webkit-scrollbar { width: 3px; }
      .sd-deck-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }
      .sd-deck-row {
        padding: 8px;
        border-radius: 8px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.08);
        margin-bottom: 6px;
      }
      .sd-deck-row:last-child { margin-bottom: 0; }
      .sd-deck-title {
        font-size: 11px;
        font-weight: 600;
        color: #e5e5ff;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .sd-deck-meta {
        font-size: 10px;
        color: rgba(255,255,255,.38);
        margin-top: 4px;
      }
      .sd-deck-actions {
        display: flex;
        gap: 5px;
        margin-top: 8px;
      }
      .sd-deck-btn {
        flex: 1;
        min-height: 26px;
        padding: 0 6px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.04);
        font-family: 'Sora', sans-serif;
        font-size: 10px;
        font-weight: 600;
        color: rgba(255,255,255,.78);
        cursor: pointer;
        transition: all .15s;
      }
      .sd-deck-btn:hover {
        border-color: rgba(99,102,241,.4);
        color: #c7d2fe;
        background: rgba(99,102,241,.1);
      }

      .src-empty {
        font-size: 11.5px;
        color: rgba(255,255,255,.25);
        font-style: italic;
      }
      .src-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 8px;
        background: rgba(255,255,255,.02);
        border: 1px solid rgba(255,255,255,.06);
      }
      .src-info {
        flex: 1;
        min-width: 0;
      }
      .src-name {
        font-size: 11.5px;
        color: #e5e5ff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .src-meta {
        font-size: 10px;
        color: rgba(255,255,255,.4);
        margin-top: 2px;
      }

      /* ── action bar ── */
      .act-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        width: 100%;
        min-width: 0;
        animation: fadeUp .35s ease both;
      }
      .act-bar-title-wrap {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
      }
      .act-bar-btns {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 7px;
        flex-shrink: 0;
      }

      /* ── content card ── */
      .card   { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--sum-card-bg); border: 1px solid var(--sum-card-border); border-radius: 18px; backdrop-filter: blur(14px); overflow: hidden; animation: fadeUp .4s ease both; animation-delay: .05s; }

      /* ── summary + chat: one continuous scroll ── */
      .sum-head  { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 20px 10px; flex-shrink: 0; gap: 12px; border-bottom: 1px solid var(--sum-head-border); }
      .sum-left  { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .sum-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: var(--sum-title); letter-spacing: -.01em; }
      .sum-tags  { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
      .tag       { font-size: 9.5px; font-weight: 600; padding: 2px 8px; border-radius: 5px; letter-spacing: .03em; }
      .tag-m     { background: rgba(251,146,60,.12); color: #fdba74; border: 1px solid rgba(251,146,60,.2); }
      .tag-lec   { background: rgba(99,102,241,.14); color: #a5b4fc; border: 1px solid rgba(99,102,241,.2); }
      .tag-stu   { background: rgba(52,211,153,.12); color: #6ee7b7; border: 1px solid rgba(52,211,153,.2); }
      .sum-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
      .sum-copy-btn {
        height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.5); font-family: 'Sora',sans-serif;
        font-size: 11px; display: flex; align-items: center; gap: 5px; cursor: pointer;
        transition: all .18s; align-self: flex-end;
      }
      .sum-copy-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.15); color: rgba(255,255,255,.8); background: rgba(255,255,255,.06); }
      .sum-copy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .sum-copy-btn.copied { border-color: rgba(52,211,153,.3); color: #6ee7b7; background: rgba(52,211,153,.1); }
      .sum-copy-txt { font-weight: 600; }
      .sum-head-actions { display: flex; flex-direction: row; align-items: center; gap: 6px; flex-shrink: 0; }
      .sum-hl-wrap { position: relative; display: flex; align-items: stretch; }
      .sum-hl-main {
        height: 28px; min-width: 34px; width: auto; padding: 0 10px 0 8px; border-radius: 7px 0 0 7px;
        border: 1px solid rgba(255,255,255,.08); border-right: none;
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.5);
        display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
        transition: all .18s;
      }
      .sum-hl-main-txt {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .sum-hl-main:hover { border-color: rgba(255,255,255,.15); color: rgba(255,255,255,.85); background: rgba(255,255,255,.06); }
      .sum-hl-main.on {
        border-color: rgba(250,204,21,.45); color: #fde047;
        background: rgba(250,204,21,.12); box-shadow: inset 0 0 0 1px rgba(250,204,21,.15);
      }
      .sum-hl-chevron {
        height: 28px; width: 22px; padding: 0; border-radius: 0 7px 7px 0;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.45);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: all .18s;
      }
      .sum-hl-chevron:hover { border-color: rgba(255,255,255,.15); color: rgba(255,255,255,.75); background: rgba(255,255,255,.06); }
      .sum-hl-chevron.open { border-color: rgba(99,102,241,.38); color: #a5b4fc; }
      .sum-hl-menu {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 80;
        min-width: 128px; padding: 6px; border-radius: 10px;
        background: rgba(22,22,34,.98); border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 14px 40px rgba(0,0,0,.5);
        animation: fadeUp .14s ease;
      }
      .sum-hl-menu-label {
        font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
        color: rgba(255,255,255,.32); margin: 2px 4px 8px;
      }
      .sum-hl-swatch-row { display: flex; flex-wrap: wrap; gap: 6px; }
      .sum-hl-swatch {
        width: 26px; height: 26px; border-radius: 6px; border: 2px solid rgba(255,255,255,.12);
        cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15);
        transition: transform .12s, border-color .12s;
      }
      .sum-hl-swatch:hover { transform: scale(1.06); border-color: rgba(255,255,255,.35); }
      .sum-hl-swatch.cur { outline: 2px solid #a5b4fc; outline-offset: 1px; border-color: rgba(255,255,255,.45); }
      .sum-date  { font-size: 10.5px; color: rgba(255,255,255,.25); font-style: italic; white-space: nowrap; }
      .sum-files { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
      .fchip     { display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 5px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); font-size: 10px; color: rgba(255,255,255,.3); }

      .unified-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px 10px; display: flex; flex-direction: column; gap: 0; }
      .unified-scroll::-webkit-scrollbar { width: 3px; }
      .unified-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 4px; }
      .conv-divider { margin: 18px 0 14px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); }
      .act-bar-chat-title-btn {
        max-width: 100%;
        text-align: left;
        padding: 6px 10px;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
        border-radius: 8px;
        font-family: 'Fraunces', Georgia, serif;
        font-size: 15px;
        font-weight: 600;
        color: var(--sum-title);
        letter-spacing: -0.02em;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.15s, background 0.15s;
      }
      .act-bar-chat-title-btn:hover:not(:disabled) {
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.08);
      }
      .act-bar-chat-title-btn:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .act-bar-chat-title-inp {
        flex: 1;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
        margin: 0;
        padding: 6px 10px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid rgba(99, 102, 241, 0.35);
        background: rgba(12, 12, 20, 0.55);
        font-family: 'Fraunces', Georgia, serif;
        font-size: 15px;
        font-weight: 600;
        color: var(--sum-title);
        letter-spacing: -0.02em;
        line-height: 1.2;
        outline: none;
      }
      .act-bar-chat-title-inp:focus {
        border-color: rgba(99, 102, 241, 0.55);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
      }
      .act-bar-chat-title-inp:disabled {
        opacity: 0.65;
      }
      .conv-label { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.28); margin-bottom: 12px; }
      .chat-hint { font-size: 11.5px; color: rgba(255,255,255,.22); font-style: italic; margin-top: 10px; padding-bottom: 4px; }
      .sum-text  { font-size: 13.5px; font-weight: 400; color: var(--sum-text); line-height: 1.8; font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .sum-text h1 { font-size: 1.5em; font-weight: 700; color: var(--sum-heading-1); margin: 0 0 14px; line-height: 1.35; letter-spacing: -0.01em; }
      .sum-text h2 { font-size: 1.22em; font-weight: 600; color: var(--sum-heading-2); margin: 20px 0 10px; line-height: 1.4; }
      .sum-text h3 { font-size: 1.08em; font-weight: 600; color: var(--sum-heading-3); margin: 16px 0 8px; line-height: 1.45; }
      .sum-text h4, .sum-text h5, .sum-text h6 { font-size: 1em; font-weight: 600; color: var(--sum-heading-4); margin: 12px 0 6px; }
      .sum-text ol, .sum-text ul { margin: 12px 0 14px 22px; padding-left: 8px; }
      .sum-text ol { list-style: decimal; }
      .sum-text ul { list-style-type: disc; }
      .sum-text ul ul { list-style-type: disc; }
      .sum-text ol li, .sum-text ul li { margin: 6px 0; }
      .sum-text a, .md a {
        color: #93c5fd;
        text-decoration: underline;
        text-underline-offset: 2px;
        word-break: break-all;
      }
      .sum-text a:hover, .md a:hover { color: #bfdbfe; }
      .sum-text .md-link-preface,
      .md .md-link-preface,
      .m-bub .md-link-preface {
        opacity: 0.82;
        font-weight: 400;
        margin-right: 2px;
      }
      .sum-text table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
      .sum-text th, .sum-text td { border: 1px solid var(--sum-table-border); padding: 10px 14px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .sum-text th { background: var(--sum-table-th-bg); font-weight: 600; color: var(--sum-table-th-text); }
      .sum-text td { color: var(--sum-table-td-text); line-height: 1.6; }

      .sum-selectable ::selection { background: rgba(99,102,241,.35); color: #f0f0ff; }
      .hl-select-ctx.hl-mode-active .sum-selectable ::selection {
        background: color-mix(in srgb, var(--hl-pick, #fef08a) 72%, transparent);
        color: inherit;
      }
      .sum-gen-meta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--sum-head-border);
        font-size: 10.5px;
        font-style: italic;
        color: var(--sum-meta);
      }
      mark.s2n-hl {
        font-weight: 500;
      }
      mark.s2n-hl-pending {
        outline: 1px dashed rgba(165,180,252,.65);
        outline-offset: 1px;
      }
      .hl-select-ctx.hl-mode-active .sum-selectable {
        cursor: text;
        box-shadow: inset 0 0 0 1px rgba(250,204,21,.18);
        border-radius: 4px;
      }
      .hl-select-ctx { display: block; }

      .chat-thread { display: flex; flex-direction: column; gap: 10px; padding-bottom: 4px; }

      .chat-empty { display: flex; flex-direction: row; align-items: center; gap: 8px; color: rgba(255,255,255,.2); font-size: 11px; }

      .m-row     { display: flex; gap: 8px; align-items: flex-start; animation: msgIn .22s ease; }
      .m-row.user{ flex-direction: row-reverse; }
      .m-row.user .m-bub-col { align-items: flex-end; }
      .m-ava     { width: 27px; height: 27px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
      .m-ava.ai  { background: rgba(99,102,241,.18); color: #a5b4fc; border: 1px solid rgba(99,102,241,.18); }
      .m-ava.user{ background: rgba(52,211,153,.14); color: #6ee7b7; border: 1px solid rgba(52,211,153,.18); }
      .m-bub-wrap { position: relative; max-width: 74%; display: flex; flex-direction: row; align-items: flex-start; gap: 6px; }
      .m-bub-col { max-width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; flex: 1; min-width: 0; }
      .m-meta { font-size: 10px; color: rgba(255,255,255,.26); font-style: italic; padding-left: 2px; }
      .m-web-note {
        font-size: 10px;
        line-height: 1.35;
        margin-top: 5px;
        padding: 5px 8px;
        border-radius: 8px;
        max-width: 100%;
        font-style: normal;
      }
      .m-web-note--ok {
        color: #a5b4fc;
        background: rgba(99,102,241,.1);
        border: 1px solid rgba(99,102,241,.22);
      }
      .m-web-note--warn {
        color: #fcd34d;
        background: rgba(250,204,21,.08);
        border: 1px solid rgba(250,204,21,.2);
      }
      .m-bub     { width: 100%; padding: 9px 13px; border-radius: 12px; font-size: 12.5px; font-weight: 300; line-height: 1.68; }
      .m-bub a {
        color: #93c5fd;
        text-decoration: underline;
        text-underline-offset: 2px;
        word-break: break-all;
      }
      .m-bub a:hover { color: #bfdbfe; }
      .m-bub.user a { color: #a5b4fc; }
      .m-bub.user a:hover { color: #c7d2fe; }
      .m-bub.ai  { background: var(--sum-chat-ai-bg); border: 1px solid var(--sum-chat-ai-border); color: var(--sum-text); border-top-left-radius: 3px; }
      .m-bub.user{ background: var(--sum-chat-user-bg); border: 1px solid rgba(99,102,241,.25); color: var(--sum-title); border-top-right-radius: 3px; }
      .m-bub.err { background: rgba(248,113,113,.08); border-color: rgba(248,113,113,.2); color: #fca5a5; }
      .chat-msg-files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
      .chat-msg-file-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 100%;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid rgba(99,102,241,.25);
        background: rgba(99,102,241,.08);
        color: inherit;
        font-size: 11px;
        line-height: 1.2;
      }
      .chat-msg-file-chip .file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chat-msg-file-chip .file-type {
        font-size: 10px;
        opacity: 0.72;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .chat-msg-images { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
      .chat-msg-images img {
        max-width: 100%;
        max-height: min(40vh, 280px);
        width: auto;
        height: auto;
        border-radius: 8px;
        object-fit: contain;
        border: 1px solid rgba(99,102,241,.2);
        background: rgba(0,0,0,.06);
      }
      .chat-img-lost-note {
        font-size: 11px;
        font-style: italic;
        opacity: 0.75;
        margin-bottom: 6px;
        color: var(--sum-text, #888);
      }
      .chat-paste-chip {
        border: 1px solid rgba(99,102,241,.28);
        background: rgba(99,102,241,.07);
      }
      .chat-paste-chip .chat-upload-badge {
        background: rgba(99,102,241,.18);
        border: 1px solid rgba(99,102,241,.35);
        color: #c7d2fe;
      }
      .chat-upload-content-single {
        flex: 1;
        justify-content: center;
      }
      .chat-paste-ico {
        display: block;
        width: 20px;
        height: 16px;
        border-radius: 3px;
        border: 2px solid rgba(99,102,241,.55);
        box-shadow: inset 0 0 0 2px rgba(255,255,255,.35);
        background: linear-gradient(135deg, rgba(99,102,241,.2), rgba(139,92,246,.15));
      }
      .m-copy {
        width: 26px; height: 26px; border-radius: 6px; border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.5); display: flex;
        align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        transition: all .18s;
      }
      .m-copy:hover { background: rgba(255,255,255,.08); color: #a5b4fc; border-color: rgba(99,102,241,.3); }
      .m-copy.copied { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.3); color: #6ee7b7; }
      .m-copy-txt { font-size: 10px; font-weight: 600; }
      .m-bub-side-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-shrink: 0;
        align-self: flex-start;
      }

      /* markdown-ish rendering (summary + chat) */
      .md p, .sum-text p { margin: 0 0 12px; }
      .md p:last-child, .sum-text p:last-child { margin-bottom: 0; }
      .md ul, .md ol { margin: 12px 0 14px 22px; padding-left: 8px; }
      .md ol { list-style: decimal; }
      .md ul { list-style-type: disc; }
      .md ul ul { list-style-type: disc; }
      .md li { margin: 6px 0; }
      .md h1, .md h2, .md h3, .md h4, .md h5, .md h6 { font-weight: 600; margin: 12px 0 6px; }
      .md h1 { font-size: 1.25em; color: var(--sum-heading-1); }
      .md h2 { font-size: 1.12em; color: var(--sum-heading-2); }
      .md h3 { font-size: 1.06em; color: var(--sum-heading-3); }
      .md h4, .md h5, .md h6 { color: var(--sum-heading-4); }
      .md table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
      .md th, .md td { border: 1px solid var(--sum-table-border); padding: 8px 12px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .md th { background: var(--sum-table-th-bg); font-weight: 600; color: var(--sum-table-th-text); }
      .md td { line-height: 1.6; color: var(--sum-table-td-text); }
      .md code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.95em; background: var(--sum-md-code-bg); padding: 1px 5px; border-radius: 6px; }
      .md pre { background: var(--sum-md-pre-bg); border: 1px solid var(--sum-md-pre-border); padding: 10px 12px; border-radius: 10px; overflow: auto; margin: 10px 0; }
      .md pre code { background: transparent; padding: 0; }

      .dots { display: flex; gap: 4px; padding: 3px 0; align-items: center; }
      .dot  { width: 6px; height: 6px; border-radius: 50%; background: rgba(165,180,252,.5); animation: blink 1.3s ease infinite; }
      .dot:nth-child(2) { animation-delay: .22s; }
      .dot:nth-child(3) { animation-delay: .44s; }

      /* ── suggestions ── */
      .suggests { padding: 0 20px 8px; display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
      .suggests--end-chat {
        padding: 10px 10px 4px;
        margin-top: 8px;
      }
      .suggests--end-chat .sug {
        white-space: normal;
        max-width: 100%;
        text-align: left;
        line-height: 1.35;
      }
      .sug      { padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,.08); background: transparent; font-family: 'Sora',sans-serif; font-size: 11px; color: rgba(255,255,255,.38); cursor: pointer; transition: all .18s; white-space: nowrap; }
      .sug:hover{ border-color: rgba(99,102,241,.4); color: #a5b4fc; background: rgba(99,102,241,.07); }

      /* ── input row ── */
      .inp-row  { position: sticky; bottom: 0; display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.06); flex-shrink: 0; background: linear-gradient(to top, rgba(16,16,24,.96), rgba(16,16,24,.84)); backdrop-filter: blur(6px); z-index: 20; }
      .inp-web-label {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 44px;
        cursor: pointer;
        user-select: none;
        font-family: 'Sora', sans-serif;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(255,255,255,.45);
        line-height: 1.1;
      }
      .inp-web-label input {
        width: 15px;
        height: 15px;
        accent-color: #818cf8;
        cursor: pointer;
      }
      .inp-web-label:hover { color: rgba(255,255,255,.65); }
      .chatbox {
        flex: 1;
        min-width: 0;
        min-height: 44px;
        background: var(--sum-inp-bg);
        border: 1px solid var(--sum-inp-border);
        border-radius: 26px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px 6px 10px;
        box-shadow: 0 1px 2px rgba(0,0,0,.12);
      }
      .chatbox:focus-within {
        border-color: rgba(99,102,241,.45);
        box-shadow: 0 0 0 3px rgba(99,102,241,.1), 0 2px 8px rgba(0,0,0,.14);
      }
      .chatbox.with-files {
        align-items: stretch;
      }
      .chatbox.with-files .send-btn--inline {
        align-self: center;
      }
      .chatbox-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        padding: 2px 0;
      }
      .chat-uploads {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        padding: 0 4px 0 2px;
      }
      .chat-uploads::-webkit-scrollbar { height: 3px; }
      .chat-uploads::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 999px; }
      .chat-upload-chip {
        flex-shrink: 0;
        width: 340px;
        max-width: min(340px, calc(100vw - 180px));
        min-height: 54px;
        display: flex;
        align-items: stretch;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.03);
        position: relative;
      }
      .chat-upload-badge {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: rgba(239,68,68,0.25);
        border: 1px solid rgba(239,68,68,0.45);
        color: #fecaca;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .chat-upload-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        padding-right: 16px; /* breathing room for close btn */
      }
      .chat-upload-name {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,.9);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .chat-upload-type {
        font-size: 10px;
        color: rgba(255,255,255,.5);
        text-transform: uppercase;
        letter-spacing: .08em;
      }
      .chat-upload-rm {
        width: 18px;
        height: 18px;
        border: none;
        border-radius: 50%;
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
        flex-shrink: 0;
        position: absolute;
        top: 6px;
        right: 6px;
      }
      .chat-upload-rm:hover {
        background: rgba(248,113,113,.2);
        color: #fca5a5;
      }
      .chatbox-row {
        min-height: 32px;
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 6px;
      }
      .chat-actions-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 4px 0 2px;
      }
      .inp      { flex: 1; height: 100%; min-width: 0; background: transparent; border: none; border-radius: 8px; padding: 0 6px; font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 300; color: var(--sum-inp-text); outline: none; transition: border-color .2s, box-shadow .2s; }
      .inp::placeholder { color: rgba(255,255,255,.2); font-style: italic; }
      .inp:disabled { opacity: .5; }

      .mdl-wrap { position: relative; flex-shrink: 1; min-width: 0; }
      .mdl-btn  { height: 30px; max-width: 100%; padding: 0 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); font-family: 'Sora',sans-serif; font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,.48); display: flex; align-items: center; gap: 4px; cursor: pointer; transition: all .18s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mdl-btn:hover, .mdl-btn.open { border-color: rgba(99,102,241,.38); color: #a5b4fc; background: rgba(99,102,241,.08); }
      .mdl-menu { position: absolute; bottom: calc(100% + 5px); right: 0; min-width: 130px; background: rgba(20,20,32,.98); border: 1px solid rgba(255,255,255,.1); border-radius: 11px; padding: 4px; z-index: 50; box-shadow: 0 -18px 40px rgba(0,0,0,.55); animation: fadeUp .14s ease; }
      .mdl-opt  { padding: 7px 10px; border-radius: 7px; cursor: pointer; font-size: 12px; color: #b0b0cc; display: flex; align-items: center; justify-content: space-between; transition: background .14s; }
      .mdl-opt:hover { background: rgba(99,102,241,.1); }
      .mdl-opt.on    { background: rgba(99,102,241,.18); color: #a5b4fc; font-weight: 500; }

      .send-btn { width: 40px; height: 40px; border-radius: 10px; border: none; background: linear-gradient(135deg,#5258ee,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform .15s, box-shadow .18s, opacity .18s; box-shadow: 0 3px 12px rgba(99,102,241,.38); }
      .send-btn--inline {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(99,102,241,.35);
        margin-left: 2px;
      }
      .send-btn--inline:hover:not(:disabled) {
        box-shadow: 0 4px 14px rgba(99,102,241,.5);
      }
      .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,.55); }
      .send-btn:disabled { opacity: .38; cursor: not-allowed; transform: none; }

      .attach-btn {
        align-self: center;
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.55);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: all .18s;
        position: relative;
      }
      .attach-btn:hover:not(:disabled) {
        color: rgba(255,255,255,.85);
        background: rgba(255,255,255,.08);
        border-color: rgba(255,255,255,.16);
      }
      .attach-btn:disabled {
        opacity: .45;
        cursor: not-allowed;
      }
      .attach-badge {
        position: absolute;
        top: -7px;
        right: -7px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 999px;
        background: rgba(99,102,241,.25);
        border: 1px solid rgba(99,102,241,.45);
        color: #a5b4fc;
        font-size: 10px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 22px rgba(0,0,0,.25);
      }

      /* ── mobile: summary + conversation ── */
      @media (max-width: 1023px) {
        .wrap {
          overflow: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .body { min-height: 0; }
        .main-wrap {
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .main {
          padding: 8px 10px;
          gap: 8px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .sources {
          display: none;
        }
        .sum-splitter {
          display: none;
        }
        .act-bar {
          flex-wrap: nowrap;
          gap: 6px;
          width: 100%;
        }
        .act-bar-title-wrap {
          flex: 1 1 0;
          min-width: 0;
          max-width: 42%;
        }
        .act-bar-chat-title-btn {
          font-size: 12px;
          padding: 4px 6px;
          width: 100%;
        }
        .act-bar-chat-title-inp {
          font-size: 12px;
          padding: 4px 8px;
          height: 30px;
        }
        .act-bar-btns {
          flex: 1 1 0;
          min-width: 0;
          gap: 4px;
        }
        .act-bar-btns button {
          flex: 1 1 0;
          min-width: 0;
          justify-content: center;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 600;
          padding: 0 4px;
          height: 30px;
          min-height: 30px;
          gap: 3px;
          line-height: 1.1;
        }
        .act-bar-btns button svg {
          flex-shrink: 0;
          width: 12px !important;
          height: 12px !important;
        }
        .card { 
          border-radius: 14px; 
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .sum-head {
          flex-direction: column;
          align-items: stretch;
          padding: 12px 14px 10px;
          gap: 10px;
        }
        .sum-right {
          align-items: flex-start;
        }
        .sum-head-actions {
          position: absolute;
          top: 12px;
          right: 14px;
          width: auto;
          flex-wrap: nowrap;
          justify-content: flex-end;
          gap: 6px;
          z-index: 30;
        }
        .sum-files {
          justify-content: flex-start;
        }
        .fchip {
          max-width: 100%;
          min-width: 0;
        }
        .unified-scroll {
          padding: 0 12px 12px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .sum-text, .md {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .sum-text table, .md table {
          width: 100%;
          table-layout: fixed;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .m-bub-wrap { max-width: min(100%, 92vw); }
        .suggests {
          padding: 0 12px 8px;
          gap: 5px;
        }
        .suggests--end-chat {
          padding: 6px 10px 4px;
        }
        .sug {
          white-space: normal;
          text-align: left;
          line-height: 1.35;
        }
        .inp-row {
          position: relative;
          flex-shrink: 0;
          flex-wrap: nowrap;
          align-items: center;
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
          background: var(--app-nav-bg);
          border-top: 1px solid var(--app-border);
          gap: 8px;
          z-index: 40;
        }
        .inp-row .chatbox { min-height: 42px; height: auto; }
        .inp-row .mdl-btn { max-width: 120px; }
        .inp-row .send-btn {
          flex-shrink: 0;
        }
        .sum-hl-menu {
          left: 0;
          right: auto;
        }
        /* Show the three-dot More button on mobile */
        .mob-more-btn { display: flex; }
        /* Hide "Highlight" text label on the highlight toggle button */
        .sum-hl-main .sum-hl-main-txt { display: none; }
        .hl-panel--sources { display: none; }
        .sd-panel--sources { display: none; }
      }

      /* Light theme: many rules above use fixed light-on-dark greys — force readable contrast */
      html[data-theme="light"] .sum-text :is(p, li, strong, em),
      html[data-theme="light"] .md :is(p, li, strong, em) {
        color: var(--sum-text);
      }
      html[data-theme="light"] .sum-text :is(h1) { color: var(--sum-heading-1); }
      html[data-theme="light"] .sum-text :is(h2) { color: var(--sum-heading-2); }
      html[data-theme="light"] .sum-text :is(h3) { color: var(--sum-heading-3); }
      html[data-theme="light"] .sum-text :is(h4, h5, h6) { color: var(--sum-heading-4); }
      html[data-theme="light"] .md :is(h1) { color: var(--sum-heading-1); }
      html[data-theme="light"] .md :is(h2) { color: var(--sum-heading-2); }
      html[data-theme="light"] .md :is(h3) { color: var(--sum-heading-3); }
      html[data-theme="light"] .md :is(h4, h5, h6) { color: var(--sum-heading-4); }
      html[data-theme="light"] .sum-text code,
      html[data-theme="light"] .md code { color: var(--sum-text); }
      html[data-theme="light"] .sum-text pre,
      html[data-theme="light"] .md pre { color: var(--sum-text); }

      html[data-theme="light"] .src-header { border-bottom-color: rgba(0,0,0,0.08); }
      html[data-theme="light"] .src-title { color: rgba(0,0,0,0.55); }
      html[data-theme="light"] .src-add-btn {
        border-color: rgba(0,0,0,0.12);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.78);
      }
      html[data-theme="light"] .src-add-btn:hover { background: rgba(0,0,0,0.06); }
      html[data-theme="light"] .src-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
      html[data-theme="light"] .hl-panel { border-bottom-color: rgba(0,0,0,0.08); }
      html[data-theme="light"] .hl-head { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .hl-empty { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .sd-refresh-btn {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.5);
      }
      html[data-theme="light"] .sd-refresh-btn:hover:not(:disabled) {
        border-color: rgba(99,102,241,0.35);
        color: #4f46e5;
        background: rgba(99,102,241,0.08);
      }
      html[data-theme="light"] .sd-deck-row {
        background: rgba(0,0,0,0.03);
        border-color: rgba(0,0,0,0.08);
      }
      html[data-theme="light"] .sd-deck-title { color: #111827; }
      html[data-theme="light"] .sd-deck-meta { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .sd-deck-btn {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.75);
      }
      html[data-theme="light"] .sd-deck-btn:hover {
        border-color: rgba(99,102,241,0.4);
        color: #4f46e5;
        background: rgba(99,102,241,0.08);
      }
      html[data-theme="light"] .sd-deck-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
      html[data-theme="light"] .hl-quote { color: rgba(0,0,0,0.72); }
      html[data-theme="light"] .hl-sub { color: rgba(180,130,0,0.9); }
      html[data-theme="light"] .hl-item {
        background: rgba(255,255,255,0.92);
        border-color: rgba(0,0,0,0.14);
        border-left-width: 5px;
      }
      html[data-theme="light"] .hl-item:hover { background: rgba(0,0,0,0.05); }
      html[data-theme="light"] .hl-color-dot {
        border-color: rgba(0,0,0,0.25);
        box-shadow: 0 0 0 1px rgba(255,255,255,.85);
      }
      html[data-theme="light"] .hl-quote { color: rgba(0,0,0,0.78); }
      html[data-theme="light"] .hl-x { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .src-empty { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .src-item {
        background: rgba(0,0,0,0.02);
        border-color: rgba(0,0,0,0.08);
      }
      html[data-theme="light"] .src-name { color: #111827; }
      html[data-theme="light"] .src-meta { color: rgba(0,0,0,0.5); }

      html[data-theme="light"] .sum-copy-btn {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.65);
      }
      html[data-theme="light"] .sum-copy-btn:hover:not(:disabled) {
        border-color: rgba(0,0,0,0.18);
        color: rgba(0,0,0,0.88);
        background: rgba(0,0,0,0.05);
      }
      html[data-theme="light"] .sum-hl-main,
      html[data-theme="light"] .sum-hl-chevron {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.6);
      }
      html[data-theme="light"] .sum-hl-main:hover { border-color: rgba(0,0,0,0.16); color: rgba(0,0,0,0.85); background: rgba(0,0,0,0.05); }
      html[data-theme="light"] .sum-hl-chevron:hover { border-color: rgba(0,0,0,0.16); color: rgba(0,0,0,0.8); background: rgba(0,0,0,0.05); }
      html[data-theme="light"] .sum-hl-menu {
        background: #fff;
        border-color: rgba(0,0,0,0.1);
        box-shadow: 0 12px 36px rgba(0,0,0,0.12);
      }
      html[data-theme="light"] .sum-hl-menu-label { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .sum-date { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .fchip {
        background: rgba(0,0,0,0.04);
        border-color: rgba(0,0,0,0.08);
        color: rgba(0,0,0,0.55);
      }
      html[data-theme="light"] .unified-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
      html[data-theme="light"] .conv-divider { border-top-color: rgba(0,0,0,0.08); }
      html[data-theme="light"] .act-bar-chat-title-inp {
        background: rgba(255,255,255,0.9);
        border-color: rgba(99,102,241,0.28);
      }
      html[data-theme="light"] .conv-label { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .chat-hint { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .chat-empty { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .m-meta { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .m-web-note--ok {
        color: #4338ca;
        background: rgba(99,102,241,.12);
        border-color: rgba(99,102,241,.28);
      }
      html[data-theme="light"] .m-web-note--warn {
        color: #92400e;
        background: rgba(250,204,21,.14);
        border-color: rgba(217,119,6,.25);
      }
      html[data-theme="light"] .m-copy {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.5);
      }
      html[data-theme="light"] .m-copy:hover { background: rgba(0,0,0,0.06); }
      .chat-notice {
        font-size: 11px;
        color: #fca5a5;
        padding: 6px 8px 0;
        line-height: 1.35;
      }
      html[data-theme="light"] .chat-notice { color: #b91c1c; }
      html[data-theme="light"] .sug {
        border-color: rgba(0,0,0,0.1);
        color: rgba(0,0,0,0.5);
      }
      html[data-theme="light"] .suggests--end-chat {
        background: transparent;
      }
      html[data-theme="light"] .inp-row {
        border-top-color: rgba(0,0,0,0.08);
        background: linear-gradient(to top, rgba(255,255,255,.96), rgba(255,255,255,.86));
      }
      html[data-theme="light"] .attach-btn {
        border-color: rgba(0,0,0,0.16);
        background: rgba(0,0,0,0.04);
        color: rgba(0,0,0,0.68);
      }
      html[data-theme="light"] .attach-btn:hover:not(:disabled) {
        border-color: rgba(79,70,229,0.4);
        background: rgba(79,70,229,0.1);
        color: #4338ca;
      }
      html[data-theme="light"] .mob-more-btn {
        border-color: rgba(0,0,0,0.16);
        background: rgba(0,0,0,0.04);
        color: rgba(0,0,0,0.68);
      }
      html[data-theme="light"] .mob-more-btn:hover:not(:disabled) {
        border-color: rgba(79,70,229,0.42);
        background: rgba(79,70,229,0.1);
        color: #4338ca;
      }
      html[data-theme="light"] .inp-web-label { color: rgba(0,0,0,0.45); }
      html[data-theme="light"] .inp-web-label:hover { color: rgba(0,0,0,0.65); }
      html[data-theme="light"] .m-bub a { color: #2563eb; }
      html[data-theme="light"] .m-bub a:hover { color: #1d4ed8; }
      html[data-theme="light"] .m-bub.user a { color: #4f46e5; }
      html[data-theme="light"] .m-bub.user a:hover { color: #4338ca; }
      html[data-theme="light"] .sum-text a,
      html[data-theme="light"] .md a { color: #2563eb; }
      html[data-theme="light"] .sum-text a:hover,
      html[data-theme="light"] .md a:hover { color: #1d4ed8; }
      html[data-theme="light"] .sum-text .md-link-preface,
      html[data-theme="light"] .md .md-link-preface,
      html[data-theme="light"] .m-bub .md-link-preface {
        color: rgba(0, 0, 0, 0.55);
      }
      html[data-theme="light"] .inp::placeholder { color: rgba(0,0,0,0.38); }
      html[data-theme="light"] .chat-uploads::-webkit-scrollbar-thumb { background: rgba(0,0,0,.16); }
      html[data-theme="light"] .chat-upload-chip {
        border-color: rgba(0,0,0,.12);
        background: rgba(0,0,0,.03);
      }
      html[data-theme="light"] .chat-upload-badge {
        background: rgba(220,38,38,0.18);
        border-color: rgba(220,38,38,0.35);
        color: #991b1b;
      }
      html[data-theme="light"] .chat-upload-name { color: #111827; }
      html[data-theme="light"] .chat-upload-type { color: rgba(0,0,0,.5); }
      html[data-theme="light"] .chat-paste-chip {
        border-color: rgba(99,102,241,.22);
        background: rgba(99,102,241,.05);
      }
      html[data-theme="light"] .chat-paste-chip .chat-upload-badge {
        background: rgba(99,102,241,.12);
        border-color: rgba(99,102,241,.28);
      }
      html[data-theme="light"] .chat-msg-file-chip {
        border-color: rgba(79,70,229,.25);
        background: rgba(79,70,229,.08);
        color: rgba(0,0,0,.78);
      }
      html[data-theme="light"] .chat-msg-file-chip .file-type {
        color: rgba(0,0,0,.55);
      }
      html[data-theme="light"] .chat-upload-rm {
        background: rgba(0,0,0,.08);
        color: rgba(0,0,0,.58);
      }
      html[data-theme="light"] .mdl-btn {
        border-color: rgba(0,0,0,0.1);
        background: rgba(0,0,0,0.03);
        color: rgba(0,0,0,0.65);
      }
      html[data-theme="light"] .mdl-menu {
        background: #fff;
        border-color: rgba(0,0,0,0.1);
        box-shadow: 0 -12px 36px rgba(0,0,0,0.12);
      }
      html[data-theme="light"] .mdl-opt { color: #374151; }
      html[data-theme="light"] .sources { border-top-color: rgba(0,0,0,0.08); }
    `}</style>

      <div className="wrap">
        <div className="atm">
          <div className="atm-a" />
          <div className="atm-b" />
        </div>

        <div className="body">
          {/* ── Main + Sources ── */}
          <div className="main-wrap">
            <main className="main">
              {/* Action bar */}
              <div className="act-bar">
                <div className="act-bar-title-wrap">
                  {!summaryLoading && !summaryError && summary && (
                    <>
                      {chatTitleEditing ? (
                        <input
                          ref={chatTitleInputRef}
                          type="text"
                          className="act-bar-chat-title-inp"
                          value={chatTitleDraft}
                          onChange={(e) => setChatTitleDraft(e.target.value)}
                          onBlur={() => saveChatTitle()}
                          onKeyDown={onChatTitleKeyDown}
                          disabled={chatTitleSaving}
                          maxLength={255}
                          aria-label="Chat title"
                        />
                      ) : (
                        <button
                          type="button"
                          className="act-bar-chat-title-btn"
                          onClick={startChatTitleEdit}
                          disabled={chatTitleSaving}
                          title="Click to rename"
                        >
                          {summary.title?.trim()
                            ? summary.title
                            : "Untitled summary"}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="act-bar-btns">
                  <Button variant="quiz" onClick={() => setQuizModal(true)}>
                    <QuizIco /> {compactActBar ? "Quiz" : "Generate Quiz"}
                  </Button>
                  <Button
                    variant="pdf"
                    onClick={handlePDF}
                    disabled={pdfLoading || !summary}
                  >
                    {pdfLoading ? (
                      <Spinner size={compactActBar ? 11 : 13} />
                    ) : (
                      <PdfIco />
                    )}{" "}
                    {compactActBar ? "PDF" : "Save as PDF"}
                  </Button>
                  <Button variant="slides" onClick={() => setSlidesModal(true)}>
                    <SlidesIco /> {compactActBar ? "Slides" : "Generate Slides"}
                  </Button>
                </div>
              </div>

              {/* Card: summary + chat */}
              <div className="card">
                <div className="sum-head">
                  <div className="sum-left">
                    <div className="sum-title">Your summarized content</div>
                    <div className="sum-tags">
                      <span className="tag tag-m">{summary?.model ?? "—"}</span>
                      <span
                        className={`tag ${summary?.summarizeFor === "lecturer" ? "tag-lec" : "tag-stu"}`}
                      >
                        {summary?.summarizeFor ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="sum-right">
                    <div className="sum-head-actions">
                      <button
                        type="button"
                        className={`sum-copy-btn ${summaryCopied ? "copied" : ""}`}
                        title={summaryCopied ? "Copied!" : "Copy summary"}
                        onClick={handleCopySummary}
                        disabled={summaryLoading || !summary?.output}
                        aria-label="Copy summary"
                      >
                        {summaryCopied ? (
                          <span className="sum-copy-txt">Copied</span>
                        ) : (
                          <CopyIco size={12} />
                        )}
                      </button>
                      <div className="sum-hl-wrap" ref={hlToolbarRef}>
                        <button
                          type="button"
                          className={`sum-hl-main ${hlModeActive ? "on" : ""}`}
                          title={
                            hlModeActive
                              ? "Highlight on — drag to select text in the summary, then save highlights in the sidebar"
                              : "Highlight — turn on, pick a color, select text in the summary to mark it"
                          }
                          aria-pressed={hlModeActive}
                          aria-label={
                            hlModeActive
                              ? "Highlight mode on; select text in the summary"
                              : "Turn on highlight mode to mark text in the summary"
                          }
                          disabled={summaryLoading || !summary?.output}
                          onClick={() => {
                            setHlModeActive((v) => !v);
                            setHlColorMenuOpen(false);
                          }}
                        >
                          <HighlightIco size={13} />
                          <span className="sum-hl-main-txt">Highlight</span>
                        </button>
                        <button
                          type="button"
                          className={`sum-hl-chevron ${hlColorMenuOpen ? "open" : ""}`}
                          title="Highlight color"
                          aria-expanded={hlColorMenuOpen}
                          aria-haspopup="true"
                          disabled={summaryLoading || !summary?.output}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHlColorMenuOpen((v) => !v);
                          }}
                        >
                          <Chevron open={hlColorMenuOpen} />
                        </button>
                        {hlColorMenuOpen && (
                          <div
                            className="sum-hl-menu"
                            role="menu"
                            aria-label="Highlight colors"
                          >
                            <div className="sum-hl-menu-label">Color</div>
                            <div className="sum-hl-swatch-row">
                              {HIGHLIGHT_PRESETS.map((p) => (
                                <button
                                  key={p.hex}
                                  type="button"
                                  role="menuitem"
                                  title={p.label}
                                  className={`sum-hl-swatch ${hlColorHex === p.hex ? "cur" : ""}`}
                                  style={{ backgroundColor: p.hex }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setHlColorHex(p.hex);
                                    setHlModeActive(true);
                                    setHlColorMenuOpen(false);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mobile-only: three-dot "More" button → bottom sheet with full right panel */}
                      <button
                        type="button"
                        className="mob-more-btn"
                        title="More — sources, slide decks, quizzes, highlights"
                        aria-label="More options"
                        onClick={() => setMobileMoreOpen(true)}
                        disabled={summaryLoading || !summary?.output}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <circle cx="3" cy="8" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="13" cy="8" r="1.5" />
                        </svg>
                        {pendingHighlights.length > 0 && (
                          <span className="hl-list-badge">
                            {Math.min(99, pendingHighlights.length)}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="sum-files">
                      {summary?.files?.map?.((f) => (
                        <span key={f.id} className="fchip">
                          <DocIco ext={f.type} />
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="unified-scroll">
                  {summaryLoading ? (
                    <div className="sum-text" style={{ paddingTop: 8 }}>
                      Loading summary...
                    </div>
                  ) : summaryError ? (
                    <div className="sum-text" style={{ paddingTop: 8 }}>
                      Error: {summaryError}
                    </div>
                  ) : (
                    <>
                      <div
                        className={`hl-select-ctx${hlModeActive ? " hl-mode-active" : ""}`}
                        style={
                          hlModeActive
                            ? { ["--hl-pick"]: hlColorHex }
                            : undefined
                        }
                      >
                        <div
                          ref={summaryBodyRef}
                          role="article"
                          className="sum-text md sum-selectable"
                          style={SUMMARY_BODY_INNER_STYLE}
                          onMouseUp={handleSummaryMouseUp}
                          onPointerUp={handleSummaryMouseUp}
                          onTouchEnd={handleSummaryMouseUp}
                          dangerouslySetInnerHTML={summaryBodyDangerousHtml}
                        />
                      </div>
                      <div className="sum-gen-meta">
                        Generated by {formatSummaryModelLabel(summary?.model)} ·{" "}
                        {fmtDate(summary?.createdAt)}
                      </div>
                    </>
                  )}

                  {(messages.length > 0 || chatLoading) && (
                    <div className="conv-divider">
                      <div className="conv-label">
                        Continue the conversation
                      </div>
                      <div className="chat-thread">
                        {messages.map((m, i) => {
                          const showRegen =
                            m.role === "ai" &&
                            !m.error &&
                            i === messages.length - 1 &&
                            !chatLoading;
                          return (
                            <div key={m.id} className={`m-row ${m.role}`}>
                              <div className={`m-ava ${m.role}`}>
                                {m.role === "ai" ? <BotIco /> : <UserIco />}
                              </div>
                              <div className="m-bub-wrap">
                                <div className="m-bub-col">
                                  <div
                                    className={`m-bub ${m.role} ${m.error ? "err" : ""} md`}
                                  >
                                    {m.role === "user" &&
                                      Array.isArray(m.attachedFiles) &&
                                      m.attachedFiles.length > 0 && (
                                        <div className="chat-msg-files">
                                          {m.attachedFiles.map((f, ii) => (
                                            <div
                                              key={`${f.name}-${ii}`}
                                              className="chat-msg-file-chip"
                                              title={f.name}
                                            >
                                              <DocIco ext={f.type} size={14} />
                                              <span className="file-name">
                                                {f.name}
                                              </span>
                                              <span className="file-type">
                                                {String(
                                                  f.type || "file",
                                                ).toUpperCase()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    {m.role === "user" &&
                                      m.imagePreviews &&
                                      m.imagePreviews.length > 0 && (
                                        <div className="chat-msg-images">
                                          {m.imagePreviews.map((src, ii) => (
                                            <img key={ii} src={src} alt="" />
                                          ))}
                                        </div>
                                      )}
                                    {m.role === "user" &&
                                      (m.lostPastedImageCount || 0) > 0 && (
                                        <div className="chat-img-lost-note">
                                          {m.lostPastedImageCount} pasted image
                                          {m.lostPastedImageCount === 1
                                            ? ""
                                            : "s"}{" "}
                                          in this message (previews are not kept
                                          after refresh)
                                        </div>
                                      )}
                                    {(() => {
                                      const raw = (m.content || "").trim();
                                      const hidePlaceholder =
                                        m.role === "user" &&
                                        raw === "[Image message]" &&
                                        ((m.imagePreviews?.length || 0) > 0 ||
                                          (m.lostPastedImageCount || 0) > 0);
                                      const mdSrc = hidePlaceholder
                                        ? ""
                                        : m.content || "";
                                      if (
                                        m.role === "user" &&
                                        !mdSrc.trim() &&
                                        ((m.imagePreviews?.length || 0) > 0 ||
                                          (m.lostPastedImageCount || 0) > 0)
                                      ) {
                                        return null;
                                      }
                                      return (
                                        <div
                                          dangerouslySetInnerHTML={{
                                            __html: markdownToHtml(mdSrc),
                                          }}
                                        />
                                      );
                                    })()}
                                  </div>
                                  {m.role === "ai" &&
                                    m.modelLabel &&
                                    !m.error && (
                                      <div className="m-meta">
                                        Generated by {m.modelLabel}
                                      </div>
                                    )}
                                  {/* Web fallback is automatic; keep UI clean like ChatGPT. */}
                                </div>
                                {m.role === "ai" &&
                                  (m.content || "").trim() && (
                                    <div className="m-bub-side-actions">
                                      {showRegen && (
                                        <button
                                          type="button"
                                          className="m-copy"
                                          title="Regenerate response"
                                          onClick={() =>
                                            regenerateLastResponse()
                                          }
                                          aria-label="Regenerate response"
                                        >
                                          <RegenIco size={12} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className={`m-copy ${copiedId === m.id ? "copied" : ""}`}
                                        title={
                                          copiedId === m.id ? "Copied!" : "Copy"
                                        }
                                        onClick={() => handleCopyMessage(m)}
                                        aria-label="Copy message"
                                      >
                                        {copiedId === m.id ? (
                                          <span className="m-copy-txt">
                                            Copied
                                          </span>
                                        ) : (
                                          <CopyIco size={12} />
                                        )}
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                        {chatLoading && (
                          <div className="m-row ai">
                            <div className="m-ava ai">
                              <BotIco />
                            </div>
                            <div className="m-bub ai">
                              <div className="dots">
                                <div className="dot" />
                                <div className="dot" />
                                <div className="dot" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {messages.length === 0 && !chatLoading && (
                    <>
                      <div className="chat-hint">
                        <div className="chat-empty">
                          <BotIco />
                          <span>
                            Continue below — your replies stay in this thread
                            with the summary above.
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {messages.length > 0 &&
                    summary?.output &&
                    chatSuggestions.length > 0 && (
                      <div
                        className="suggests suggests--end-chat"
                        role="group"
                        aria-label="Suggested questions from this summary"
                      >
                        {chatSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="sug"
                            onClick={() => {
                              setInputVal(s);
                              requestAnimationFrame(() =>
                                inputRef.current?.focus(),
                              );
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                  <div ref={bottomRef} />
                </div>

                {chatNotice ? (
                  <div className="chat-notice" role="status">
                    {chatNotice}
                  </div>
                ) : null}

                {/* Input */}
                <div className="inp-row">
                  <input
                    ref={sourceInputRef}
                    type="file"
                    multiple
                    accept={ATTACH_ACCEPT}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      void handleAttachmentFilesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div
                    className={`chatbox ${pendingSourceFiles.length > 0 || pendingPasteImages.length > 0 ? "with-files" : ""}`}
                  >
                    <button
                      type="button"
                      className="attach-btn"
                      title="Add attachment (documents or images)"
                      aria-label="Add attachment"
                      disabled={sourceUploadLoading || chatLoading}
                      onClick={() => sourceInputRef.current?.click()}
                    >
                      {sourceUploadLoading ? (
                        <Spinner size={12} />
                      ) : (
                        <ClipIco size={16} />
                      )}
                      {pendingSourceFiles.length > 0 && (
                        <span className="attach-badge">
                          {Math.min(99, pendingSourceFiles.length)}
                        </span>
                      )}
                    </button>
                    <span className="attach-divider" aria-hidden />
                    <div className="chatbox-main">
                      {(pendingSourceFiles.length > 0 ||
                        pendingPasteImages.length > 0) && (
                        <div
                          className="chat-uploads"
                          aria-label="Attached files"
                        >
                          {pendingPasteImages.map((p, pi) => (
                            <div
                              key={p.clientId}
                              className="chat-upload-chip chat-paste-chip"
                              title={`Image ${pi + 1}`}
                            >
                              <div className="chat-upload-badge" aria-hidden>
                                <span className="chat-paste-ico" />
                              </div>
                              <div className="chat-upload-content chat-upload-content-single">
                                <span className="chat-upload-name">
                                  Image {pi + 1}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="chat-upload-rm"
                                onClick={() =>
                                  removePendingPasteByClientId(p.clientId)
                                }
                                aria-label={`Remove image ${pi + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {pendingSourceFiles.map((f) => (
                            <div
                              key={f.clientId}
                              className="chat-upload-chip"
                              title={f.name}
                            >
                              <div className="chat-upload-badge" aria-hidden>
                                <DocIco ext={f.type} size={18} />
                              </div>
                              <div className="chat-upload-content">
                                <span className="chat-upload-name">
                                  {f.name}
                                </span>
                                <span className="chat-upload-type">
                                  {f.type}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="chat-upload-rm"
                                onClick={() =>
                                  removePendingSourceByClientId(f.clientId)
                                }
                                aria-label={`Remove ${f.name}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="chatbox-row">
                        <input
                          ref={inputRef}
                          className="inp"
                          placeholder="Refine your summary or ask question..."
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items?.length) return;
                            for (const item of items) {
                              if (
                                item.kind === "file" &&
                                item.type.startsWith("image/")
                              ) {
                                const file = item.getAsFile();
                                if (file) {
                                  e.preventDefault();
                                  void addPastedImageFromFile(file);
                                  break;
                                }
                              }
                            }
                          }}
                          onKeyDown={(e) =>
                            e.key === "Enter" && !e.shiftKey && sendMessage()
                          }
                          disabled={chatLoading || sourceUploadLoading}
                        />
                        <div className="mdl-wrap">
                          <button
                            className={`mdl-btn ${modelOpen ? "open" : ""}`}
                            onClick={() => setModelOpen((v) => !v)}
                            onBlur={() =>
                              setTimeout(() => setModelOpen(false), 150)
                            }
                            disabled={chatLoading || sourceUploadLoading}
                          >
                            {chatModel} <Chevron open={modelOpen} />
                          </button>
                          {modelOpen && (
                            <div className="mdl-menu">
                              {MODELS.map((m) => (
                                <div
                                  key={m}
                                  className={`mdl-opt ${chatModel === m ? "on" : ""}`}
                                  onMouseDown={() => {
                                    setChatModel(m);
                                    setModelOpen(false);
                                  }}
                                >
                                  {m} {chatModel === m && "✓"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="send-btn send-btn--inline"
                      onClick={() => sendMessage()}
                      disabled={
                        chatLoading ||
                        sourceUploadLoading ||
                        (!inputVal.trim() &&
                          pendingPasteImages.length === 0 &&
                          pendingSourceFiles.length === 0) ||
                        !summary?.output
                      }
                    >
                      {chatLoading || sourceUploadLoading ? (
                        <Spinner size={14} />
                      ) : (
                        <SendIco />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {/* /card */}
            </main>

            <div
              className="sum-splitter"
              onMouseDown={(e) => {
                splitterRef.current = {
                  startX: e.clientX,
                  startWidth: sourcesWidth,
                };
                setSplitterDragging(true);
                document.body.style.cursor = "col-resize";
              }}
              role="separator"
              aria-label="Resize sources panel"
            />

            {/* Sources panel (NotebookLM style) */}
            <aside
              className="sources"
              aria-label="Sources"
              style={{ width: sourcesWidth }}
            >
              <div className="src-header">
                <span className="src-title">SOURCES</span>
              </div>
              <div className="src-list">
                {(() => {
                  const base = summary?.files || [];
                  const extras = extraSources.filter(
                    (es) => !base.some((f) => f.id === es.id),
                  );
                  const all = [...base, ...extras];
                  if (!all.length) {
                    return (
                      <div className="src-empty">
                        No attached sources. Use “Add sources” to pick documents
                        from the dashboard.
                      </div>
                    );
                  }
                  return all.map((f) => (
                    <div key={f.id} className="src-item">
                      <DocIco ext={f.type} />
                      <div className="src-info">
                        <div className="src-name" title={f.name}>
                          {f.name}
                        </div>
                        <div className="src-meta">{f.type}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div
                className="hl-panel sd-panel sd-panel--sources"
                aria-label="Saved slide decks"
              >
                <div className="hl-head-row">
                  <div className="hl-head">SLIDE DECKS</div>
                  <button
                    type="button"
                    className="sd-refresh-btn"
                    title="Refresh slide decks"
                    disabled={slideDecksLoading}
                    onClick={() => void fetchSlideDecks()}
                  >
                    {slideDecksLoading ? <Spinner size={11} /> : "↻"}
                  </button>
                </div>
                <div className="sd-deck-list">
                  {slideDecksLoading && slideDecks.length === 0 ? (
                    <div className="hl-empty">
                      <Spinner size={12} /> Loading…
                    </div>
                  ) : slideDecks.length === 0 ? (
                    <div className="hl-empty">
                      None yet. Generate slides — a copy saves here
                      automatically.
                    </div>
                  ) : (
                    slideDecks.map((d) => (
                      <div key={d.id} className="sd-deck-row">
                        <div className="sd-deck-title" title={d.title}>
                          {d.title}
                        </div>
                        <div className="sd-deck-meta">
                          {formatSlideDeckSavedAt(d.createdAt)}
                        </div>
                        <div className="sd-deck-actions">
                          <button
                            type="button"
                            className="sd-deck-btn"
                            onClick={() => openSlideDeckPreview(d)}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="sd-deck-btn"
                            onClick={() => void downloadSlideDeck(d)}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="sd-deck-btn"
                            disabled={slideDeckDeletingId === d.id}
                            onClick={() => void deleteSlideDeck(d)}
                          >
                            {slideDeckDeletingId === d.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                className="hl-panel sd-panel sd-panel--sources"
                aria-label="Saved quizzes"
              >
                <div className="hl-head-row">
                  <div className="hl-head">SAVED QUIZZES</div>
                  <button
                    type="button"
                    className="sd-refresh-btn"
                    title="Refresh saved quizzes"
                    disabled={quizSetsLoading}
                    onClick={() => void fetchQuizSets()}
                  >
                    {quizSetsLoading ? <Spinner size={11} /> : "↻"}
                  </button>
                </div>
                <div
                  className="hl-sub"
                  style={{ marginTop: -4, marginBottom: 6 }}
                >
                  Quiz questions stay saved here. When you{" "}
                  <strong>finish</strong> a quiz, that score is stored; exiting
                  early does not save an attempt. Use <strong>History</strong>{" "}
                  below to see past scores for each quiz.
                </div>
                <div className="sd-deck-list">
                  {quizSetsLoading && quizSets.length === 0 ? (
                    <div className="hl-empty">
                      <Spinner size={12} /> Loading…
                    </div>
                  ) : quizSets.length === 0 ? (
                    <div className="hl-empty">
                      None yet. Generate a quiz — it saves here automatically.
                    </div>
                  ) : (
                    quizSets.map((q) => (
                      <Fragment key={q.id}>
                        <div className="sd-deck-row">
                          <div className="sd-deck-title" title={q.title}>
                            {q.title}
                          </div>
                          <div className="sd-deck-meta">
                            {formatSlideDeckSavedAt(q.createdAt)}
                            {typeof q._count?.questions === "number"
                              ? ` · ${q._count.questions} Q`
                              : ""}
                            {q.latestAttempt ? (
                              <>
                                {" "}
                                · Last: {q.latestAttempt.score}/
                                {q.latestAttempt.totalQuestions}
                                {q.latestAttempt.createdAt
                                  ? ` (${formatSlideDeckSavedAt(q.latestAttempt.createdAt)})`
                                  : ""}
                              </>
                            ) : (
                              " · No attempts yet"
                            )}
                          </div>
                          <div className="sd-deck-actions">
                            <button
                              type="button"
                              className="sd-deck-btn"
                              title="View past scores for this quiz"
                              onClick={() => toggleQuizHistoryPanel(q.id)}
                            >
                              {quizHistoryOpenId === q.id ? "Hide" : "History"}
                            </button>
                            <button
                              type="button"
                              className="sd-deck-btn"
                              disabled={quizSetOpeningId === q.id}
                              onClick={() => void openSavedQuizSet(q.id)}
                            >
                              {quizSetOpeningId === q.id ? "…" : "Open"}
                            </button>
                          </div>
                        </div>
                        {quizHistoryOpenId === q.id && (
                          <div
                            className="hl-sub"
                            style={{
                              margin: "0 0 8px",
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,.08)",
                              fontSize: 11,
                              lineHeight: 1.45,
                            }}
                          >
                            {quizHistoryLoading ? (
                              <>
                                <Spinner size={11} /> Loading…
                              </>
                            ) : quizHistoryList.length === 0 ? (
                              "No finished attempts yet."
                            ) : (
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: 18,
                                  listStyle: "disc",
                                }}
                              >
                                {quizHistoryList.map((a) => (
                                  <li key={a.id} style={{ marginBottom: 6 }}>
                                    <button
                                      type="button"
                                      style={{
                                        border:
                                          "1px solid rgba(255,255,255,.12)",
                                        background: "rgba(255,255,255,.04)",
                                        color: "inherit",
                                        borderRadius: 7,
                                        padding: "6px 8px",
                                        fontSize: 11,
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                      }}
                                      onClick={() => openQuizAttemptDetail(a)}
                                    >
                                      {a.score}/{a.totalQuestions}
                                      {a.createdAt
                                        ? ` — ${formatSlideDeckSavedAt(a.createdAt)}`
                                        : ""}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </Fragment>
                    ))
                  )}
                </div>
              </div>

              <div
                className="hl-panel hl-panel--sources"
                aria-label="Highlights"
              >
                <div className="hl-head-row">
                  <div className="hl-head">HIGHLIGHTS</div>
                  <button
                    type="button"
                    className="hl-save-btn"
                    title={
                      pendingHighlights.length
                        ? `Save ${pendingHighlights.length} highlight(s) to the server`
                        : "No unsaved highlights"
                    }
                    disabled={
                      pendingHighlights.length === 0 || hlSaving || hlLoading
                    }
                    onClick={() => void flushPendingHighlights()}
                    aria-label="Save highlights"
                  >
                    {hlSaving ? <Spinner size={12} /> : <SaveIco size={14} />}
                  </button>
                </div>
                {pendingHighlights.length > 0 && (
                  <div className="hl-sub">
                    {pendingHighlights.length} unsaved — click save. Leaving
                    this page may prompt you if you have not saved.
                  </div>
                )}
                {hlLoading ? (
                  <div className="hl-empty">
                    <Spinner size={12} /> Loading…
                  </div>
                ) : highlights.length === 0 &&
                  pendingHighlights.length === 0 ? (
                  <div className="hl-empty">
                    Turn on the highlighter, pick a color, select text in the
                    summary, then save here.
                  </div>
                ) : (
                  <>
                    {pendingHighlights.map((p) => (
                      <div
                        key={p.clientId}
                        className="hl-item pending"
                        style={{
                          ["--hl-accent"]:
                            p.color && /^#[0-9a-f]{6}$/i.test(p.color)
                              ? p.color
                              : DEFAULT_HL_HEX,
                        }}
                        onClick={() => scrollToHighlight(p.clientId)}
                        title={p.quote}
                      >
                        <span className="hl-color-dot" />
                        <div className="hl-quote">
                          {p.quote.length > 140
                            ? `${p.quote.slice(0, 140)}…`
                            : p.quote}
                        </div>
                        <button
                          type="button"
                          className="hl-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePendingHighlight(p.clientId);
                          }}
                          aria-label="Remove unsaved highlight"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {highlights.map((h) => (
                      <div
                        key={h.id}
                        className="hl-item"
                        style={{
                          ["--hl-accent"]:
                            h.color && /^#[0-9a-f]{6}$/i.test(h.color)
                              ? h.color
                              : DEFAULT_HL_HEX,
                        }}
                        onClick={() => scrollToHighlight(h.id)}
                        title={h.quote}
                      >
                        <span className="hl-color-dot" />
                        <div className="hl-quote">
                          {h.quote.length > 140
                            ? `${h.quote.slice(0, 140)}…`
                            : h.quote}
                        </div>
                        <button
                          type="button"
                          className="hl-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHighlight(h.id);
                          }}
                          aria-label="Remove highlight"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
      {slidesModal && (
        <GenerateSlidesModal
          onClose={() => setSlidesModal(false)}
          summaryText={summary?.output || ""}
          summarizeFor={summary?.summarizeFor || "student"}
          summaryId={(() => {
            const n = Number.parseInt(String(summaryId ?? ""), 10);
            return Number.isFinite(n) && n > 0 ? n : null;
          })()}
          onSlideDecksChanged={fetchSlideDecks}
        />
      )}

      {slideDeckPreviewOpen && (
        <AlaiSlidesPreviewModal
          onClose={() => setSlideDeckPreviewOpen(false)}
          previewUrl={slideDeckPreviewUrl}
          remotePptUrl={slideDeckRemotePptUrl}
          title={slideDeckPreviewTitle}
          subtitle="Saved slide deck"
          onDownload={(() => {
            const fn = slideDeckDlRef.current;
            return typeof fn === "function"
              ? async () => {
                  await fn();
                }
              : undefined;
          })()}
        />
      )}

      {quizModal && (
        <QuizSettingsModal
          summaryId={summaryId}
          onClose={() => setQuizModal(false)}
          onGenerated={(quiz) => {
            setQuizModal(false);
            setQuizData(quiz);
            setQuizSettings(settingsFromQuizSet(quiz));
            setQuizView(true);
            void fetchQuizSets();
          }}
        />
      )}

      {quizView && quizData && (
        <QuizViewModal
          key={quizData.id}
          quizSet={quizData}
          settings={quizSettings}
          summaryId={summaryId}
          onAttemptSaved={() => void fetchQuizSets()}
          onClose={() => setQuizView(false)}
        />
      )}

      {quizAttemptDetail &&
        (() => {
          const totalQ =
            quizAttemptDetail.totalQuestions ||
            quizAttemptDetail.rows.length ||
            1;
          const score = quizAttemptDetail.score ?? 0;
          const pct = Math.round((score / totalQ) * 100);
          const grade =
            pct >= 90
              ? {
                  label: "Excellent",
                  color: "#22c55e",
                  bg: "rgba(34,197,94,0.10)",
                }
              : pct >= 70
                ? {
                    label: "Good",
                    color: "#3b82f6",
                    bg: "rgba(59,130,246,0.10)",
                  }
                : pct >= 50
                  ? {
                      label: "Fair",
                      color: "#f59e0b",
                      bg: "rgba(245,158,11,0.10)",
                    }
                  : {
                      label: "Needs work",
                      color: "#ef4444",
                      bg: "rgba(239,68,68,0.10)",
                    };
          return (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setQuizAttemptDetail(null);
              }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1200,
                background: "rgba(4,6,15,0.72)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <style>{`
              @keyframes qa-fade-in { from { opacity:0; transform:scale(0.97) translateY(6px); } to { opacity:1; transform:none; } }
              .qa-modal { animation: qa-fade-in 0.2s cubic-bezier(.22,.68,0,1.2); }
              .qa-row-card { transition: background 0.15s; }
              .qa-row-card:hover { background: rgba(255,255,255,0.04) !important; }
              .qa-close-btn:hover { background: rgba(255,255,255,0.10) !important; }
              .qa-dismiss-btn:hover { opacity: 0.8; }
              .qa-scroll::-webkit-scrollbar { width: 4px; }
              .qa-scroll::-webkit-scrollbar-track { background: transparent; }
              .qa-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
            `}</style>
              <div
                className="qa-modal"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(720px, 100%)",
                  maxHeight: "90vh",
                  background: "var(--sum-card-bg)",
                  border: "1px solid var(--sum-card-border)",
                  borderRadius: 18,
                  boxShadow:
                    "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* ── Header ── */}
                <div
                  style={{
                    padding: "18px 20px 16px",
                    borderBottom: "1px solid var(--sum-head-border)",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        opacity: 0.45,
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        marginBottom: 7,
                      }}
                    >
                      Attempt Review
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Score pill */}
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: grade.bg,
                          border: `1px solid ${grade.color}44`,
                          borderRadius: 999,
                          padding: "4px 12px 4px 8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: grade.color,
                          }}
                        >
                          {score}/{totalQ}
                        </span>
                        <span
                          style={{
                            width: 1,
                            height: 12,
                            background: `${grade.color}44`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: grade.color,
                            opacity: 0.85,
                          }}
                        >
                          {pct}% · {grade.label}
                        </span>
                      </div>
                      {quizAttemptDetail.createdAt && (
                        <span style={{ fontSize: 12, opacity: 0.38 }}>
                          {formatSlideDeckSavedAt(quizAttemptDetail.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="qa-close-btn"
                    onClick={() => setQuizAttemptDetail(null)}
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid var(--sum-card-border)",
                      background: "transparent",
                      color: "var(--sum-inp-text)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      lineHeight: 1,
                      transition: "background 0.15s",
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* ── Score progress bar ── */}
                <div
                  style={{
                    height: 3,
                    background: "rgba(255,255,255,0.05)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${grade.color}80, ${grade.color})`,
                      transition: "width 0.6s cubic-bezier(.22,.68,0,1)",
                    }}
                  />
                </div>

                {/* ── Question list ── */}
                <div
                  className="qa-scroll"
                  style={{
                    padding: "14px 16px",
                    overflowY: "auto",
                    minHeight: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {quizAttemptDetail.rows.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        opacity: 0.38,
                        fontSize: 13,
                      }}
                    >
                      No question data found for this attempt.
                    </div>
                  ) : (
                    quizAttemptDetail.rows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="qa-row-card"
                        style={{
                          borderRadius: 12,
                          border: "1px solid var(--sum-card-border)",
                          borderLeft: `3px solid ${row.isCorrect ? "#22c55e" : "#ef4444"}`,
                          padding: "12px 14px",
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        {/* Row header */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: "0.07em",
                              textTransform: "uppercase",
                              opacity: 0.38,
                            }}
                          >
                            Q{row.questionNumber ?? idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: row.isCorrect ? "#22c55e" : "#ef4444",
                              background: row.isCorrect
                                ? "rgba(34,197,94,0.10)"
                                : "rgba(239,68,68,0.10)",
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {row.isCorrect ? "✓ Correct" : "✗ Wrong"}
                          </span>
                        </div>

                        {/* Question text */}
                        <div
                          style={{
                            fontSize: 13.5,
                            lineHeight: 1.55,
                            marginBottom: 10,
                          }}
                        >
                          {row.question}
                        </div>

                        {/* Answer chips */}
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: row.isCorrect
                                ? "rgba(34,197,94,0.08)"
                                : "rgba(239,68,68,0.08)",
                              border: `1px solid ${row.isCorrect ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)"}`,
                              color: row.isCorrect ? "#22c55e" : "#ef4444",
                            }}
                          >
                            <span
                              style={{
                                opacity: 0.6,
                                color: "inherit",
                                marginRight: 4,
                              }}
                            >
                              Your answer:
                            </span>
                            {row.userAnswer != null &&
                            String(row.userAnswer).trim() ? (
                              String(row.userAnswer)
                            ) : (
                              <em style={{ opacity: 0.55 }}>No answer</em>
                            )}
                          </div>
                          {!row.isCorrect && (
                            <div
                              style={{
                                fontSize: 12,
                                padding: "4px 10px",
                                borderRadius: 8,
                                background: "rgba(34,197,94,0.08)",
                                border: "1px solid rgba(34,197,94,0.22)",
                                color: "#22c55e",
                              }}
                            >
                              <span
                                style={{
                                  opacity: 0.6,
                                  color: "inherit",
                                  marginRight: 4,
                                }}
                              >
                                Correct:
                              </span>
                              {row.correctAnswer}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Footer ── */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--sum-head-border)",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="qa-dismiss-btn"
                    onClick={() => setQuizAttemptDetail(null)}
                    style={{
                      height: 36,
                      padding: "0 20px",
                      borderRadius: 10,
                      border: "1px solid var(--sum-card-border)",
                      background: "rgba(255,255,255,0.06)",
                      color: "inherit",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 500,
                      transition: "opacity 0.15s",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── Mobile "More" bottom sheet ── */}
      {mobileMoreOpen && (
        <div
          className="mob-more-overlay"
          onClick={() => setMobileMoreOpen(false)}
          aria-modal="true"
          role="dialog"
          aria-label="More options"
        >
          <style>{`
            @keyframes mob-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
            .mob-more-overlay { position:fixed; inset:0; z-index:1300; background:rgba(4,6,15,0.65); backdrop-filter:blur(6px); display:flex; flex-direction:column; justify-content:flex-end; }
            .mob-more-sheet { background:var(--sum-card-bg); border:1px solid var(--sum-card-border); border-bottom:none; border-radius:18px 18px 0 0; max-height:88vh; display:flex; flex-direction:column; animation:mob-sheet-up 0.28s cubic-bezier(.22,.68,0,1.2); box-shadow:0 -16px 48px rgba(0,0,0,0.45); }
            .mob-more-handle { width:36px; height:4px; border-radius:2px; background:rgba(255,255,255,0.18); margin:10px auto 0; flex-shrink:0; }
            .mob-more-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 10px; border-bottom:1px solid var(--sum-head-border); flex-shrink:0; }
            .mob-more-title { font-size:13px; font-weight:700; opacity:0.55; letter-spacing:0.07em; text-transform:uppercase; }
            .mob-more-close { width:30px; height:30px; border-radius:8px; border:1px solid var(--sum-card-border); background:transparent; color:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:17px; }
            .mob-more-body { overflow-y:auto; flex:1; min-height:0; padding:12px; display:flex; flex-direction:column; gap:10px; }
            .mob-more-body::-webkit-scrollbar { width:3px; }
            .mob-more-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:3px; }
          `}</style>
          <div className="mob-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mob-more-handle" />
            <div className="mob-more-header">
              <span className="mob-more-title">More</span>
              <button
                type="button"
                className="mob-more-close"
                onClick={() => setMobileMoreOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mob-more-body">
              {/* Sources */}
              <div className="hl-panel" aria-label="Sources">
                <div className="hl-head-row">
                  <div className="hl-head">SOURCES</div>
                </div>
                <div className="src-list" style={{ padding: 0 }}>
                  {(() => {
                    const base = summary?.files || [];
                    const extras = extraSources.filter(
                      (es) => !base.some((f) => f.id === es.id),
                    );
                    const all = [...base, ...extras];
                    if (!all.length)
                      return (
                        <div className="src-empty">No attached sources.</div>
                      );
                    return all.map((f) => (
                      <div key={f.id} className="src-item">
                        <DocIco ext={f.type} />
                        <div className="src-info">
                          <div className="src-name" title={f.name}>
                            {f.name}
                          </div>
                          <div className="src-meta">{f.type}</div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Slide Decks */}
              <div className="hl-panel sd-panel" aria-label="Saved slide decks">
                <div className="hl-head-row">
                  <div className="hl-head">SLIDE DECKS</div>
                  <button
                    type="button"
                    className="sd-refresh-btn"
                    title="Refresh slide decks"
                    disabled={slideDecksLoading}
                    onClick={() => void fetchSlideDecks()}
                  >
                    {slideDecksLoading ? <Spinner size={11} /> : "↻"}
                  </button>
                </div>
                <div className="sd-deck-list">
                  {slideDecksLoading && slideDecks.length === 0 ? (
                    <div className="hl-empty">
                      <Spinner size={12} /> Loading…
                    </div>
                  ) : slideDecks.length === 0 ? (
                    <div className="hl-empty">
                      None yet. Generate slides — a copy saves here
                      automatically.
                    </div>
                  ) : (
                    slideDecks.map((d) => (
                      <div key={d.id} className="sd-deck-row">
                        <div className="sd-deck-title" title={d.title}>
                          {d.title}
                        </div>
                        <div className="sd-deck-meta">
                          {formatSlideDeckSavedAt(d.createdAt)}
                        </div>
                        <div className="sd-deck-actions">
                          <button
                            type="button"
                            className="sd-deck-btn"
                            onClick={() => {
                              void openSlideDeckPreview(d);
                              setMobileMoreOpen(false);
                            }}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="sd-deck-btn"
                            onClick={() => void downloadSlideDeck(d)}
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="sd-deck-btn"
                            disabled={slideDeckDeletingId === d.id}
                            onClick={() => void deleteSlideDeck(d)}
                          >
                            {slideDeckDeletingId === d.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Saved Quizzes */}
              <div className="hl-panel sd-panel" aria-label="Saved quizzes">
                <div className="hl-head-row">
                  <div className="hl-head">SAVED QUIZZES</div>
                  <button
                    type="button"
                    className="sd-refresh-btn"
                    title="Refresh saved quizzes"
                    disabled={quizSetsLoading}
                    onClick={() => void fetchQuizSets()}
                  >
                    {quizSetsLoading ? <Spinner size={11} /> : "↻"}
                  </button>
                </div>
                <div
                  className="hl-sub"
                  style={{ marginTop: -4, marginBottom: 6 }}
                >
                  Quiz questions stay saved here. Finish a quiz to save a score.
                  Use <strong>History</strong> to see past scores.
                </div>
                <div className="sd-deck-list">
                  {quizSetsLoading && quizSets.length === 0 ? (
                    <div className="hl-empty">
                      <Spinner size={12} /> Loading…
                    </div>
                  ) : quizSets.length === 0 ? (
                    <div className="hl-empty">
                      None yet. Generate a quiz — it saves here automatically.
                    </div>
                  ) : (
                    quizSets.map((q) => (
                      <Fragment key={q.id}>
                        <div className="sd-deck-row">
                          <div className="sd-deck-title" title={q.title}>
                            {q.title}
                          </div>
                          <div className="sd-deck-meta">
                            {formatSlideDeckSavedAt(q.createdAt)}
                            {typeof q._count?.questions === "number"
                              ? ` · ${q._count.questions} Q`
                              : ""}
                            {q.latestAttempt ? (
                              <>
                                {" "}
                                · Last: {q.latestAttempt.score}/
                                {q.latestAttempt.totalQuestions}
                                {q.latestAttempt.createdAt
                                  ? ` (${formatSlideDeckSavedAt(q.latestAttempt.createdAt)})`
                                  : ""}
                              </>
                            ) : (
                              " · No attempts yet"
                            )}
                          </div>
                          <div className="sd-deck-actions">
                            <button
                              type="button"
                              className="sd-deck-btn"
                              title="View past scores for this quiz"
                              onClick={() => toggleQuizHistoryPanel(q.id)}
                            >
                              {quizHistoryOpenId === q.id ? "Hide" : "History"}
                            </button>
                            <button
                              type="button"
                              className="sd-deck-btn"
                              disabled={quizSetOpeningId === q.id}
                              onClick={() => {
                                void openSavedQuizSet(q.id);
                                setMobileMoreOpen(false);
                              }}
                            >
                              {quizSetOpeningId === q.id ? "…" : "Open"}
                            </button>
                          </div>
                        </div>
                        {quizHistoryOpenId === q.id && (
                          <div
                            className="hl-sub"
                            style={{
                              margin: "0 0 8px",
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,.08)",
                              fontSize: 11,
                              lineHeight: 1.45,
                            }}
                          >
                            {quizHistoryLoading ? (
                              <>
                                <Spinner size={11} /> Loading…
                              </>
                            ) : quizHistoryList.length === 0 ? (
                              "No finished attempts yet."
                            ) : (
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: 18,
                                  listStyle: "disc",
                                }}
                              >
                                {quizHistoryList.map((a) => (
                                  <li key={a.id} style={{ marginBottom: 6 }}>
                                    <button
                                      type="button"
                                      style={{
                                        border:
                                          "1px solid rgba(255,255,255,.12)",
                                        background: "rgba(255,255,255,.04)",
                                        color: "inherit",
                                        borderRadius: 7,
                                        padding: "6px 8px",
                                        fontSize: 11,
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                      }}
                                      onClick={() => {
                                        openQuizAttemptDetail(a);
                                        setMobileMoreOpen(false);
                                      }}
                                    >
                                      {a.score}/{a.totalQuestions}
                                      {a.createdAt
                                        ? ` — ${formatSlideDeckSavedAt(a.createdAt)}`
                                        : ""}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </Fragment>
                    ))
                  )}
                </div>
              </div>

              {/* Highlights */}
              <div className="hl-panel" aria-label="Highlights">
                <div className="hl-head-row">
                  <div className="hl-head">HIGHLIGHTS</div>
                  <button
                    type="button"
                    className="hl-save-btn"
                    title={
                      pendingHighlights.length
                        ? `Save ${pendingHighlights.length} highlight(s) to the server`
                        : "No unsaved highlights"
                    }
                    disabled={
                      pendingHighlights.length === 0 || hlSaving || hlLoading
                    }
                    onClick={() => void flushPendingHighlights()}
                    aria-label="Save highlights"
                  >
                    {hlSaving ? <Spinner size={12} /> : <SaveIco size={14} />}
                  </button>
                </div>
                {pendingHighlights.length > 0 && (
                  <div className="hl-sub">
                    {pendingHighlights.length} unsaved — click save. Leaving
                    this page may prompt you if you have not saved.
                  </div>
                )}
                {hlLoading ? (
                  <div className="hl-empty">
                    <Spinner size={12} /> Loading…
                  </div>
                ) : highlights.length === 0 &&
                  pendingHighlights.length === 0 ? (
                  <div className="hl-empty">
                    Turn on the highlighter, pick a color, select text in the
                    summary, then save here.
                  </div>
                ) : (
                  <>
                    {pendingHighlights.map((p) => (
                      <div
                        key={p.clientId}
                        className="hl-item pending"
                        style={{
                          ["--hl-accent"]:
                            p.color && /^#[0-9a-f]{6}$/i.test(p.color)
                              ? p.color
                              : DEFAULT_HL_HEX,
                        }}
                        onClick={() => {
                          scrollToHighlight(p.clientId);
                          setMobileMoreOpen(false);
                        }}
                        title={p.quote}
                      >
                        <span className="hl-color-dot" />
                        <div className="hl-quote">
                          {p.quote.length > 140
                            ? `${p.quote.slice(0, 140)}…`
                            : p.quote}
                        </div>
                        <button
                          type="button"
                          className="hl-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePendingHighlight(p.clientId);
                          }}
                          aria-label="Remove unsaved highlight"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {highlights.map((h) => (
                      <div
                        key={h.id}
                        className="hl-item"
                        style={{
                          ["--hl-accent"]:
                            h.color && /^#[0-9a-f]{6}$/i.test(h.color)
                              ? h.color
                              : DEFAULT_HL_HEX,
                        }}
                        onClick={() => {
                          scrollToHighlight(h.id);
                          setMobileMoreOpen(false);
                        }}
                        title={h.quote}
                      >
                        <span className="hl-color-dot" />
                        <div className="hl-quote">
                          {h.quote.length > 140
                            ? `${h.quote.slice(0, 140)}…`
                            : h.quote}
                        </div>
                        <button
                          type="button"
                          className="hl-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHighlight(h.id);
                          }}
                          aria-label="Remove highlight"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
