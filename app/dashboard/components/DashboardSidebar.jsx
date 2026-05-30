"use client";

import {
  ChevronDownIcon,
  FileIcon,
  HistoryIcon,
  UploadIcon,
} from "@/app/components/icons";
import { formatSummarizeForLabel } from "../helpers";

export default function DashboardSidebar({
  sidebarWidth,
  sidebarSection,
  setSidebarSection,
  historyLoading,
  history,
  historySearch = "",
  onHistorySearchChange,
  expandedHistory,
  setExpandedHistory,
  onHistoryNavigate,
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

      {sidebarSection.history &&
        (historyLoading ? (
          <div className="sidebar-loading">
            <div className="mini-spinner" /> Loading...
          </div>
        ) : history.length === 0 ? (
          <div className="sidebar-empty">No summaries yet</div>
        ) : (
          history.map((h) => (
            <div key={h.id}>
              <div
                className={`history-item ${expandedHistory === h.id ? "active" : ""}`}
                onClick={() => {
                  setExpandedHistory(expandedHistory === h.id ? null : h.id);
                  onHistoryNavigate(h.id);
                }}
              >
                <div className="history-name" title={h.title}>
                  {h.title}
                </div>
                <div className="history-meta">
                  {[
                    `${h.files.length} file${h.files.length !== 1 ? "s" : ""}`,
                    formatSummarizeForLabel(h.summarizeFor),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="history-date">{timeAgo(h.createdAt)}</div>
              </div>
              {expandedHistory === h.id &&
                h.files.map((f) => (
                  <div className="history-file-chip" key={f.id}>
                    <FileIcon type={f.type} />
                    <span
                      title={f.name}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.name}
                    </span>
                  </div>
                ))}
            </div>
          ))
        ))}

      <div className="sidebar-divider" />

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
            <div className="mini-spinner" /> Loading...
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
                    ? "Deleting..."
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
    </aside>
  );
}
