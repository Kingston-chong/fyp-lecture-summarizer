"use client";

import {
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
import GenerateSlidesModal from "@/app/components/GenerateSlidesModal";
import Button from "@/app/components/ui/Button";
import {
  Chevron,
  Spinner,
  SendIco,
  CopyIco,
  HighlightIco,
  SaveIco,
  BotIco,
  UserIco,
  DocIco,
  QuizIco,
  PdfIco,
  SlidesIco,
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

/** Readable text on solid highlight swatch */
function contrastTextOnHighlight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return "#f8fafc";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0c0c14" : "#f8fafc";
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

/** Full-line PDF-style block fill on <mark> (opaque band behind text). */
function applyHighlightBlockStyle(mark, colorHex) {
  const color =
    colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const fill = hexToRgba(color, 0.82);
  mark.style.background = "none";
  mark.style.backgroundColor = fill;
  mark.style.color = contrastTextOnHighlight(color);
  mark.style.boxDecorationBreak = "clone";
  mark.style.webkitBoxDecorationBreak = "clone";
  mark.style.padding = "0.12em 0.14em";
  mark.style.borderRadius = "2px";
}

/** Wrap first occurrence of quote in text nodes; returns true if wrapped */
function wrapQuoteInRoot(root, quote, hlId, colorHex, pending) {
  if (!root || !quote) return false;
  const color = colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    const t = node.textContent ?? "";
    const idx = t.indexOf(quote);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + quote.length);
      const mark = document.createElement("mark");
      mark.className = pending ? "s2n-hl s2n-hl-pending" : "s2n-hl";
      mark.dataset.hlId = String(hlId);
      mark.dataset.hlColor = color;
      applyHighlightBlockStyle(mark, color);
      try {
        range.surroundContents(mark);
        return true;
      } catch {
        return false;
      }
    }
    node = walker.nextNode();
  }
  return false;
}

const SUGGESTIONS = [
  "Explain 2NF with a real-world example",
  "What problems does BCNF solve?",
  "When should I use denormalization?",
];

