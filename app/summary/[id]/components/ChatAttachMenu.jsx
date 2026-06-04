"use client";

import { useEffect, useRef, useState } from "react";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import { ClipIco, DocIco, Spinner } from "@/app/components/icons";

/**
 * ChatGPT-style attachment menu: upload, recent stored files, web search (Tavily).
 */
export default function ChatAttachMenu({
  disabled = false,
  loading = false,
  badgeCount = 0,
  webSearchEnabled = false,
  onWebSearchToggle,
  onPickFiles,
  recentFiles = [],
  recentLoading = false,
  recentEmptyHint = "No stored documents yet.",
  onSelectRecent,
  variant = "inline",
  guestMode = false,
}) {
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) setRecentOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setRecentOpen(false);
  }

  function handlePickFiles() {
    closeMenu();
    onPickFiles?.();
  }

  function handleSelectRecent(doc) {
    onSelectRecent?.(doc);
    closeMenu();
  }

  const btnClass =
    variant === "toolbar" ? "attach-btn attach-btn--toolbar" : "attach-btn";

  return (
    <div className="chat-attach-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`${btnClass}${open ? " open" : ""}${webSearchEnabled ? " attach-btn--web-on" : ""}`}
        title="Add attachment or tools"
        aria-label="Add attachment or tools"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
      >
        {loading ? <Spinner size={12} /> : <ClipIco size={16} />}
        {badgeCount > 0 && (
          <span className="attach-badge">{Math.min(99, badgeCount)}</span>
        )}
      </button>

      {open && (
        <div className="chat-attach-menu" role="menu">
          <button
            type="button"
            className="chat-attach-item"
            role="menuitem"
            onClick={handlePickFiles}
          >
            <span className="chat-attach-item-ico" aria-hidden>
              <AttachFileOutlinedIcon sx={{ fontSize: 18 }} />
            </span>
            <span className="chat-attach-item-label">Add photos &amp; files</span>
          </button>

          {!guestMode ? (
            <div
              className={`chat-attach-item chat-attach-item--sub ${recentOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className="chat-attach-item-trigger"
                role="menuitem"
                aria-expanded={recentOpen}
                onClick={() => setRecentOpen((v) => !v)}
              >
                <span className="chat-attach-item-ico" aria-hidden>
                  <HistoryOutlinedIcon sx={{ fontSize: 18 }} />
                </span>
                <span className="chat-attach-item-label">Recent files</span>
                <ChevronRightOutlinedIcon
                  className="chat-attach-chevron"
                  sx={{ fontSize: 16 }}
                  aria-hidden
                />
              </button>
              {recentOpen && (
                <div className="chat-attach-submenu" role="menu">
                  {recentLoading ? (
                    <div className="chat-attach-subempty">Loading…</div>
                  ) : recentFiles.length === 0 ? (
                    <div className="chat-attach-subempty">{recentEmptyHint}</div>
                  ) : (
                    recentFiles.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="chat-attach-recent"
                        role="menuitem"
                        title={doc.name}
                        onClick={() => handleSelectRecent(doc)}
                      >
                        <DocIco ext={doc.type} size={14} />
                        <span className="chat-attach-recent-name">{doc.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className="chat-attach-divider" role="separator" />

          <button
            type="button"
            className={`chat-attach-item chat-attach-item--toggle${webSearchEnabled ? " on" : ""}`}
            role="menuitemcheckbox"
            aria-checked={webSearchEnabled}
            onClick={() => onWebSearchToggle?.()}
          >
            <span className="chat-attach-item-ico" aria-hidden>
              <LanguageOutlinedIcon sx={{ fontSize: 18 }} />
            </span>
            <span className="chat-attach-item-copy">
              <span className="chat-attach-item-label">Web search</span>
              <span className="chat-attach-item-hint">Uses Tavily for live web results</span>
            </span>
            {webSearchEnabled ? (
              <span className="chat-attach-check" aria-hidden>
                ✓
              </span>
            ) : null}
          </button>
        </div>
      )}
    </div>
  );
}
