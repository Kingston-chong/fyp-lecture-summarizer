"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Chevron = ({ open }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform .2s",
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const ChevRight = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const DocIco = ({ ext }) => {
  const c =
    {
      PDF: "#f87171",
      PPTX: "#fb923c",
      PPT: "#fb923c",
      DOCX: "#60a5fa",
      DOC: "#60a5fa",
      TXT: "#a3e635",
      XLSX: "#34d399",
    }[ext?.toUpperCase()] || "#c084fc";
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};
const QuizIco = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const PdfIco = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const SlidesIco = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <polygon points="10 8 16 11 10 14 10 8" />
  </svg>
);
const SendIco = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const BotIco = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4M8.5 15h.01M15.5 15h.01" />
  </svg>
);
const UserIco = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);
const CopyIco = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const Spinner = ({ size = 14, color = "white" }) => (
  <div
    style={{
      width: size,
      height: size,
      border: `2px solid rgba(255,255,255,0.2)`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "spin .7s linear infinite",
      flexShrink: 0,
    }}
  />
);

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

const SUGGESTIONS = [
  "Explain 2NF with a real-world example",
  "What problems does BCNF solve?",
  "When should I use denormalization?",
];

const MODELS = ["ChatGPT", "DeepSeek", "Gemini"];
const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";

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
      const roleLabel = isUser ? "You" : escape(summary.model);
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

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sourceInputRef = useRef(null);

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

  // Extract headings from markdown and broadcast for sidebar navigation
  useEffect(() => {
    if (!summary || !summary.output) {
      setHeadings([]);
      setSummaryHtml("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("s2n-summary-headings", { detail: [] }));
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
      window.dispatchEvent(new CustomEvent("s2n-summary-headings", { detail: found }));
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
    setInputVal("");
    setShowSuggest(false);
    setMessages((p) => [...p, { id: Date.now(), role: "user", content: msg }]);
    setChatLoading(true);
    try {
      // TODO: replace with real /api/chat call
      await new Promise((r) => setTimeout(r, 1300));
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content: `This is a placeholder response from ${chatModel}. Connect /api/chat with the summary context to get real answers.`,
        },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content: "Something went wrong — please try again.",
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
      .act-btn { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.04); font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.5); display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all .18s; white-space: nowrap; }
      .act-btn:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.16); color: rgba(255,255,255,.82); transform: translateY(-1px); }
      .act-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
      .act-btn.quiz:hover  { border-color: rgba(251,191,36,.35); color: #fde68a; background: rgba(251,191,36,.07); }
      .act-btn.pdf:hover   { border-color: rgba(248,113,113,.35); color: #fca5a5; background: rgba(248,113,113,.07); }
      .act-btn.slides      { background: linear-gradient(135deg,#5258ee,#8b5cf6); border: none; color: #fff; box-shadow: 0 4px 16px rgba(99,102,241,.32); }
      .act-btn.slides:hover{ box-shadow: 0 6px 22px rgba(99,102,241,.5); }

      /* ── content card ── */
      .card   { flex: 1; min-height: 0; display: flex; flex-direction: column; background: rgba(18,18,28,.88); border: 1px solid rgba(255,255,255,.07); border-radius: 18px; backdrop-filter: blur(14px); overflow: hidden; animation: fadeUp .4s ease both; animation-delay: .05s; }

      /* ── summary pane ── */
      .sum-pane  { flex: 1 1 auto; max-height: none; display: flex; flex-direction: column; border-bottom: 1px solid rgba(255,255,255,.06); min-height: 0; }
      .sum-head  { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 20px 10px; flex-shrink: 0; gap: 12px; }
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
      .sum-date  { font-size: 10.5px; color: rgba(255,255,255,.25); font-style: italic; white-space: nowrap; }
      .sum-files { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
      .fchip     { display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 5px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); font-size: 10px; color: rgba(255,255,255,.3); }

      .sum-body  { overflow-y: auto; padding: 0 20px 14px; flex: 1; }
      .sum-body::-webkit-scrollbar { width: 3px; }
      .sum-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 4px; }
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

      /* ── chat pane ── */
      .chat-pane { flex: 0 0 210px; min-height: 0; display: flex; flex-direction: column; }

      .chat-msgs { flex: 1; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; }
      .chat-msgs::-webkit-scrollbar { width: 3px; }
      .chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 4px; }

      .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: rgba(255,255,255,.18); font-size: 11px; }

      .m-row     { display: flex; gap: 8px; align-items: flex-start; animation: msgIn .22s ease; }
      .m-row.user{ flex-direction: row-reverse; }
      .m-ava     { width: 27px; height: 27px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
      .m-ava.ai  { background: rgba(99,102,241,.18); color: #a5b4fc; border: 1px solid rgba(99,102,241,.18); }
      .m-ava.user{ background: rgba(52,211,153,.14); color: #6ee7b7; border: 1px solid rgba(52,211,153,.18); }
      .m-bub-wrap { position: relative; max-width: 74%; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
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
                <button
                  className="act-btn quiz"
                  onClick={() => alert("Create Quiz — coming soon!")}
                >
                  <QuizIco /> Create quiz!
                </button>
                <button
                  className="act-btn pdf"
                  onClick={handlePDF}
                  disabled={pdfLoading || !summary}
                >
                  {pdfLoading ? <Spinner size={13} /> : <PdfIco />}
                  Save as PDF
                </button>
                <button
                  className="act-btn slides"
                  onClick={() => alert("Generate Slides — coming soon!")}
                >
                  <SlidesIco /> Generate Slides
                </button>
              </div>

              {/* Card: summary + chat */}
              <div className="card">
                {/* Summary pane */}
                <div className="sum-pane">
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
                      <div className="sum-date">
                        {summary
                          ? `generated by ${summary.model} on ${fmtDate(summary.createdAt)}`
                          : summaryLoading
                            ? "Loading..."
                            : "—"}
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
                  <div className="sum-body">
                    {summaryLoading ? (
                      <div className="sum-text">Loading summary...</div>
                    ) : summaryError ? (
                      <div className="sum-text">Error: {summaryError}</div>
                    ) : (
                      <div
                        className="sum-text md"
                        dangerouslySetInnerHTML={{
                          __html:
                            summaryHtml ||
                            markdownToHtml(
                              summary?.output ?? "No summary output found.",
                            ),
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Chat pane */}
                <div className="chat-pane">
                  <div className="chat-msgs">
                    {messages.length === 0 && !chatLoading ? (
                      <div className="chat-empty">
                        <BotIco />
                        <span>Ask anything about this summary</span>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`m-row ${m.role}`}>
                          <div className={`m-ava ${m.role}`}>
                            {m.role === "ai" ? <BotIco /> : <UserIco />}
                          </div>
                          <div className="m-bub-wrap">
                            <div
                              className={`m-bub ${m.role} ${m.error ? "err" : ""} md`}
                              dangerouslySetInnerHTML={{
                                __html: markdownToHtml(m.content),
                              }}
                            />
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
                      ))
                    )}
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
                    <div ref={bottomRef} />
                  </div>

                  {/* Suggested prompts */}
                  {showSuggest && messages.length === 0 && (
                    <div className="suggests">
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
                      disabled={chatLoading || !inputVal.trim()}
                    >
                      {chatLoading ? <Spinner size={14} /> : <SendIco />}
                    </button>
                  </div>
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
    </>
  );
}
