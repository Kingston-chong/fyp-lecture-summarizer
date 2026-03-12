"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ChevronDown = ({ open }) => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.96" />
  </svg>
);

const UploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FileIcon = ({ type }) => {
  const colors = {
    PDF: "#f87171",
    PPTX: "#fb923c",
    PPT: "#fb923c",
    DOCX: "#60a5fa",
    DOC: "#60a5fa",
    TXT: "#a3e635",
    MD: "#a3e635",
    XLSX: "#34d399",
    XLS: "#34d399",
    CSV: "#34d399",
    default: "#c084fc",
  };
  const c = colors[type?.toUpperCase()] || colors.default;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

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

export default function AppSidebar({ width = 260, hidePrevUploads = false }) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [prevOpen, setPrevOpen] = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(null);

  const [history, setHistory] = useState([]);
  const [prevUploads, setPrevUploads] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [prevLoading, setPrevLoading] = useState(true);
  const [removingDocId, setRemovingDocId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsOpen, setSectionsOpen] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (res.ok) setHistory(data.summaries || []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchPrevUploads = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok) setPrevUploads(data.documents || []);
    } catch {
      // ignore
    } finally {
      setPrevLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchPrevUploads();
  }, [fetchHistory, fetchPrevUploads]);

  // Listen for headings from the summary view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setSections(list);
    };
    window.addEventListener("s2n-summary-headings", handler);
    return () => window.removeEventListener("s2n-summary-headings", handler);
  }, []);

  async function handleRemoveDocument(doc) {
    if (removingDocId != null) return;
    setRemovingDocId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      await fetchPrevUploads();
    } finally {
      setRemovingDocId(null);
    }
  }

  async function handleRenameSummary(summary) {
    const current = summary.title || "";
    // simple prompt-based rename for now
    const next = window.prompt("Rename summary", current);
    if (!next || next.trim() === "" || next.trim() === current.trim()) return;
    setRenamingId(summary.id);
    try {
      const res = await fetch(`/api/summary/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (!res.ok) {
        return;
      }
      await fetchHistory();
    } finally {
      setRenamingId(null);
    }
  }

  return (
    <>
      <style>{`
        .as-side {
          width: ${width}px;
          height: 100%;
          flex-shrink: 0;
          background: rgba(16,16,22,0.85);
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .as-side::-webkit-scrollbar { width: 3px; }
        .as-side::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .as-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px 6px; cursor: pointer; user-select: none;
        }
        .as-title {
          font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.25);
          letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; gap: 6px;
        }
        .as-chev { color: rgba(255,255,255,0.2); }
        .as-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 6px 16px; }
        .as-empty { padding: 12px 16px; font-size: 11px; color: rgba(255,255,255,0.18); font-style: italic; }
        .as-loading { padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.2); }
        .as-spin { width: 12px; height: 12px; border: 1.5px solid rgba(255,255,255,0.15); border-top-color: #6366f1; border-radius: 50%; animation: asSpin 0.7s linear infinite; }
        @keyframes asSpin { to { transform: rotate(360deg); } }

        .as-hi { padding: 8px 16px; cursor: pointer; transition: background 0.15s; position: relative; border-left: 2px solid transparent; }
        .as-hi:hover { background: rgba(255,255,255,0.03); }
        .as-hi.act { background: rgba(99,102,241,0.08); border-left-color: #6366f1; }
        .as-hrow { display: flex; align-items: center; gap: 6px; }
        .as-hname { flex: 1; font-size: 12px; font-weight: 500; color: #b8b8d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .as-hmeta { font-size: 10.5px; color: rgba(255,255,255,0.22); margin-top: 2px; }
        .as-hdots {
          width: 20px; height: 20px; border-radius: 50%;
          border: none; background: transparent; color: rgba(255,255,255,0.34);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
        }
        .as-hdots:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
        .as-hfile { display: flex; align-items: center; gap: 6px; padding: 4px 16px 4px 28px; font-size: 10.5px; color: rgba(255,255,255,0.22); }
        .as-hfile span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .as-pi { display: flex; align-items: center; gap: 8px; padding: 7px 16px; transition: background 0.15s; }
        .as-pi:hover { background: rgba(255,255,255,0.03); }
        .as-pinfo { flex: 1; min-width: 0; }
        .as-pname { font-size: 11.5px; font-weight: 500; color: #a8a8c0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .as-pmeta { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .as-rm {
          width: 22px; height: 22px; border-radius: 5px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(248,113,113,0.08);
          color: #f87171;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .as-rm:hover:not(:disabled) { background: rgba(248,113,113,0.2); border-color: rgba(248,113,113,0.3); }
        .as-rm:disabled { opacity: 0.6; cursor: not-allowed; }

        .as-sec-menu { padding: 4px 16px 10px; }
        .as-sec-item {
          font-size: 11px;
          color: rgba(255,255,255,0.62);
          padding: 3px 0;
          cursor: pointer;
          display: block;
          border-radius: 4px;
        }
        .as-sec-item:hover { background: rgba(255,255,255,0.06); }
        .as-sec-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .09em;
          color: rgba(255,255,255,0.32);
          padding: 6px 16px 2px;
        }
      `}</style>

      <aside className="as-side" aria-label="Sidebar">
        <div className="as-head" onClick={() => setHistoryOpen((v) => !v)}>
          <span className="as-title">
            <HistoryIcon /> History
          </span>
          <span className="as-chev">
            <ChevronDown open={historyOpen} />
          </span>
        </div>

        {historyOpen && (
          historyLoading ? (
            <div className="as-loading">
              <div className="as-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="as-empty">No summaries yet</div>
          ) : (
            history.map((h) => (
              <div key={h.id}>
                <div
                  className={`as-hi ${expandedHistory === h.id ? "act" : ""}`}
                >
                  <div
                    className="as-hrow"
                    onClick={() => {
                      setExpandedHistory(expandedHistory === h.id ? null : h.id);
                      router.push(`/summary/${h.id}`);
                    }}
                  >
                    <div className="as-hname" title={h.title}>
                      {h.title}
                    </div>
                    <button
                      type="button"
                      className="as-hdots"
                      title="Options"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameSummary(h);
                      }}
                    >
                      {renamingId === h.id ? <span className="as-spin" /> : <DotsIcon />}
                    </button>
                  </div>
                  <div className="as-hmeta">
                    {h.files.length} file{h.files.length !== 1 ? "s" : ""} · {timeAgo(h.createdAt)}
                  </div>
                </div>
                {expandedHistory === h.id &&
                  h.files.map((f) => (
                    <div className="as-hfile" key={f.id}>
                      <FileIcon type={f.type} />
                      <span title={f.name}>{f.name}</span>
                    </div>
                  ))}
              </div>
            ))
          )
        )}

        <div className="as-divider" />

        {/* Sections (headings inside current summary) */}
        {sections.length > 0 && (
          <>
            <div
              className="as-head"
              onClick={() => setSectionsOpen((v) => !v)}
            >
              <span className="as-title">Sections</span>
              <span className="as-chev">
                <ChevronDown open={sectionsOpen} />
              </span>
            </div>
            {sectionsOpen && (
              <div className="as-sec-menu">
                {sections.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="as-sec-item"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("s2n-jump-to-heading", {
                            detail: h.id,
                          }),
                        );
                      }
                    }}
                    title={h.text}
                  >
                    {h.level === 1 ? "" : h.level === 2 ? "• " : "‣ "}
                    {h.text}
                  </button>
                ))}
              </div>
            )}
            <div className="as-divider" />
          </>
        )}

        {!hidePrevUploads && (
          <>
            <div className="as-divider" />

            <div className="as-head" onClick={() => setPrevOpen((v) => !v)}>
              <span className="as-title">
                <UploadIcon /> Previous Uploaded
              </span>
              <span className="as-chev">
                <ChevronDown open={prevOpen} />
              </span>
            </div>

            {prevOpen && (
              prevLoading ? (
                <div className="as-loading">
                  <div className="as-spin" /> Loading...
                </div>
              ) : prevUploads.length === 0 ? (
                <div className="as-empty">No uploads yet</div>
              ) : (
                prevUploads.map((doc) => {
                  const isRemoving = removingDocId === doc.id;
                  return (
                    <div className="as-pi" key={doc.id}>
                      <FileIcon type={doc.type} />
                      <div className="as-pinfo">
                        <div className="as-pname" title={doc.name}>
                          {doc.name}
                        </div>
                        <div className="as-pmeta">
                          {formatBytes(doc.size)} · {timeAgo(doc.createdAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="as-rm"
                        title="Remove from server"
                        disabled={isRemoving}
                        onClick={() => handleRemoveDocument(doc)}
                      >
                        {isRemoving ? <span className="as-spin" /> : "×"}
                      </button>
                    </div>
                  );
                })
              )
            )}
          </>
        )}
      </aside>
    </>
  );
}

