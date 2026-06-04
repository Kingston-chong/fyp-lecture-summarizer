"use client";

import "./AppSidebar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveSummaryId } from "@/app/hooks/useActiveSummaryId";
import {
  ChevronDownIcon,
  DotsIcon,
  FileIcon,
  HistoryIcon,
  PinIcon,
  UploadIcon,
  SidebarHideIcon,
} from "./icons";
import { formatSummarizeForLabel, timeAgo } from "@/app/dashboard/helpers";
import { historyMatchesSearch } from "@/app/components/HistorySummaryExpand";
import HistoryTitleHoverPreview from "@/app/components/HistoryTitleHoverPreview";
import HistorySummaryMenuPortal from "@/app/components/HistorySummaryMenuPortal";
import HistorySummaryMenuActions from "@/app/components/HistorySummaryMenuActions";
import { useSummaryHistoryActions } from "@/app/hooks/useSummaryHistoryActions";
import { LoadingText } from "@/app/components/LoadingText";
import { SUMMARY_RENAMED_EVENT } from "@/lib/summaryRenameSync";
import GuestSidebarPrompt from "@/app/components/GuestSidebarPrompt";

function sortHistoryItems(items) {
  return [...items].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const at = new Date(a.pinnedAt || a.createdAt).getTime();
    const bt = new Date(b.pinnedAt || b.createdAt).getTime();
    if (at !== bt) return bt - at;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
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

export default function AppSidebar({
  width = 260,
  hidePrevUploads = false,
  isGuest = false,
  isCollapsed = false,
  showSidebarToggle = false,
  onToggleSidebar,
}) {
  const router = useRouter();
  const activeSummaryId = useActiveSummaryId();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [prevOpen, setPrevOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [prevUploads, setPrevUploads] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [prevLoading, setPrevLoading] = useState(true);
  const [removingDocId, setRemovingDocId] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  /** heading id -> true when subsections are folded */
  const [foldedSectionGroups, setFoldedSectionGroups] = useState({});
  /** History row ⋮ menu: portaled to body so it is not clipped by sidebar overflow or trapped by drawer transform. */
  const [historyMenu, setHistoryMenu] = useState(null); // { id, bottom, right, width }
  const [pinningId, setPinningId] = useState(null);

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

  const {
    shareLoadingId,
    openRenameModal,
    handleShareSummary,
    handleDeleteSummary,
    renderModals,
  } = useSummaryHistoryActions({ onRefresh: fetchHistory });

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
    if (isGuest) {
      setHistory([]);
      setHistoryLoading(false);
      setPrevUploads([]);
      setPrevLoading(false);
      return;
    }
    fetchHistory();
    if (!hidePrevUploads) fetchPrevUploads();
  }, [fetchHistory, fetchPrevUploads, hidePrevUploads, isGuest]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const { id, title } = e.detail || {};
      if (id == null) return;
      setHistory((prev) =>
        prev.map((h) =>
          String(h.id) === String(id) ? { ...h, title: title ?? h.title } : h,
        ),
      );
    };
    window.addEventListener(SUMMARY_RENAMED_EVENT, handler);
    return () => window.removeEventListener(SUMMARY_RENAMED_EVENT, handler);
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
      if (t.closest?.(".as-hpin")) return;
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

  const sortedHistory = useMemo(
    () => sortHistoryItems(filteredHistory),
    [filteredHistory],
  );

  async function togglePinSummary(summary, e) {
    e?.stopPropagation?.();
    if (!summary?.id || pinningId === summary.id) return;
    const nextPinned = !summary.pinned;
    setPinningId(summary.id);
    try {
      const res = await fetch(`/api/summary/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update pin");
      setHistory((prev) =>
        sortHistoryItems(
          prev.map((h) =>
            h.id === summary.id
              ? {
                  ...h,
                  pinned: nextPinned,
                  pinnedAt: nextPinned ? data.pinnedAt || new Date().toISOString() : null,
                }
              : h,
          ),
        ),
      );
    } catch (err) {
      setToast({
        message: err?.message || "Could not update pin.",
      });
    } finally {
      setPinningId(null);
    }
  }

  const historyMenuSummary = useMemo(
    () => (historyMenu ? history.find((x) => x.id === historyMenu.id) : null),
    [history, historyMenu],
  );

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
        className={`as-side${isCollapsed ? " is-collapsed" : ""}`}
        aria-label="Sidebar"
        style={{ "--as-side-width": isCollapsed ? "0px" : `${width}px` }}
      >
        {showSidebarToggle && !isCollapsed && (
          <div className="as-toolbar">
            <div className="as-toolbar-actions">
              <button
                type="button"
                className="as-toolbar-btn"
                title="Hide sidebar"
                aria-label="Hide sidebar"
                onClick={onToggleSidebar}
              >
                <SidebarHideIcon size={14} />
              </button>
            </div>
          </div>
        )}
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
          (isGuest ? (
            <GuestSidebarPrompt />
          ) : historyLoading ? (
            <div className="as-loading">
              <div className="as-spin" /> <LoadingText active>Loading</LoadingText>
            </div>
          ) : history.length === 0 ? (
            <div className="as-empty">No summaries yet</div>
          ) : filteredHistory.length === 0 ? (
            <div className="as-empty">No matches</div>
          ) : (
            sortedHistory.map((h) => (
              <div key={h.id}>
                <HistoryTitleHoverPreview
                  summary={h}
                  summarizeForLabel={formatSummarizeForLabel(h.summarizeFor)}
                  timeAgoLabel={timeAgo(h.createdAt)}
                  className={`as-hi${
                    activeSummaryId != null && Number(h.id) === activeSummaryId
                      ? " act"
                      : ""
                  }${h.pinned ? " pinned" : ""}${
                    historyMenu?.id === h.id ? " menu-open" : ""
                  }`}
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
                    <div className="as-hname">{h.title}</div>
                    <button
                      type="button"
                      className={`as-hpin${h.pinned ? " is-pinned" : ""}`}
                      title={h.pinned ? "Unpin from top" : "Pin to top"}
                      aria-label={h.pinned ? "Unpin summary" : "Pin summary"}
                      aria-pressed={Boolean(h.pinned)}
                      onClick={(e) => void togglePinSummary(h, e)}
                    >
                      {pinningId === h.id ? (
                        <span className="as-spin" />
                      ) : (
                        <PinIcon size={13} filled={Boolean(h.pinned)} />
                      )}
                    </button>
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
                                top: r.top,
                                left: r.left,
                                right: r.right,
                                bottom: r.bottom,
                              },
                        );
                      }}
                    >
                      <DotsIcon />
                    </button>
                  </div>
                </HistoryTitleHoverPreview>
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
                  <div className="as-spin" /> <LoadingText active>Loading</LoadingText>
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

      {historyMenu && historyMenuSummary && (
        <HistorySummaryMenuPortal
          summary={historyMenuSummary}
          anchor={historyMenu}
          onClose={() => setHistoryMenu(null)}
          onNavigate={(id, sources) => openHistorySummary({ id }, sources)}
          summarizeForLabel={formatSummarizeForLabel(
            historyMenuSummary.summarizeFor,
          )}
          timeAgoLabel={timeAgo(historyMenuSummary.createdAt)}
          shiftRightPx={historyMenuShiftRightPx}
        >
          <HistorySummaryMenuActions
            summary={historyMenuSummary}
            shareLoadingId={shareLoadingId}
            onRename={(s) => {
              setHistoryMenu(null);
              openRenameModal(s);
            }}
            onShare={(s) => {
              setHistoryMenu(null);
              void handleShareSummary(s);
            }}
            onDelete={(s) => {
              setHistoryMenu(null);
              handleDeleteSummary(s);
            }}
          />
        </HistorySummaryMenuPortal>
      )}

      {renderModals()}
    </>
  );
}
