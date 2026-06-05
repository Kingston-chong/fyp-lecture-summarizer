"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  FileIcon,
  HistoryIcon,
  UploadIcon,
} from "@/app/components/icons";
import HistorySummaryMenuPortal from "@/app/components/HistorySummaryMenuPortal";
import HistorySummaryMenuActions from "@/app/components/HistorySummaryMenuActions";
import SummaryHistoryRows from "@/app/components/SummaryHistoryRows";
import { useSummaryHistoryActions } from "@/app/hooks/useSummaryHistoryActions";
import { useActiveSummaryId } from "@/app/hooks/useActiveSummaryId";
import { formatSummarizeForLabel } from "../helpers";
import { LoadingText } from "@/app/components/LoadingText";
import "@/app/components/GuestSidebarPrompt.css";

export default function DashboardSidebar({
  isGuest = false,
  sidebarWidth,
  sidebarSection,
  setSidebarSection,
  historyLoading,
  history,
  historySearch = "",
  onHistorySearchChange,
  onHistoryNavigate,
  onHistoryRefresh,
  onHistoryUpdated,
  timeAgo,
  prevLoading,
  prevUploads,
  selectedPrevDocIds,
  toggleSelectAllPrevDocs,
  handleRemoveSelectedDocuments,
  bulkRemoving,
  prevSelectionMode,
  enterPrevSelectionMode,
  exitPrevSelectionMode,
  removingDocId,
  selectedFiles,
  addPrevFile,
  togglePrevDocSelection,
  openDocFilePreview,
  handleRemoveDocument,
  formatBytes,
}) {
  const activeSummaryId = useActiveSummaryId();
  const [historyMenu, setHistoryMenu] = useState(null);

  const {
    shareLoadingId,
    openRenameModal,
    handleShareSummary,
    handleDeleteSummary,
    renderModals,
  } = useSummaryHistoryActions({ onRefresh: onHistoryRefresh });

  const historyMenuSummary = useMemo(
    () => (historyMenu ? history.find((x) => x.id === historyMenu.id) : null),
    [history, historyMenu],
  );

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
      if (t.closest?.(".hist-history-menu")) return;
      if (t.closest?.(".history-dots")) return;
      if (t.closest?.(".history-pin")) return;
      setHistoryMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [historyMenu]);

  return (
    <aside className="sidebar" style={{ width: sidebarWidth }}>
      <div
        className="sidebar-header"
        onClick={() =>
          setSidebarSection((s) => ({ ...s, history: !s.history }))
        }
      >
        <span className="sidebar-title">
          <HistoryIcon /> History
        </span>
        <span
          className={`sidebar-chev ${sidebarSection.history ? "open" : ""}`}
        >
          <ChevronDownIcon />
        </span>
      </div>

      {sidebarSection.history && (
        <div className="sidebar-search-wrap">
          <input
            type="search"
            className="sidebar-search"
            placeholder="Search summaries…"
            value={historySearch}
            onChange={(e) => onHistorySearchChange?.(e.target.value)}
            aria-label="Search summary history"
          />
        </div>
      )}

      {sidebarSection.history && (
        <SummaryHistoryRows
          variant="dashboard"
          history={history}
          historySearch={historySearch}
          historyLoading={historyLoading}
          isGuest={isGuest}
          timeAgo={timeAgo}
          activeSummaryId={activeSummaryId}
          historyMenuId={historyMenu?.id ?? null}
          onNavigate={onHistoryNavigate}
          onRefresh={onHistoryRefresh}
          onHistoryUpdated={onHistoryUpdated}
          onOpenMenu={setHistoryMenu}
        />
      )}

      {!isGuest ? <div className="sidebar-divider" /> : null}

      {!isGuest ? (
      <>
      <div
        className="sidebar-header sidebar-header--prev"
        onClick={() => setSidebarSection((s) => ({ ...s, prev: !s.prev }))}
      >
        <span className="sidebar-title">
          <UploadIcon /> Previous Uploaded
        </span>
        <span className="sidebar-header-actions">
          {sidebarSection.prev && prevUploads.length > 0 && (
            prevSelectionMode ? (
              <button
                type="button"
                className="prev-done-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  exitPrevSelectionMode();
                }}
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                className="prev-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  enterPrevSelectionMode();
                }}
              >
                Select
              </button>
            )
          )}
          <span className={`sidebar-chev ${sidebarSection.prev ? "open" : ""}`}>
            <ChevronDownIcon />
          </span>
        </span>
      </div>

      {sidebarSection.prev &&
        (prevLoading ? (
          <div className="sidebar-loading">
            <div className="mini-spinner" /> <LoadingText active>Loading</LoadingText>
          </div>
        ) : prevUploads.length === 0 ? (
          <div className="sidebar-empty">No uploads yet</div>
        ) : (
          <>
            {prevSelectionMode && (
              <div className="prev-controls prev-controls--selection">
                <label className="prev-select-all">
                  <input
                    type="checkbox"
                    checked={
                      prevUploads.length > 0 &&
                      selectedPrevDocIds.length === prevUploads.length
                    }
                    onChange={toggleSelectAllPrevDocs}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  className="prev-bulk-remove"
                  onClick={handleRemoveSelectedDocuments}
                  disabled={
                    bulkRemoving ||
                    removingDocId != null ||
                    selectedPrevDocIds.length === 0
                  }
                  title="Delete selected files"
                >
                  {bulkRemoving
                    ? (
                        <LoadingText active>Deleting</LoadingText>
                      )
                    : `Delete (${selectedPrevDocIds.length})`}
                </button>
              </div>
            )}
            {prevUploads.map((doc) => {
              const isAdded = selectedFiles.some((f) => f.name === doc.name);
              const isRemoving = removingDocId === doc.id;
              const isChecked = selectedPrevDocIds.includes(doc.id);
              return (
                <div
                  className={`prev-item${prevSelectionMode ? " prev-item--selection" : ""}`}
                  key={doc.id}
                >
                  {prevSelectionMode && (
                    <input
                      type="checkbox"
                      className="prev-check"
                      checked={isChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => togglePrevDocSelection(doc.id)}
                      aria-label={`Select ${doc.name}`}
                    />
                  )}
                  <div
                    className="prev-item-main"
                    onClick={() =>
                      prevSelectionMode
                        ? togglePrevDocSelection(doc.id)
                        : addPrevFile(doc)
                    }
                  >
                    <FileIcon type={doc.type} />
                    <div className="prev-info">
                      <div className="prev-name" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="prev-meta">
                        {formatBytes(doc.size)} · {timeAgo(doc.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="prev-actions">
                    <button
                      type="button"
                      className="prev-peek"
                      title="Preview file"
                      disabled={bulkRemoving}
                      onClick={(e) => openDocFilePreview(doc, e)}
                    >
                      ⧉
                    </button>
                    {!prevSelectionMode && (
                      <button
                        type="button"
                        className="prev-remove"
                        title="Remove from server"
                        disabled={isRemoving || bulkRemoving}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDocument(doc);
                        }}
                      >
                        {isRemoving ? (
                          <span className="mini-spinner" />
                        ) : (
                          "×"
                        )}
                      </button>
                    )}
                    {!prevSelectionMode && (
                      <div
                        className={`prev-add ${isAdded ? "added" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          addPrevFile(doc);
                        }}
                      >
                        {isAdded ? "✓" : "+"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ))}
      </>
      ) : null}
      {historyMenu && historyMenuSummary && (
        <HistorySummaryMenuPortal
          summary={historyMenuSummary}
          anchor={historyMenu}
          onClose={() => setHistoryMenu(null)}
          onNavigate={(id, sources) => {
            setHistoryMenu(null);
            onHistoryNavigate(id, sources);
          }}
          summarizeForLabel={formatSummarizeForLabel(
            historyMenuSummary.summarizeFor,
          )}
          timeAgoLabel={timeAgo(historyMenuSummary.createdAt)}
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
    </aside>
  );
}
