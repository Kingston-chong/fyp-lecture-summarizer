"use client";

import { useEffect, useRef, useState } from "react";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import { CloseIcon, FileIcon, UploadIcon } from "@/app/components/icons";
import { LoadingText } from "@/app/components/LoadingText";

/**
 * NotebookLM-style modal: web search, paste URL, upload files, previous uploads.
 */
export default function AddSourcesModal({
  open,
  onClose,
  accept,
  multiple = true,
  improveMode = false,
  isGuest = false,
  uploadLimitText = "",
  prevUploads = [],
  prevLoading = false,
  onPickFiles,
  onImportWebSource,
  onWebSearch,
  onSelectPrevious,
  importing = false,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [searchAnswer, setSearchAnswer] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkErr, setLinkErr] = useState("");
  const [showPrev, setShowPrev] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchLoading(false);
      setSearchErr("");
      setSearchAnswer("");
      setSearchResults([]);
      setLinkUrl("");
      setLinkErr("");
      setShowPrev(false);
      setDragging(false);
      dragDepthRef.current = 0;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function resetDrag() {
    dragDepthRef.current = 0;
    setDragging(false);
  }

  function onDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) resetDrag();
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    resetDrag();
    const files = e.dataTransfer?.files;
    if (files?.length) {
      onPickFiles?.(files);
      onClose?.();
    }
  }

  function handlePickClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const files = e.target.files;
    if (files?.length) {
      onPickFiles?.(files);
      onClose?.();
    }
    e.target.value = "";
  }

  async function handleWebSearch(e) {
    e.preventDefault();
    setSearchErr("");
    setSearchAnswer("");
    setSearchResults([]);
    const query = searchQuery.trim();
    if (!query) {
      setSearchErr("Enter a topic or question to search the web.");
      return;
    }
    setSearchLoading(true);
    try {
      const data = await onWebSearch?.(query);
      setSearchAnswer(data?.answer || "");
      setSearchResults(Array.isArray(data?.results) ? data.results : []);
      if (!data?.results?.length) {
        setSearchErr("No results found. Try different keywords or paste a URL.");
      }
    } catch (err) {
      setSearchErr(err?.message || "Web search failed");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddSearchResult(result) {
    if (!result?.url || importing) return;
    setLinkErr("");
    try {
      await onImportWebSource?.(result.url);
      onClose?.();
    } catch (err) {
      setLinkErr(err?.message || "Could not add this page");
    }
  }

  async function handleImportLink(e) {
    e.preventDefault();
    setLinkErr("");
    const url = linkUrl.trim();
    if (!url) {
      setLinkErr("Paste a website link to extract its text.");
      return;
    }
    try {
      await onImportWebSource?.(url);
      onClose?.();
    } catch (err) {
      setLinkErr(err?.message || "Could not add website");
    }
  }

  const title = improveMode
    ? "Add a presentation to improve"
    : "Add sources to summarize";

  return (
    <div className="modal-backdrop add-sources-backdrop" onClick={onClose}>
      <div
        className="modal-box add-sources-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sources-title"
      >
        <div className="add-sources-head">
          <h2 id="add-sources-title" className="add-sources-title">
            {title}
          </h2>
          <button
            type="button"
            className="file-remove"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {!improveMode ? (
          <>
            <form className="add-sources-search-row" onSubmit={handleWebSearch}>
              <span className="add-sources-link-ico" aria-hidden>
                <SearchOutlinedIcon sx={{ fontSize: 18 }} />
              </span>
              <input
                type="search"
                className="add-sources-link-inp"
                placeholder="Search the web for sources"
                value={searchQuery}
                disabled={importing || searchLoading}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchErr) setSearchErr("");
                }}
              />
              <button
                type="submit"
                className="add-sources-link-btn"
                disabled={importing || searchLoading || !searchQuery.trim()}
              >
                {searchLoading ? (
                  <span className="improve-mini-spin" aria-hidden />
                ) : (
                  "Search"
                )}
              </button>
            </form>

            {searchErr && !searchResults.length ? (
              <div className="add-sources-link-err" role="alert">
                {searchErr}
              </div>
            ) : null}

            {searchAnswer ? (
              <p className="add-sources-search-overview">{searchAnswer}</p>
            ) : null}

            {searchResults.length > 0 ? (
              <div className="add-sources-search-results">
                {searchResults.map((r) => (
                  <div key={r.url} className="add-sources-search-item">
                    <div className="add-sources-search-item-main">
                      <div className="add-sources-search-title-row">
                        <div className="add-sources-search-title" title={r.title}>
                          {r.title}
                        </div>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="add-sources-search-open"
                            aria-label={`Open ${r.title || "source"} in new tab`}
                            title="Open in new tab"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />
                          </a>
                        ) : null}
                      </div>
                      {r.domain ? (
                        <div className="add-sources-search-domain">{r.domain}</div>
                      ) : null}
                      {r.snippet ? (
                        <div className="add-sources-search-snippet">{r.snippet}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="add-sources-search-add"
                      disabled={importing}
                      onClick={() => void handleAddSearchResult(r)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <form className="add-sources-link-row" onSubmit={handleImportLink}>
              <span className="add-sources-link-ico" aria-hidden>
                <LinkOutlinedIcon sx={{ fontSize: 18 }} />
              </span>
              <input
                type="url"
                className="add-sources-link-inp"
                placeholder="Or paste a website link"
                value={linkUrl}
                disabled={importing}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkErr) setLinkErr("");
                }}
              />
              <button
                type="submit"
                className="add-sources-link-btn add-sources-link-btn--secondary"
                disabled={importing || !linkUrl.trim()}
              >
                {importing ? (
                  <span className="improve-mini-spin" aria-hidden />
                ) : (
                  "Add website"
                )}
              </button>
            </form>
            {linkErr ? (
              <div className="add-sources-link-err" role="alert">
                {linkErr}
              </div>
            ) : (
              <p className="add-sources-link-hint">
                We extract readable text from webpages as summarize sources.
                Google Drive share links and YouTube URLs are not supported.
              </p>
            )}
          </>
        ) : null}

        <div
          className={`add-sources-drop${dragging ? " dragging" : ""}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <p className="add-sources-drop-title">
            {improveMode ? "Drop your file" : "or drop your files"}
          </p>
          <p className="add-sources-drop-formats">
            {improveMode ? "pptx, pdf" : "pdf, pptx, docx, txt, and more"}
          </p>
          {uploadLimitText ? (
            <p className="add-sources-drop-limit">{uploadLimitText}</p>
          ) : null}

          <div className="add-sources-actions">
            <button
              type="button"
              className="add-sources-action-btn"
              disabled={importing}
              onClick={handlePickClick}
            >
              <UploadIcon /> Upload files
            </button>
            {!isGuest && !improveMode && prevUploads.length > 0 ? (
              <button
                type="button"
                className={`add-sources-action-btn${showPrev ? " on" : ""}`}
                disabled={importing}
                onClick={() => setShowPrev((v) => !v)}
              >
                <HistoryOutlinedIcon sx={{ fontSize: 16 }} /> Previous uploads
              </button>
            ) : null}
          </div>

          {importing ? (
            <div className="add-sources-loading">
              <LoadingText active>Adding source</LoadingText>
            </div>
          ) : null}
        </div>

        {!isGuest && showPrev && !improveMode ? (
          <div className="add-sources-prev-list">
            {prevLoading ? (
              <LoadingText active>Loading uploads</LoadingText>
            ) : prevUploads.length === 0 ? (
              <p className="add-sources-prev-empty">No previous uploads yet.</p>
            ) : (
              prevUploads.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className="add-sources-prev-item"
                  onClick={() => {
                    onSelectPrevious?.(doc);
                    onClose?.();
                  }}
                >
                  <FileIcon type={doc.type} />
                  <span className="add-sources-prev-name" title={doc.name}>
                    {doc.name}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
