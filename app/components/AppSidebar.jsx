"use client";

import "./AppSidebar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { formatSummarizeForLabel, timeAgo } from "@/app/dashboard/helpers";
import HistorySummaryExpand, {
  defaultHistoryExpandTab,
  historyMatchesSearch,
} from "@/app/components/HistorySummaryExpand";

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

function SectionTreeBranch({ node, depth, isFolded, onToggleFold }) {
  const hasChildren = node.children.length > 0;
  const folded = isFolded(node.id);
  return (
    <div className="as-sec-node">
      <div className="as-sec-main-row">
        {hasChildren ? (
          <button
            type="button"
            className={`as-sec-twist ${folded ? "folded" : ""}`}
            aria-label={folded ? "Expand subsections" : "Collapse subsections"}
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
  window.dispatchEvent(new CustomEvent("s2n-jump-to-heading", { detail: id }));
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
  const [historyExpandTab, setHistoryExpandTab] = useState("files");

  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [prevUploads, setPrevUploads] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [prevLoading, setPrevLoading] = useState(true);
  const [removingDocId, setRemovingDocId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  /** heading id -> true when subsections are folded */
  const [foldedSectionGroups, setFoldedSectionGroups] = useState({});
  /** History row ⋮ menu: portaled to body so it is not clipped by sidebar overflow or trapped by drawer transform. */
  const [historyMenu, setHistoryMenu] = useState(null); // { id, bottom, right, width }
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

  const sectionTree = useMemo(() => buildHeadingTree(sections), [sections]);

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
    setHistoryMenu(null);
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
    setHistoryMenu(null);
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

  useEffect(() => {
    if (!historyMenu) return;
    const close = () => setHistoryMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [historyMenu]);

  useEffect(() => {
    if (!historyMenu) return;
    const onKey = (e) => {
      if (e.key === "Escape") setHistoryMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyMenu]);

  useEffect(() => {
    if (!historyMenu) return;
    const onDown = (e) => {
      const t = e.target;
      if (t.closest?.(".as-history-menu-portal")) return;
      if (t.closest?.(".as-hdots")) return;
      setHistoryMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [historyMenu]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => historyMatchesSearch(h, q));
  }, [history, historySearch]);

  const historyMenuSummary = useMemo(
    () => (historyMenu ? history.find((x) => x.id === historyMenu.id) : null),
    [history, historyMenu],
  );

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  /** Move the history ⋮ menu horizontally: increase to shift right (pixels). */
  const historyMenuShiftRightPx = 0;

  function openHistorySummary(h, sources) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("s2n-cancel-highlighter"));
    }
    const q = sources ? `?sources=${encodeURIComponent(sources)}` : "";
    router.push(`/summary/${h.id}${q}`);
  }

  return (
    <>
      <aside
        className="as-side"
        aria-label="Sidebar"
        style={{ "--as-side-width": `${width}px` }}
      >
        <div className="as-head" onClick={() => setHistoryOpen((v) => !v)}>
          <span className="as-title">
            <HistoryIcon /> History
          </span>
          <span className="as-chev">
            <ChevronDownIcon size={11} />
          </span>
        </div>

        {historyOpen && (
          <div className="as-search-wrap">
            <input
              type="search"
              className="as-search"
              placeholder="Search summaries…"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              aria-label="Search summary history"
            />
          </div>
        )}

        {historyOpen &&
          (historyLoading ? (
            <div className="as-loading">
              <div className="as-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="as-empty">No summaries yet</div>
          ) : filteredHistory.length === 0 ? (
            <div className="as-empty">No matches</div>
          ) : (
            filteredHistory.map((h) => (
              <div key={h.id}>
                <div
                  className={`as-hi ${expandedHistory === h.id ? "act" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openHistorySummary(h)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openHistorySummary(h);
                    }
                  }}
                >
                  <div className="as-hrow">
                    <div className="as-hname" title={h.title}>
                      {h.title}
                    </div>
                    <button
                      type="button"
                      className="as-hdots"
                      title="Options"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        setHistoryMenu((prev) =>
                          prev?.id === h.id
                            ? null
                            : {
                                id: h.id,
                                bottom: r.bottom,
                                right: r.right,
                              },
                        );
                      }}
                    >
                      {renamingId === h.id ? (
                        <span className="as-spin" />
                      ) : (
                        <DotsIcon />
                      )}
                    </button>
                  </div>
                  <HistorySummaryExpand
                    summary={h}
                    expanded={expandedHistory === h.id}
                    expandTab={historyExpandTab}
                    onToggleExpand={() => {
                      if (expandedHistory === h.id) {
                        setExpandedHistory(null);
                      } else {
                        setExpandedHistory(h.id);
                        setHistoryExpandTab(defaultHistoryExpandTab(h));
                      }
                    }}
                    onExpandTabChange={setHistoryExpandTab}
                    onNavigate={(id, sources) =>
                      openHistorySummary({ id }, sources)
                    }
                    summarizeForLabel={formatSummarizeForLabel(
                      h.summarizeFor,
                    )}
                    timeAgoLabel={timeAgo(h.createdAt)}
                    chevronClassName="as-hfile-chev"
                    metaClassName="as-hmeta"
                  />
                </div>
            </div>
            ))
          ))}

        <div className="as-divider" />

        {/* Sections (headings inside current summary) */}
        {sections.length > 0 && (
          <>
            <div className="as-head" onClick={() => setSectionsOpen((v) => !v)}>
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

            {prevOpen &&
              (prevLoading ? (
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
              ))}
          </>
        )}
      </aside>

      {portalTarget &&
        historyMenu &&
        historyMenuSummary &&
        createPortal(
          <div
            className="as-menu as-history-menu-portal"
            style={{
              position: "fixed",
              top: historyMenu.bottom + 6,
              left:
                Math.max(
                  12,
                  Math.min(
                    historyMenu.right - 220,
                    window.innerWidth - 220 - 12,
                  ),
                ) + historyMenuShiftRightPx,
            }}
            role="menu"
          >
            <button
              type="button"
              className="as-menu-btn"
              onClick={() => {
                setHistoryMenu(null);
                openRenameModal(historyMenuSummary);
              }}
            >
              <span className="as-menu-ico">
                <EditIcon size={16} />
              </span>
              Rename
            </button>
            <button
              type="button"
              className="as-menu-btn"
              onClick={() => {
                setHistoryMenu(null);
                handleShareSummary(historyMenuSummary);
              }}
            >
              <span className="as-menu-ico">
                <ShareIcon size={16} />
              </span>
              Share
            </button>
            <button
              type="button"
              className="as-menu-btn danger"
              onClick={() => {
                setHistoryMenu(null);
                handleDeleteSummary(historyMenuSummary);
              }}
            >
              <span className="as-menu-ico">
                <TrashIcon size={16} />
              </span>
              Delete
            </button>
          </div>,
          portalTarget,
        )}

      {portalTarget &&
        renameModal &&
        createPortal(
          <div
            className="as-modal-backdrop"
            onClick={() => setRenameModal(null)}
          >
            <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="as-modal-title">Rename summary</div>
              <input
                type="text"
                className="as-modal-input"
                value={renameModal.value}
                onChange={(e) =>
                  setRenameModal((p) => ({ ...p, value: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && submitRename()}
                placeholder="Summary title"
                autoFocus
              />
              <div className="as-modal-btns">
                <button
                  type="button"
                  className="as-modal-btn sec"
                  onClick={() => setRenameModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="as-modal-btn primary"
                  onClick={submitRename}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          portalTarget,
        )}

      {portalTarget &&
        deleteModal &&
        createPortal(
          <div
            className="as-modal-backdrop"
            onClick={() => setDeleteModal(null)}
          >
            <div className="as-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="as-modal-title">Delete summary</div>
              <div className="as-modal-desc">
                Delete this summary permanently? This cannot be undone.
              </div>
              <div className="as-modal-btns">
                <button
                  type="button"
                  className="as-modal-btn sec"
                  onClick={() => setDeleteModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="as-modal-btn danger"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          portalTarget,
        )}

      {portalTarget &&
        toast &&
        createPortal(
          <div className="as-toast" role="status">
            {toast.message}
          </div>,
          portalTarget,
        )}
    </>
  );
}
