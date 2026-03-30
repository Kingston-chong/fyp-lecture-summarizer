"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  DotsIcon,
  EditIcon,
  FileIcon,
  HistoryIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
} from "./icons";

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

/**
 * Nested outline tree: each heading’s children are deeper-level headings until
 * a sibling or ancestor sibling appears (standard markdown outline).
 */
function buildHeadingTree(headings) {
  if (!headings?.length) return [];
  const roots = [];
  const stack = [];
  for (const h of headings) {
    const node = { ...h, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

function SectionTreeBranch({
  node,
  depth,
  isFolded,
  onToggleFold,
}) {
  const hasChildren = node.children.length > 0;
  const folded = isFolded(node.id);
  return (
    <div className="as-sec-node">
      <div className="as-sec-main-row">
        {hasChildren ? (
          <button
            type="button"
            className={`as-sec-twist ${folded ? "folded" : ""}`}
            aria-label={
              folded ? "Expand subsections" : "Collapse subsections"
            }
            aria-expanded={!folded}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFold(node.id);
            }}
          >
            <ChevronDownIcon size={11} />
          </button>
        ) : (
          <span className="as-sec-twist-spacer" aria-hidden />
        )}
        <button
          type="button"
          className={`as-sec-item lv${node.level} as-sec-main-btn`}
          onClick={() => jumpToHeading(node.id)}
          title={node.text}
        >
          <SectionBullet level={node.level} />
          <span className="as-sec-main-txt">{node.text}</span>
        </button>
      </div>
      {hasChildren && !folded && (
        <div className="as-sec-children">
          {node.children.map((ch) => (
            <SectionTreeBranch
              key={ch.id}
              node={ch}
              depth={depth + 1}
              isFolded={isFolded}
              onToggleFold={onToggleFold}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function jumpToHeading(id) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("s2n-jump-to-heading", { detail: id }),
  );
}

function SectionBullet({ level }) {
  if (level === 1) {
    return (
      <span className="as-sec-bullet" aria-hidden>
        ●
      </span>
    );
  }
  if (level === 2) {
    return (
      <span className="as-sec-bullet" aria-hidden>
        ○
      </span>
    );
  }
  return null;
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
  /** heading id -> true when subsections are folded */
  const [foldedSectionGroups, setFoldedSectionGroups] = useState({});
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameModal, setRenameModal] = useState(null); // { summary, value }
  const [deleteModal, setDeleteModal] = useState(null); // { summary }
  const [toast, setToast] = useState(null); // { message } for share feedback

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

  const sectionTree = useMemo(
    () => buildHeadingTree(sections),
    [sections],
  );

  const sectionSig = useMemo(
    () => sections.map((s) => s.id).join("|"),
    [sections],
  );

  useEffect(() => {
    setFoldedSectionGroups({});
  }, [sectionSig]);

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

  function toggleSectionGroupFold(mainId) {
    setFoldedSectionGroups((prev) => ({
      ...prev,
      [mainId]: !prev[mainId],
    }));
  }

  function sectionGroupIsFolded(mainId) {
    return foldedSectionGroups[mainId] === true;
  }

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

  function openRenameModal(summary) {
    setMenuOpenId(null);
    setRenameModal({ summary, value: summary.title || "" });
  }

  async function submitRename() {
    if (!renameModal) return;
    const { summary } = renameModal;
    const next = renameModal.value?.trim() || "";
    const current = (summary.title || "").trim();
    if (!next || next === current) {
      setRenameModal(null);
      return;
    }
    setRenameModal(null);
    setRenamingId(summary.id);
    try {
      const res = await fetch(`/api/summary/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) await fetchHistory();
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDeleteSummary(summary) {
    if (!summary?.id) return;
    setMenuOpenId(null);
    setDeleteModal({ summary });
  }

  async function confirmDelete() {
    const s = deleteModal?.summary;
    setDeleteModal(null);
    if (!s?.id) return;
    setRenamingId(s.id);
    try {
      const res = await fetch(`/api/summary/${s.id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchHistory();
        router.push("/dashboard");
      }
    } finally {
      setRenamingId(null);
    }
  }

  function handleShareSummary(summary) {
    if (typeof window === "undefined" || !summary?.id) return;
    const url = `${window.location.origin}/summary/${summary.id}`;
    if (navigator.share) {
      navigator
        .share({ title: summary.title || "Slide2Notes summary", url })
        .catch(() => {});
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => setToast({ message: "Link copied to clipboard." }))
        .catch(() => setToast({ message: url }));
      return;
    }
    setToast({ message: url });
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <style>{`
        .as-side {
          width: ${width}px;
          height: 100%;
          flex-shrink: 0;
          background: var(--app-sidebar-bg);
          border-right: 1px solid var(--app-sidebar-border);
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

        .as-sec-menu {
          padding: 7px 10px 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          margin: 0 12px 7px;
          border: 1px solid rgba(255,255,255,0.04);
        }
        .as-sec-node { margin: 1px 0; }
        .as-sec-children {
          margin-top: 2px;
          margin-left: 4px;
          padding: 0 0 0 16px;
          border-left: 1px solid rgba(255,255,255,0.07);
        }
        .as-sec-main-row {
          display: flex;
          align-items: stretch;
          gap: 0;
          width: 100%;
          min-height: 30px;
        }
        .as-sec-twist {
          flex-shrink: 0;
          width: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.38);
          cursor: pointer;
          border-radius: 6px 0 0 6px;
          padding: 0;
          transition: background 0.15s, color 0.15s;
        }
        .as-sec-twist:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.72);
        }
        .as-sec-twist svg {
          transition: transform 0.2s ease;
        }
        .as-sec-twist.folded svg {
          transform: rotate(-90deg);
        }
        .as-sec-twist-spacer {
          width: 21px;
          flex-shrink: 0;
        }
        .as-sec-item {
          font-size: 11.5px;
          color: rgba(255,255,255,0.7);
          padding: 4px 8px;
          margin: 0;
          cursor: pointer;
          display: block;
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-family: 'Sora', sans-serif;
          line-height: 1.38;
          transition: background 0.15s, color 0.15s;
        }
        .as-sec-item.as-sec-main-btn {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
          width: auto;
          margin: 0;
        }
        .as-sec-main-txt {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .as-sec-item:hover { background: rgba(99,102,241,0.1); color: #a5b4fc; }
        .as-sec-item.lv1 { padding-left: 6px; font-weight: 500; }
        .as-sec-item.lv2 { padding-left: 6px; font-size: 11px; color: rgba(255,255,255,0.58); }
        .as-sec-item.lv3 { padding-left: 6px; font-size: 10.5px; color: rgba(255,255,255,0.5); }
        .as-sec-bullet { display: inline-block; margin-right: 6px; color: rgba(99,102,241,0.65); font-size: 7px; vertical-align: middle; flex-shrink: 0; }
        .as-sec-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: .09em;
          color: rgba(255,255,255,0.32);
          padding: 6px 16px 2px;
        }
        .as-menu {
          margin-top: 4px;
          margin-left: 28px;
          margin-right: 16px;
          padding: 6px;
          border-radius: 12px;
          background: rgba(20,20,30,0.98);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 18px 42px rgba(0,0,0,0.45);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .as-menu-btn {
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.72);
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .as-menu-btn:hover {
          background: rgba(255,255,255,0.06);
        }
        .as-menu-btn.danger {
          color: #f87171;
        }
        .as-menu-ico {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: rgba(255,255,255,0.65);
        }
        .as-menu-btn.danger .as-menu-ico {
          color: #f87171;
        }

        .as-modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px); z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .as-modal-box {
          background: rgba(22,22,32,0.98); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 24px; max-width: 400px; width: 100%;
          box-shadow: 0 24px 48px rgba(0,0,0,0.5);
        }
        .as-modal-title { font-size: 15px; font-weight: 600; color: #e0e0f0; margin-bottom: 8px; }
        .as-modal-desc { font-size: 12.5px; color: rgba(255,255,255,0.5); margin-bottom: 14px; line-height: 1.5; }
        .as-modal-input {
          width: 100%; padding: 10px 12px; margin-bottom: 18px; border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
          font-family: 'Sora', sans-serif; font-size: 13px; color: #e0e0f0;
          outline: none; transition: border-color 0.2s;
        }
        .as-modal-input:focus { border-color: rgba(99,102,241,0.5); }
        .as-modal-input::placeholder { color: rgba(255,255,255,0.25); }
        .as-modal-btns { display: flex; gap: 10px; justify-content: flex-end; }
        .as-modal-btn {
          height: 38px; padding: 0 18px; border-radius: 9px; font-family: 'Sora', sans-serif;
          font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .as-modal-btn.sec { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #b0b0cc; }
        .as-modal-btn.sec:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); }
        .as-modal-btn.primary { border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); color: white; }
        .as-modal-btn.primary:hover { filter: brightness(1.08); }
        .as-modal-btn.danger { border: none; background: rgba(248,113,113,0.25); color: #fca5a5; }
        .as-modal-btn.danger:hover { background: rgba(248,113,113,0.4); }

        .as-toast {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          padding: 10px 18px; border-radius: 10px; font-size: 12.5px;
          background: rgba(22,22,32,0.95); border: 1px solid rgba(255,255,255,0.12);
          color: #e0e0f0; z-index: 200; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          animation: asToastIn 0.2s ease;
        }
        @keyframes asToastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        html[data-theme="light"] .as-side::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); }
        html[data-theme="light"] .as-title { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-chev { color: rgba(0,0,0,0.35); }
        html[data-theme="light"] .as-divider { background: rgba(0,0,0,0.08); }
        html[data-theme="light"] .as-empty { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-loading { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-spin { border-color: rgba(0,0,0,0.12); border-top-color: #6366f1; }
        html[data-theme="light"] .as-hi:hover { background: rgba(0,0,0,0.04); }
        html[data-theme="light"] .as-hname { color: #111827; }
        html[data-theme="light"] .as-hmeta { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-hdots { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-hdots:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.78); }
        html[data-theme="light"] .as-hfile { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-pi:hover { background: rgba(0,0,0,0.04); }
        html[data-theme="light"] .as-pname { color: #1f2937; }
        html[data-theme="light"] .as-pmeta { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-sec-menu {
          background: rgba(0,0,0,0.02);
          border-color: rgba(0,0,0,0.08);
        }
        html[data-theme="light"] .as-sec-children { border-left-color: rgba(0,0,0,0.1); }
        html[data-theme="light"] .as-sec-twist { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-sec-twist:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.75); }
        html[data-theme="light"] .as-sec-item { color: #374151; }
        html[data-theme="light"] .as-sec-item.lv2 { color: rgba(0,0,0,0.62); }
        html[data-theme="light"] .as-sec-item.lv3 { color: rgba(0,0,0,0.52); }
        html[data-theme="light"] .as-sec-label { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .as-menu {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 18px 42px rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .as-menu-btn { color: #374151; }
        html[data-theme="light"] .as-menu-btn:hover { background: rgba(0,0,0,0.05); }
        html[data-theme="light"] .as-menu-ico { color: rgba(0,0,0,0.55); }
        html[data-theme="light"] .as-modal-box {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: 0 24px 48px rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .as-modal-title { color: #111827; }
        html[data-theme="light"] .as-modal-desc { color: rgba(0,0,0,0.55); }
        html[data-theme="light"] .as-modal-input {
          color: #111827;
          background: rgba(0,0,0,0.03);
          border-color: rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .as-modal-input::placeholder { color: rgba(0,0,0,0.4); }
        html[data-theme="light"] .as-modal-btn.sec {
          color: #4b5563;
          border-color: rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.03);
        }
        html[data-theme="light"] .as-modal-btn.sec:hover {
          border-color: rgba(0,0,0,0.18);
          background: rgba(0,0,0,0.06);
        }
        html[data-theme="light"] .as-toast {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.1);
          color: #111827;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
      `}</style>

      <aside className="as-side" aria-label="Sidebar">
        <div className="as-head" onClick={() => setHistoryOpen((v) => !v)}>
          <span className="as-title">
            <HistoryIcon /> History
          </span>
          <span className="as-chev">
            <ChevronDownIcon size={11} />
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
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("s2n-cancel-highlighter"),
                        );
                      }
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
                        setMenuOpenId((prev) => (prev === h.id ? null : h.id));
                      }}
                    >
                      {renamingId === h.id ? <span className="as-spin" /> : <DotsIcon />}
                    </button>
                  </div>
                  <div className="as-hmeta">
                    {h.files.length} file{h.files.length !== 1 ? "s" : ""} · {timeAgo(h.createdAt)}
                  </div>
                  {menuOpenId === h.id && (
                    <div className="as-menu">
                      <button
                        type="button"
                        className="as-menu-btn"
                        onClick={() => {
                          setMenuOpenId(null);
                          openRenameModal(h);
                        }}
                      >
                        <span className="as-menu-ico"><EditIcon size={16} /></span>
                        Rename
                      </button>
                      <button
                        type="button"
                        className="as-menu-btn"
                        onClick={() => {
                          setMenuOpenId(null);
                          handleShareSummary(h);
                        }}
                      >
                        <span className="as-menu-ico"><ShareIcon size={16} /></span>
                        Share
                      </button>
                      <button
                        type="button"
                        className="as-menu-btn danger"
                        onClick={() => {
                          setMenuOpenId(null);
                          handleDeleteSummary(h);
                        }}
                      >
                        <span className="as-menu-ico"><TrashIcon size={16} /></span>
                        Delete
                      </button>
                    </div>
                  )}
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
                <ChevronDownIcon size={11} />
              </span>
            </div>
            {sectionsOpen && (
              <div className="as-sec-menu">
                {sectionTree.map((node) => (
                  <SectionTreeBranch
                    key={node.id}
                    node={node}
                    depth={0}
                    isFolded={sectionGroupIsFolded}
                    onToggleFold={toggleSectionGroupFold}
                  />
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
                <ChevronDownIcon size={11} />
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

      {renameModal && (
        <div className="as-modal-backdrop" onClick={() => setRenameModal(null)}>
          <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="as-modal-title">Rename summary</div>
            <input
              type="text"
              className="as-modal-input"
              value={renameModal.value}
              onChange={(e) => setRenameModal((p) => ({ ...p, value: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
              placeholder="Summary title"
              autoFocus
            />
            <div className="as-modal-btns">
              <button type="button" className="as-modal-btn sec" onClick={() => setRenameModal(null)}>Cancel</button>
              <button type="button" className="as-modal-btn primary" onClick={submitRename}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="as-modal-backdrop" onClick={() => setDeleteModal(null)}>
          <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="as-modal-title">Delete summary</div>
            <div className="as-modal-desc">Delete this summary permanently? This cannot be undone.</div>
            <div className="as-modal-btns">
              <button type="button" className="as-modal-btn sec" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="button" className="as-modal-btn danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="as-toast" role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}

