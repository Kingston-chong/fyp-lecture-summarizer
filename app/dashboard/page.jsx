"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ── Icons ──────────────────────────────────────────────────
const SlidesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
);
const UserCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
  </svg>
);
const ChevronDown = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const FileIcon = ({ type }) => {
  const colors = { PDF: "#f87171", PPTX: "#fb923c", PPT: "#fb923c", DOCX: "#60a5fa", DOC: "#60a5fa", TXT: "#a3e635", MD: "#a3e635", XLSX: "#34d399", XLS: "#34d399", CSV: "#34d399", default: "#c084fc" };
  const c = colors[type?.toUpperCase()] || colors.default;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
};
const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
    <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>
  </svg>
);
const HistoryIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.96"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const MODELS = [
  { id: "chatgpt", label: "ChatGPT", sub: "GPT-4o" },
  { id: "deepseek", label: "DeepSeek", sub: "V3" },
  { id: "gemini", label: "Gemini", sub: "1.5 Pro" },
];
const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

// ── Main Component ─────────────────────────────────────────
export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [selectedFiles, setSelectedFiles]   = useState([]);  // {name, type, size, id?, file?, fromPrev?}
  const [prompt, setPrompt]                 = useState("");
  const [summarizeFor, setSummarizeFor]     = useState("lecturer");
  const [model, setModel]                   = useState("chatgpt");
  const [modelOpen, setModelOpen]           = useState(false);
  const [dragging, setDragging]             = useState(false);
  const [loading, setLoading]               = useState(false);  // summarizing
  const [uploading, setUploading]           = useState(false);  // uploading files
  const [summaryOutput, setSummaryOutput]   = useState(null);   // latest result
  const [copied, setCopied]                 = useState(false);

  // Sidebar data (from APIs)
  const [history, setHistory]               = useState([]);
  const [prevUploads, setPrevUploads]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [prevLoading, setPrevLoading]       = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [sidebarSection, setSidebarSection] = useState({ history: true, prev: true });

  const [error, setError] = useState("");
  const fileInputRef = useRef();

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status]);

  // ── Fetch history & previous uploads on mount ──────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (res.ok) setHistory(data.summaries || []);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  const fetchPrevUploads = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok) setPrevUploads(data.documents || []);
    } catch { /* silent */ }
    finally { setPrevLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchHistory();
      fetchPrevUploads();
    }
  }, [status]);

  // ── File helpers ───────────────────────────────────────
  function getExt(name) { return name.split(".").pop().toUpperCase(); }

  function addLocalFiles(newFiles) {
    const arr = Array.from(newFiles).map(f => ({
      file: f,
      name: f.name,
      type: getExt(f.name),
      size: formatBytes(f.size),
      fromPrev: false,
    }));
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
  }

  function addPrevFile(doc) {
    if (selectedFiles.find(f => f.name === doc.name)) return;
    setSelectedFiles(prev => [...prev, {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: formatBytes(doc.size),
      fromPrev: true,
    }]);
  }

  // ── Upload files to Vercel Blob via API ────────────────
  async function uploadNewFiles() {
    const newFiles = selectedFiles.filter(f => !f.fromPrev && f.file);
    if (newFiles.length === 0) return [];

    setUploading(true);
    const formData = new FormData();
    newFiles.forEach(f => formData.append("files", f.file));

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) throw new Error(data.error || "Upload failed");

    // Refresh prev uploads sidebar
    fetchPrevUploads();

    return data.documents; // [{id, name, type, ...}]
  }

  // ── Summarize ──────────────────────────────────────────
  async function handleSummarize() {
    if (!selectedFiles.length) return;
    setError("");
    setLoading(true);
    setSummaryOutput(null);

    try {
      // 1. Upload any new (non-prev) files first
      let uploadedDocs = [];
      try {
        uploadedDocs = await uploadNewFiles();
      } catch (err) {
        setError("File upload failed: " + err.message);
        setLoading(false);
        return;
      }

      // 2. Collect all document IDs
      // - prev files already have an ID
      // - newly uploaded files get IDs from upload response
      const prevIds = selectedFiles.filter(f => f.fromPrev && f.id).map(f => f.id);
      const newIds  = uploadedDocs.map(d => d.id);
      const documentIds = [...prevIds, ...newIds];

      if (documentIds.length === 0) {
        setError("No documents could be processed.");
        setLoading(false);
        return;
      }

      // 3. Call summarize API
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds, model, summarizeFor, prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Summarization failed");

      // 4. Show output and refresh history
      setSummaryOutput(data.summary);
      fetchHistory();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!summaryOutput) return;
    navigator.clipboard.writeText(summaryOutput.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedModel = MODELS.find(m => m.id === model);

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0e0e12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; }

        .app { min-height: 100vh; background: #0e0e12; font-family: 'Sora', sans-serif; display: flex; flex-direction: column; }
        .blob1 { position: fixed; top: -10%; right: -5%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 65%); pointer-events: none; z-index: 0; }
        .blob2 { position: fixed; bottom: -10%; left: 10%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 65%); pointer-events: none; z-index: 0; }

        .navbar { position: relative; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 58px; background: rgba(14,14,18,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.055); flex-shrink: 0; }
        .navbar-logo { display: flex; align-items: center; gap: 9px; }
        .logo-badge { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
        .logo-text { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; background: linear-gradient(90deg, #e8e8f0, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .navbar-right { display: flex; align-items: center; gap: 10px; }
        .navbar-user-info { font-size: 12px; color: rgba(255,255,255,0.35); }
        .navbar-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 12px; color: rgba(255,255,255,0.4); transition: all 0.2s; }
        .navbar-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }

        .subnav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: flex-end; padding: 0 28px; height: 40px; background: rgba(16,16,22,0.8); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.035); flex-shrink: 0; }
        .subnav-item { display: flex; align-items: center; gap: 4px; padding: 0 14px; height: 40px; font-size: 12px; color: #52526e; cursor: pointer; border: none; background: none; font-family: 'Sora', sans-serif; transition: color 0.2s; }
        .subnav-item:hover { color: #9090b8; }

        .body { display: flex; flex: 1; position: relative; z-index: 5; height: calc(100vh - 98px); overflow: hidden; }

        /* SIDEBAR */
        .sidebar { width: 220px; flex-shrink: 0; background: rgba(16,16,22,0.85); border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; overflow-y: auto; }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 6px; cursor: pointer; user-select: none; }
        .sidebar-title { font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .sidebar-chev { color: rgba(255,255,255,0.2); transition: transform 0.2s; }
        .sidebar-chev.open { transform: rotate(180deg); }
        .sidebar-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 6px 16px; }

        .history-item { padding: 8px 16px; cursor: pointer; transition: background 0.15s; position: relative; border-left: 2px solid transparent; }
        .history-item:hover { background: rgba(255,255,255,0.03); }
        .history-item.active { background: rgba(99,102,241,0.08); border-left-color: #6366f1; }
        .history-name { font-size: 12px; font-weight: 500; color: #b8b8d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .history-meta { font-size: 10.5px; color: rgba(255,255,255,0.22); margin-top: 2px; }
        .history-file-chip { display: flex; align-items: center; gap: 5px; padding: 3px 16px 3px 28px; font-size: 10.5px; color: rgba(255,255,255,0.22); }

        .prev-item { display: flex; align-items: center; gap: 8px; padding: 6px 16px; cursor: pointer; transition: background 0.15s; }
        .prev-item:hover { background: rgba(255,255,255,0.03); }
        .prev-info { flex: 1; min-width: 0; }
        .prev-name { font-size: 11.5px; font-weight: 500; color: #a8a8c0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .prev-meta { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .prev-add { width: 20px; height: 20px; border-radius: 5px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; color: #a5b4fc; font-size: 13px; flex-shrink: 0; transition: all 0.15s; }
        .prev-item:hover .prev-add { background: rgba(99,102,241,0.25); }
        .prev-add.added { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.3); color: #34d399; }

        .sidebar-empty { padding: 12px 16px; font-size: 11px; color: rgba(255,255,255,0.18); font-style: italic; }
        .sidebar-loading { padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.2); }
        .mini-spinner { width: 12px; height: 12px; border: 1.5px solid rgba(255,255,255,0.15); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }

        /* MAIN */
        .main { flex: 1; display: grid; grid-template-columns: 1fr 1fr 272px; gap: 14px; padding: 16px; overflow-y: auto; align-content: start; }
        .main::-webkit-scrollbar { width: 3px; }
        .main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .panel { background: rgba(20,20,30,0.85); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 18px; backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 12px; }
        .panel-title { font-family: 'Fraunces', serif; font-size: 14.5px; font-weight: 600; color: #ddddf0; }
        .panel-sub { font-size: 11px; color: rgba(255,255,255,0.28); margin-top: -6px; }

        .drop-zone { border: 1.5px dashed rgba(99,102,241,0.22); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(99,102,241,0.02); }
        .drop-zone:hover, .drop-zone.dragging { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.07); }
        .drop-zone-text { font-size: 11.5px; color: rgba(255,255,255,0.28); margin-top: 6px; }
        .drop-zone-link { color: #8080f8; }

        .file-list { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; max-height: 230px; }
        .file-list::-webkit-scrollbar { width: 3px; }
        .file-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .file-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .file-name { font-size: 12px; font-weight: 500; color: #c0c0da; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-size { font-size: 10.5px; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .file-badge { font-size: 9px; font-weight: 600; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); letter-spacing: 0.03em; flex-shrink: 0; }
        .file-prev-tag { font-size: 9.5px; color: rgba(99,102,241,0.7); margin-top: 1px; }
        .file-remove { width: 20px; height: 20px; border-radius: 5px; border: none; background: rgba(248,113,113,0.08); color: #f87171; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
        .file-remove:hover { background: rgba(248,113,113,0.22); }

        .formats-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .fmt-chip { font-size: 9.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.06); }

        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: rgba(255,255,255,0.14); font-size: 11.5px; padding: 24px 0; text-align: center; }

        .prompt-area { flex: 1; resize: none; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px; font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 300; color: #c0c0d8; outline: none; transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.65; min-height: 180px; }
        .prompt-area::placeholder { color: rgba(255,255,255,0.15); font-style: italic; }
        .prompt-area:focus { border-color: rgba(99,102,241,0.4); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .prompt-count { font-size: 10.5px; color: rgba(255,255,255,0.18); }

        /* OUTPUT PANEL */
        .output-area { flex: 1; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; overflow-y: auto; max-height: 300px; }
        .output-area::-webkit-scrollbar { width: 3px; }
        .output-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .output-text { font-size: 12.5px; font-weight: 300; color: #c8c8e0; line-height: 1.75; white-space: pre-wrap; }
        .output-placeholder { font-size: 12px; color: rgba(255,255,255,0.16); font-style: italic; }
        .output-header { display: flex; align-items: center; justify-content: space-between; }
        .copy-btn { height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-family: 'Sora', sans-serif; font-size: 11px; color: rgba(255,255,255,0.4); cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s; }
        .copy-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
        .copy-btn.copied { border-color: rgba(52,211,153,0.3); color: #34d399; background: rgba(52,211,153,0.08); }

        /* RIGHT PANEL */
        .upload-btn { width: 100%; height: 38px; border-radius: 9px; border: 1.5px dashed rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 500; color: #a5b4fc; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: all 0.2s; }
        .upload-btn:hover { border-color: rgba(99,102,241,0.55); background: rgba(99,102,241,0.1); }
        .upload-hint { font-size: 10.5px; color: rgba(255,255,255,0.2); text-align: center; }

        .radio-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
        .radio-option { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; padding: 8px 10px; border-radius: 9px; border: 1px solid transparent; transition: all 0.2s; }
        .radio-option:hover { background: rgba(255,255,255,0.03); }
        .radio-option.selected { background: rgba(99,102,241,0.07); border-color: rgba(99,102,241,0.18); }
        .radio-dot { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; transition: border-color 0.2s; }
        .radio-dot.on { border-color: #6366f1; }
        .radio-dot.on::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #6366f1; }
        .radio-title { font-size: 12px; font-weight: 500; color: #b8b8d0; }
        .radio-sub { font-size: 10.5px; color: rgba(255,255,255,0.25); margin-top: 1px; }

        .model-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
        .model-wrap { position: relative; }
        .model-btn { width: 100%; height: 40px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 500; color: #c0c0e0; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; }
        .model-btn:hover, .model-btn.open { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.06); }
        .model-left { display: flex; align-items: center; gap: 8px; }
        .model-dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .model-sub { font-size: 10.5px; color: rgba(255,255,255,0.28); font-weight: 300; }
        .model-menu { position: absolute; top: calc(100% + 5px); left: 0; right: 0; background: rgba(22,22,32,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 4px; z-index: 50; box-shadow: 0 16px 36px rgba(0,0,0,0.5); animation: menuIn 0.14s ease; }
        @keyframes menuIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .model-opt { padding: 8px 10px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.14s; }
        .model-opt:hover { background: rgba(99,102,241,0.1); }
        .model-opt.on { background: rgba(99,102,241,0.16); }
        .model-opt-name { font-size: 12.5px; font-weight: 500; color: #c0c0e0; }
        .model-opt-sub { font-size: 10.5px; color: rgba(255,255,255,0.28); }
        .model-check { color: #a5b4fc; font-size: 11px; }

        .error-box { padding: 10px 12px; border-radius: 8px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); font-size: 12px; color: #fca5a5; }

        .summarize-btn { width: 100%; height: 44px; border-radius: 10px; border: none; background: linear-gradient(135deg, #5f60f0, #8b5cf6); font-family: 'Sora', sans-serif; font-size: 13.5px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s; box-shadow: 0 4px 16px rgba(99,102,241,0.35); position: relative; overflow: hidden; margin-top: auto; }
        .summarize-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 55%); opacity: 0; transition: opacity 0.2s; }
        .summarize-btn:hover:not(:disabled)::after { opacity: 1; }
        .summarize-btn:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 22px rgba(99,102,241,0.48); }
        .summarize-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .status-badge { font-size: 10.5px; padding: 2px 8px; border-radius: 5px; font-weight: 500; }
        .badge-lecturer { background: rgba(99,102,241,0.15); color: #a5b4fc; }
        .badge-student { background: rgba(52,211,153,0.12); color: #6ee7b7; }
        .badge-model { background: rgba(251,146,60,0.12); color: #fdba74; margin-left: 4px; }
      `}</style>

      <div className="app">
        <div className="blob1" /><div className="blob2" />

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="navbar-logo">
            <div className="logo-badge"><SlidesIcon /></div>
            <span className="logo-text">Slide2Notes</span>
          </div>
          <div className="navbar-right">
            {session?.user?.name && (
              <span className="navbar-user-info">Hi, {session.user.name.split(" ")[0]}</span>
            )}
            <button className="navbar-btn" onClick={() => { import("next-auth/react").then(m => m.signOut({ callbackUrl: "/" })); }}>
              <LogoutIcon /> Sign out
            </button>
          </div>
        </nav>

        {/* SUBNAV */}
        <div className="subnav">
          <button className="subnav-item">Text 1 <ChevronDown /></button>
          <button className="subnav-item">Text 2 <ChevronDown /></button>
        </div>

        <div className="body">

          {/* ── SIDEBAR ── */}
          <aside className="sidebar">

            {/* History */}
            <div className="sidebar-header" onClick={() => setSidebarSection(s => ({ ...s, history: !s.history }))}>
              <span className="sidebar-title"><HistoryIcon /> History</span>
              <span className={`sidebar-chev ${sidebarSection.history ? "open" : ""}`}><ChevronDown /></span>
            </div>

            {sidebarSection.history && (
              historyLoading ? (
                <div className="sidebar-loading"><div className="mini-spinner" /> Loading...</div>
              ) : history.length === 0 ? (
                <div className="sidebar-empty">No summaries yet</div>
              ) : history.map(h => (
                <div key={h.id}>
                  <div
                    className={`history-item ${expandedHistory === h.id ? "active" : ""}`}
                    onClick={() => {
                      setExpandedHistory(expandedHistory === h.id ? null : h.id);
                      setSummaryOutput(h); // show this summary in output panel
                    }}
                  >
                    <div className="history-name">{h.title}</div>
                    <div className="history-meta">
                      {h.files.length} file{h.files.length !== 1 ? "s" : ""} · {timeAgo(h.createdAt)}
                    </div>
                  </div>
                  {expandedHistory === h.id && h.files.map(f => (
                    <div className="history-file-chip" key={f.id}>
                      <FileIcon type={f.type} />
                      {f.name}
                    </div>
                  ))}
                </div>
              ))
            )}

            <div className="sidebar-divider" />

            {/* Previous Uploads */}
            <div className="sidebar-header" onClick={() => setSidebarSection(s => ({ ...s, prev: !s.prev }))}>
              <span className="sidebar-title"><UploadIcon /> Previous Uploaded</span>
              <span className={`sidebar-chev ${sidebarSection.prev ? "open" : ""}`}><ChevronDown /></span>
            </div>

            {sidebarSection.prev && (
              prevLoading ? (
                <div className="sidebar-loading"><div className="mini-spinner" /> Loading...</div>
              ) : prevUploads.length === 0 ? (
                <div className="sidebar-empty">No uploads yet</div>
              ) : prevUploads.map(doc => {
                const isAdded = selectedFiles.some(f => f.name === doc.name);
                return (
                  <div className="prev-item" key={doc.id} onClick={() => addPrevFile(doc)}>
                    <FileIcon type={doc.type} />
                    <div className="prev-info">
                      <div className="prev-name">{doc.name}</div>
                      <div className="prev-meta">{formatBytes(doc.size)} · {timeAgo(doc.createdAt)}</div>
                    </div>
                    <div className={`prev-add ${isAdded ? "added" : ""}`}>{isAdded ? "✓" : "+"}</div>
                  </div>
                );
              })
            )}
          </aside>

          {/* ── MAIN GRID ── */}
          <main className="main">

            {/* Panel 1 — Files */}
            <div className="panel"
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addLocalFiles(e.dataTransfer.files); }}
            >
              <div>
                <div className="panel-title">Uploaded / Selected Files</div>
                <div className="panel-sub">{selectedFiles.length} document{selectedFiles.length !== 1 ? "s" : ""} selected</div>
              </div>

              <div className={`drop-zone ${dragging ? "dragging" : ""}`} onClick={() => fileInputRef.current?.click()}>
                <UploadIcon />
                <div className="drop-zone-text">Drop files or <span className="drop-zone-link">browse</span></div>
                <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} style={{ display: "none" }}
                  onChange={e => { addLocalFiles(e.target.files); e.target.value = ""; }} />
              </div>

              <div className="formats-row">
                {["PDF","PPTX","DOCX","TXT","XLSX","CSV","MD"].map(f => (
                  <span key={f} className="fmt-chip">{f}</span>
                ))}
              </div>

              {selectedFiles.length > 0 ? (
                <div className="file-list">
                  {selectedFiles.map(f => (
                    <div className="file-item" key={f.name}>
                      <FileIcon type={f.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="file-name">{f.name}</div>
                        <div className="file-size">
                          {f.size}
                          {f.fromPrev && <span className="file-prev-tag"> · prev upload</span>}
                        </div>
                      </div>
                      <span className="file-badge">{f.type}</span>
                      <button className="file-remove" onClick={() => removeFile(f.name)}><CloseIcon /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FileIcon type="PDF" />
                  <span>No files selected</span>
                  <span>Upload above or pick from sidebar</span>
                </div>
              )}
            </div>

            {/* Panel 2 — Prompt / Output */}
            <div className="panel">
              {summaryOutput ? (
                <>
                  <div className="output-header">
                    <div>
                      <div className="panel-title">Summary Output</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <span className={`status-badge ${summaryOutput.summarizeFor === "lecturer" ? "badge-lecturer" : "badge-student"}`}>
                          {summaryOutput.summarizeFor}
                        </span>
                        <span className="status-badge badge-model">{summaryOutput.model}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                        <CopyIcon /> {copied ? "Copied!" : "Copy"}
                      </button>
                      <button className="copy-btn" onClick={() => setSummaryOutput(null)}>New</button>
                    </div>
                  </div>
                  <div className="output-area">
                    <div className="output-text">{summaryOutput.output}</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="panel-title">Additional Prompts</div>
                    <div className="panel-sub">Optional — refine the summary</div>
                  </div>
                  <textarea
                    className="prompt-area"
                    placeholder={"ex: focus on key concepts and definitions\nex: highlight any formulas or theorems\nex: point out the concept of Denormalization..."}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value.slice(0, 500))}
                  />
                  <div className="prompt-count">{prompt.length} / 500</div>
                </>
              )}
            </div>

            {/* Panel 3 — Controls */}
            <div className="panel" style={{ minHeight: 340 }}>
              <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon /> Upload Documents
              </button>
              <div className="upload-hint">(or select from sidebar)</div>

              <div>
                <div className="radio-label">Summarize for</div>
                {[
                  { id: "lecturer", title: "Lecturer", sub: "Detailed & comprehensive" },
                  { id: "student",  title: "Student",  sub: "Simplified, key points" },
                ].map(opt => (
                  <div key={opt.id} className={`radio-option ${summarizeFor === opt.id ? "selected" : ""}`}
                    onClick={() => setSummarizeFor(opt.id)}>
                    <div className={`radio-dot ${summarizeFor === opt.id ? "on" : ""}`} />
                    <div>
                      <div className="radio-title">{opt.title}</div>
                      <div className="radio-sub">{opt.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="model-label">Model</div>
                <div className="model-wrap">
                  <button className={`model-btn ${modelOpen ? "open" : ""}`}
                    onClick={() => setModelOpen(v => !v)}
                    onBlur={() => setTimeout(() => setModelOpen(false), 150)}>
                    <div className="model-left">
                      <div className="model-dot" />
                      <span>{selectedModel.label}</span>
                      <span className="model-sub">{selectedModel.sub}</span>
                    </div>
                    <ChevronDown />
                  </button>
                  {modelOpen && (
                    <div className="model-menu">
                      {MODELS.map(m => (
                        <div key={m.id} className={`model-opt ${model === m.id ? "on" : ""}`}
                          onMouseDown={() => { setModel(m.id); setModelOpen(false); }}>
                          <div>
                            <div className="model-opt-name">{m.label}</div>
                            <div className="model-opt-sub">{m.sub}</div>
                          </div>
                          {model === m.id && <span className="model-check">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="error-box">{error}</div>}

              <button
                className="summarize-btn"
                onClick={handleSummarize}
                disabled={loading || uploading || selectedFiles.length === 0}
              >
                {(loading || uploading)
                  ? <><div className="spinner" />{uploading ? "Uploading..." : "Summarizing..."}</>
                  : <><SparkleIcon /> Summarize</>
                }
              </button>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}