const MODELS = ["ChatGPT", "DeepSeek", "Gemini"];
const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";
/** Stable object so React does not treat summary body props as changing every render */
const SUMMARY_BODY_INNER_STYLE = { paddingTop: 8 };

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportPDF(summary, messages) {
  const dateStr = fmtDate(summary.createdAt);
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = markdownToHtml(summary.output || "");
  const msgsHtml = messages
    .map((m) => {
      const isUser = m.role === "user";
      const cls = isUser ? "msg-u" : "msg-a";
      const roleLabel = isUser
        ? "You"
        : escape(m.modelLabel || formatSummaryModelLabel(summary.model));
      const contentHtml = markdownToHtml(m.content || "");
      return `<div class="msg ${cls}"><div class="role">${roleLabel}</div>${contentHtml}</div>`;
    })
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escape(summary.title)} — Slide2Notes</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sora',sans-serif;color:#18182a;background:#fff;padding:52px;max-width:780px;margin:0 auto;font-size:13.5px;line-height:1.75}
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
@media print{body{padding:36px}}
</style></head><body>
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
  if (win)
    win.onload = () =>
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 300);
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showSuggest, setShowSuggest] = useState(true);
  const [sourceUploadLoading, setSourceUploadLoading] = useState(false);
  const [extraSources, setExtraSources] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [slidesModal, setSlidesModal] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [pendingHighlights, setPendingHighlights] = useState([]);
  const [hlLoading, setHlLoading] = useState(false);
  const [hlModeActive, setHlModeActive] = useState(false);
  const [hlColorHex, setHlColorHex] = useState(DEFAULT_HL_HEX);
  const [hlColorMenuOpen, setHlColorMenuOpen] = useState(false);
  const [hlSaving, setHlSaving] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sourceInputRef = useRef(null);
  const summaryBodyRef = useRef(null);
  const hlToolbarRef = useRef(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status]);
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

  useEffect(() => {
    if (status !== "authenticated" || !summaryId) return;
    let cancelled = false;
    async function loadHl() {
      setHlLoading(true);
      try {
        const res = await fetch(`/api/summary/${summaryId}/highlights`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load highlights");
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
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  async function sendMessage(text) {
    const msg = (text ?? inputVal).trim();
    if (!msg || chatLoading) return;
    if (!summary?.output) return;
    setInputVal("");
    setShowSuggest(false);
    const userMsg = { id: Date.now(), role: "user", content: msg };
    const historyPayload = [...messages, userMsg].map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.content,
    }));
    const modelParam =
      chatModel === "DeepSeek"
        ? "deepseek"
        : chatModel === "Gemini"
          ? "gemini"
          : "chatgpt";
    setMessages((p) => [...p, userMsg]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: Number(summaryId),
          model: modelParam,
          messages: historyPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Chat request failed");
      }
      const reply = (data?.reply || "").trim();
      if (!reply) throw new Error("Empty reply from assistant");
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content: reply,
          modelLabel: chatModel,
        },
      ]);
    } catch (e) {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content: e?.message ?? "Something went wrong — please try again.",
          error: true,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handlePDF() {
    if (!summary) return;
    setPdfLoading(true);
    exportPDF(summary, messages);
    setTimeout(() => setPdfLoading(false), 900);
  }

  const handleSummaryMouseUp = useCallback(() => {
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
            ? (queue.length === 1
                ? "Could not save the highlight. Please try again."
                : "Could not save highlights. Please try again.")
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
      const res = await fetch(
        `/api/summary/${summaryId}/highlights/${hid}`,
        { method: "DELETE" },
      );
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
      typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
    const el = document.querySelector(`mark.s2n-hl[data-hl-id="${safe}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const summaryBodyDangerousHtml = useMemo(() => {
    const raw =
      summaryHtml ||
      markdownToHtml(summary?.output ?? "No summary output found.");
    return { __html: raw };
  }, [summaryHtml, summary?.output]);

  async function handleSourceUpload(files) {
    if (!files || !files.length) return;
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    setSourceUploadLoading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      const docs = data.documents || [];
      setExtraSources((prev) => [...prev, ...docs]);
    } catch (e) {
      console.error(e);
      alert("Failed to upload sources. Please try again.");
    } finally {
      setSourceUploadLoading(false);
    }
  }

  return (
    <>
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; background: #0c0c14; }
      @keyframes spin   { to { transform: rotate(360deg); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes msgIn  { from { opacity: 0; transform: translateY(5px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes blink  { 0%,80%,100% { transform: scale(0); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }

      .wrap   { height: 100%; display: flex; flex-direction: column; background: #0c0c14; font-family: 'Sora', sans-serif; overflow: hidden; }

      /* ── atmosphere ── */
      .atm    { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
      .atm-a  { position: absolute; top: -15%; right: -8%; width: 560px; height: 560px; background: radial-gradient(circle, rgba(99,102,241,.11) 0%, transparent 65%); }
      .atm-b  { position: absolute; bottom: -12%; left: 5%;  width: 440px; height: 440px; background: radial-gradient(circle, rgba(20,184,166,.07) 0%, transparent 65%); }

      /* ── body ── */
      .body   { display: flex; flex: 1; overflow: hidden; position: relative; z-index: 5; }

      /* ── main area + sources panel ── */
      .main-wrap { flex: 1; display: flex; min-width: 0; }
      .main   { flex: 1; display: flex; flex-direction: column; padding: 14px; gap: 10px; overflow: hidden; min-width: 0; }

      .sources {
        width: 260px;
        flex-shrink: 0;
        border-left: 1px solid rgba(255,255,255,.07);
        background: rgba(12,12,20,.96);
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
        flex: 1;
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
        border-left: 3px solid var(--hl-accent, #fef08a);
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
      .act-bar { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-shrink: 0; animation: fadeUp .35s ease both; }

      /* ── content card ── */
      .card   { flex: 1; min-height: 0; display: flex; flex-direction: column; background: rgba(18,18,28,.88); border: 1px solid rgba(255,255,255,.07); border-radius: 18px; backdrop-filter: blur(14px); overflow: hidden; animation: fadeUp .4s ease both; animation-delay: .05s; }

      /* ── summary + chat: one continuous scroll ── */
      .sum-head  { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 20px 10px; flex-shrink: 0; gap: 12px; border-bottom: 1px solid rgba(255,255,255,.06); }
      .sum-left  { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .sum-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: #ddddf5; letter-spacing: -.01em; }
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
        height: 28px; width: 34px; padding: 0; border-radius: 7px 0 0 7px;
        border: 1px solid rgba(255,255,255,.08); border-right: none;
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.5);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: all .18s;
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
      .conv-label { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.28); margin-bottom: 12px; }
      .chat-hint { font-size: 11.5px; color: rgba(255,255,255,.22); font-style: italic; margin-top: 10px; padding-bottom: 4px; }
      .sum-text  { font-size: 13.5px; font-weight: 400; color: #c8c8e0; line-height: 1.8; font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .sum-text h1 { font-size: 1.5em; font-weight: 700; color: #e8e8f5; margin: 0 0 14px; line-height: 1.35; letter-spacing: -0.01em; }
      .sum-text h2 { font-size: 1.22em; font-weight: 600; color: #ddddf0; margin: 20px 0 10px; line-height: 1.4; }
      .sum-text h3 { font-size: 1.08em; font-weight: 600; color: #d0d0e8; margin: 16px 0 8px; line-height: 1.45; }
      .sum-text h4, .sum-text h5, .sum-text h6 { font-size: 1em; font-weight: 600; color: #c8c8e0; margin: 12px 0 6px; }
      .sum-text ol, .sum-text ul { margin: 12px 0 14px 22px; padding-left: 8px; }
      .sum-text ol { list-style: decimal; }
      .sum-text ul { list-style-type: disc; }
      .sum-text ul ul { list-style-type: disc; }
      .sum-text ol li, .sum-text ul li { margin: 6px 0; }
      .sum-text table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
      .sum-text th, .sum-text td { border: 1px solid rgba(255,255,255,0.14); padding: 10px 14px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .sum-text th { background: rgba(255,255,255,0.08); font-weight: 600; color: #e0e0f0; }
      .sum-text td { color: #b8b8d4; line-height: 1.6; }

      .sum-selectable ::selection { background: rgba(99,102,241,.35); color: #f0f0ff; }
      .hl-select-ctx.hl-mode-active .sum-selectable ::selection {
        background: color-mix(in srgb, var(--hl-pick, #fef08a) 72%, transparent);
        color: inherit;
      }
      .sum-gen-meta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,.06);
        font-size: 10.5px;
        font-style: italic;
        color: rgba(255,255,255,.28);
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
      .m-bub     { width: 100%; padding: 9px 13px; border-radius: 12px; font-size: 12.5px; font-weight: 300; line-height: 1.68; }
      .m-bub.ai  { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); color: #c4c4dc; border-top-left-radius: 3px; }
      .m-bub.user{ background: rgba(99,102,241,.18); border: 1px solid rgba(99,102,241,.25); color: #ddddf8; border-top-right-radius: 3px; }
      .m-bub.err { background: rgba(248,113,113,.08); border-color: rgba(248,113,113,.2); color: #fca5a5; }
      .m-copy {
        width: 26px; height: 26px; border-radius: 6px; border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04); color: rgba(255,255,255,.5); display: flex;
        align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        transition: all .18s;
      }
      .m-copy:hover { background: rgba(255,255,255,.08); color: #a5b4fc; border-color: rgba(99,102,241,.3); }
      .m-copy.copied { background: rgba(52,211,153,.12); border-color: rgba(52,211,153,.3); color: #6ee7b7; }
      .m-copy-txt { font-size: 10px; font-weight: 600; }

      /* markdown-ish rendering (summary + chat) */
      .md p, .sum-text p { margin: 0 0 12px; }
      .md p:last-child, .sum-text p:last-child { margin-bottom: 0; }
      .md ul, .md ol { margin: 12px 0 14px 22px; padding-left: 8px; }
      .md ol { list-style: decimal; }
      .md ul { list-style-type: disc; }
      .md ul ul { list-style-type: disc; }
      .md li { margin: 6px 0; }
      .md h1, .md h2, .md h3, .md h4, .md h5, .md h6 { font-weight: 600; margin: 12px 0 6px; }
      .md h1 { font-size: 1.25em; }
      .md h2 { font-size: 1.12em; }
      .md h3 { font-size: 1.06em; }
      .md table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
      .md th, .md td { border: 1px solid rgba(255,255,255,0.14); padding: 8px 12px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .md th { background: rgba(255,255,255,0.08); font-weight: 600; color: #e0e0f0; }
      .md td { line-height: 1.6; }
      .md code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.95em; background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 6px; }
      .md pre { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); padding: 10px 12px; border-radius: 10px; overflow: auto; margin: 10px 0; }
      .md pre code { background: transparent; padding: 0; }

      .dots { display: flex; gap: 4px; padding: 3px 0; align-items: center; }
      .dot  { width: 6px; height: 6px; border-radius: 50%; background: rgba(165,180,252,.5); animation: blink 1.3s ease infinite; }
      .dot:nth-child(2) { animation-delay: .22s; }
      .dot:nth-child(3) { animation-delay: .44s; }

      /* ── suggestions ── */
      .suggests { padding: 0 20px 8px; display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
      .sug      { padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,.08); background: transparent; font-family: 'Sora',sans-serif; font-size: 11px; color: rgba(255,255,255,.38); cursor: pointer; transition: all .18s; white-space: nowrap; }
      .sug:hover{ border-color: rgba(99,102,241,.4); color: #a5b4fc; background: rgba(99,102,241,.07); }

      /* ── input row ── */
      .inp-row  { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.06); flex-shrink: 0; }
      .inp      { flex: 1; height: 40px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 0 14px; font-family: 'Sora',sans-serif; font-size: 12.5px; font-weight: 300; color: #cccce0; outline: none; transition: border-color .2s, box-shadow .2s; }
      .inp::placeholder { color: rgba(255,255,255,.2); font-style: italic; }
      .inp:focus{ border-color: rgba(99,102,241,.4); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
      .inp:disabled { opacity: .5; }

      .mdl-wrap { position: relative; flex-shrink: 0; }
      .mdl-btn  { height: 40px; padding: 0 11px; border-radius: 9px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.48); display: flex; align-items: center; gap: 5px; cursor: pointer; transition: all .18s; white-space: nowrap; }
      .mdl-btn:hover, .mdl-btn.open { border-color: rgba(99,102,241,.38); color: #a5b4fc; background: rgba(99,102,241,.08); }
      .mdl-menu { position: absolute; bottom: calc(100% + 5px); right: 0; min-width: 130px; background: rgba(20,20,32,.98); border: 1px solid rgba(255,255,255,.1); border-radius: 11px; padding: 4px; z-index: 50; box-shadow: 0 -18px 40px rgba(0,0,0,.55); animation: fadeUp .14s ease; }
      .mdl-opt  { padding: 7px 10px; border-radius: 7px; cursor: pointer; font-size: 12px; color: #b0b0cc; display: flex; align-items: center; justify-content: space-between; transition: background .14s; }
      .mdl-opt:hover { background: rgba(99,102,241,.1); }
      .mdl-opt.on    { background: rgba(99,102,241,.18); color: #a5b4fc; font-weight: 500; }

      .send-btn { width: 40px; height: 40px; border-radius: 10px; border: none; background: linear-gradient(135deg,#5258ee,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: transform .15s, box-shadow .18s, opacity .18s; box-shadow: 0 3px 12px rgba(99,102,241,.38); }
      .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,.55); }
      .send-btn:disabled { opacity: .38; cursor: not-allowed; transform: none; }

      /* ── mobile: summary + conversation ── */
      @media (max-width: 1023px) {
        .wrap {
          overflow-x: hidden;
          min-height: calc(100dvh - var(--chrome-h, 98px));
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
          min-height: 0;
        }
        .sources {
          width: 100%;
          max-height: min(38vh, 260px);
          flex-shrink: 0;
          border-left: none;
          border-top: 1px solid rgba(255,255,255,.07);
        }
        .act-bar {
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 6px;
        }
        .act-bar button {
          white-space: normal;
          text-align: center;
          line-height: 1.25;
          padding: 7px 10px;
          height: auto;
          min-height: 32px;
        }
        .card { border-radius: 14px; }
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
          flex-wrap: wrap;
          width: 100%;
          justify-content: flex-start;
        }
        .sum-files {
          justify-content: flex-start;
        }
        .fchip {
          max-width: 100%;
          min-width: 0;
        }
        .unified-scroll {
          padding: 0 12px 10px;
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
        .sug {
          white-space: normal;
          text-align: left;
          line-height: 1.35;
        }
        .inp-row {
          flex-wrap: wrap;
          align-items: stretch;
          padding: 8px 10px;
          gap: 8px;
        }
        .inp-row .inp {
          flex: 1 1 100%;
          min-width: 0;
          height: 42px;
        }
        .inp-row .mdl-wrap {
          flex: 1 1 auto;
          min-width: 0;
        }
        .inp-row .mdl-btn {
          width: 100%;
          justify-content: space-between;
        }
        .inp-row .send-btn {
          flex-shrink: 0;
        }
        .sum-hl-menu {
          left: 0;
          right: auto;
        }
      }
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
                <Button
                  variant="quiz"
                  onClick={() => alert("Create Quiz — coming soon!")}
                >
                  <QuizIco /> Create quiz!
                </Button>
                <Button
                  variant="pdf"
                  onClick={handlePDF}
                  disabled={pdfLoading || !summary}
                >
                  {pdfLoading ? <Spinner size={13} /> : <PdfIco />}
                  Save as PDF
                </Button>
                <Button
                  variant="slides"
                  onClick={() => setSlidesModal(true)}
                >
                  <SlidesIco /> Generate Slides
                </Button>
              </div>

              {/* Card: summary + chat */}
              <div className="card">
                <div className="sum-head">
                  <div className="sum-left">
                    <div className="sum-title">Your summarized content</div>
                    <div className="sum-tags">
                      <span className="tag tag-m">
                        {summary?.model ?? "—"}
                      </span>
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
                              ? "Highlighter on — select text (saved with sidebar save)"
                              : "Turn on highlighter"
                          }
                          aria-pressed={hlModeActive}
                          aria-label="Toggle highlighter mode"
                          disabled={summaryLoading || !summary?.output}
                          onClick={() => {
                            setHlModeActive((v) => !v);
                            setHlColorMenuOpen(false);
                          }}
                        >
                          <HighlightIco size={13} />
                        </button>
                        <button
                          type="button"
                          className={`sum-hl-chevron ${hlColorMenuOpen ? "open" : ""}`}
                          title="Highlight color"
                          aria-expanded={hlColorMenuOpen}
                          aria-haspopup="true"
                          disabled={summaryLoading || !summary?.output}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setHlColorMenuOpen((v) => !v)}
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
                      <div className="conv-label">Continue the conversation</div>
                      <div className="chat-thread">
                        {messages.map((m) => (
                          <div key={m.id} className={`m-row ${m.role}`}>
                            <div className={`m-ava ${m.role}`}>
                              {m.role === "ai" ? <BotIco /> : <UserIco />}
                            </div>
                            <div className="m-bub-wrap">
                              <div className="m-bub-col">
                                <div
                                  className={`m-bub ${m.role} ${m.error ? "err" : ""} md`}
                                  dangerouslySetInnerHTML={{
                                    __html: markdownToHtml(m.content),
                                  }}
                                />
                                {m.role === "ai" &&
                                  m.modelLabel &&
                                  !m.error && (
                                    <div className="m-meta">
                                      Generated by {m.modelLabel}
                                    </div>
                                  )}
                              </div>
                              {m.role === "ai" && (m.content || "").trim() && (
                                <button
                                  type="button"
                                  className={`m-copy ${copiedId === m.id ? "copied" : ""}`}
                                  title={copiedId === m.id ? "Copied!" : "Copy"}
                                  onClick={() => handleCopyMessage(m)}
                                  aria-label="Copy message"
                                >
                                  {copiedId === m.id ? (
                                    <span className="m-copy-txt">Copied</span>
                                  ) : (
                                    <CopyIco size={12} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
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
                          <span>Continue below — your replies stay in this thread with the summary above.</span>
                        </div>
                      </div>
                    </>
                  )}

                  {showSuggest && messages.length === 0 && (
                    <div className="suggests" style={{ paddingLeft: 0, paddingRight: 0 }}>
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          className="sug"
                          onClick={() => sendMessage(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="inp-row">
                    <input
                      ref={inputRef}
                      className="inp"
                      placeholder="Refine your summary or ask question..."
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !e.shiftKey && sendMessage()
                      }
                      disabled={chatLoading}
                    />
                    <div className="mdl-wrap">
                      <button
                        className={`mdl-btn ${modelOpen ? "open" : ""}`}
                        onClick={() => setModelOpen((v) => !v)}
                        onBlur={() =>
                          setTimeout(() => setModelOpen(false), 150)
                        }
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
                    <button
                      className="send-btn"
                      onClick={() => sendMessage()}
                      disabled={
                        chatLoading || !inputVal.trim() || !summary?.output
                      }
                    >
                      {chatLoading ? <Spinner size={14} /> : <SendIco />}
                    </button>
                  </div>
              </div>
              {/* /card */}
            </main>

            {/* Sources panel (NotebookLM style) */}
            <aside className="sources" aria-label="Sources">
              <input
                ref={sourceInputRef}
                type="file"
                multiple
                accept={ACCEPTED}
                style={{ display: "none" }}
                onChange={(e) => {
                  handleSourceUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="src-header">
                <span className="src-title">Sources</span>
                <button
                  type="button"
                  className="src-add-btn"
                  onClick={() => sourceInputRef.current?.click()}
                  disabled={sourceUploadLoading}
                >
                  {sourceUploadLoading ? (
                    <>
                      <Spinner size={10} />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      +<span>Add sources</span>
                    </>
                  )}
                </button>
              </div>
              <div className="hl-panel" aria-label="Highlights">
                <div className="hl-head-row">
                  <div className="hl-head">Highlights</div>
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
                    {pendingHighlights.length} unsaved — click save. Leaving this
                    page may prompt you if you have not saved.
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
            </aside>
          </div>
        </div>
      </div>
      {slidesModal && <GenerateSlidesModal onClose={() => setSlidesModal(false)} />}
    </>
  );
}
