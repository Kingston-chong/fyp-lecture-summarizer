"use client";

import {
  ChevronDownIcon,
  FileIcon,
  HistoryIcon,
  UploadIcon,
} from "@/app/components/icons";

export default function DashboardSidebar({
  sidebarWidth,
  sidebarSection,
  setSidebarSection,
  historyLoading,
  history,
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
                  {h.files.length} file{h.files.length !== 1 ? "s" : ""} ·{" "}
                  {timeAgo(h.createdAt)}
                </div>
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
        className="sidebar-header"
        onClick={() => setSidebarSection((s) => ({ ...s, prev: !s.prev }))}
      >
        <span className="sidebar-title">
          <UploadIcon /> Previous Uploaded
        </span>
        <span className={`sidebar-chev ${sidebarSection.prev ? "open" : ""}`}>
          <ChevronDownIcon />
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
            <div className="prev-controls">
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
                  : `Delete selected (${selectedPrevDocIds.length})`}
              </button>
            </div>
            {prevUploads.map((doc) => {
              const isAdded = selectedFiles.some((f) => f.name === doc.name);
              const isRemoving = removingDocId === doc.id;
              return (
                <div className="prev-item" key={doc.id}>
                  <input
                    type="checkbox"
                    className="prev-check"
                    checked={selectedPrevDocIds.includes(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => togglePrevDocSelection(doc.id)}
                    aria-label={`Select ${doc.name}`}
                  />
                  <div
                    className="prev-item-main"
                    onClick={() => addPrevFile(doc)}
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
                      {isRemoving ? <span className="mini-spinner" /> : "×"}
                    </button>
                    <div
                      className={`prev-add ${isAdded ? "added" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        addPrevFile(doc);
                      }}
                    >
                      {isAdded ? "✓" : "+"}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ))}
    </aside>
  );
}
