"use client";

import { CloseIcon } from "@/app/components/icons";

export default function TemplatePickerModal({
  open,
  onClose,
  themeQuery,
  onThemeQueryChange,
  onSearch,
  themeSearchLoading,
  themeSearchErr,
  themeResults,
  selectedThemeId,
  onSelectTheme,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box template-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-picker-head">
          <div className="modal-title" style={{ marginBottom: 0 }}>Choose design template</div>
          <button
            type="button"
            className="file-remove"
            aria-label="Close template picker"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="template-picker-search-row">
          <input
            className="improve-txt-inp"
            placeholder="Search template style (e.g. dark green modular roadmap)..."
            value={themeQuery}
            onChange={(e) => onThemeQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <button
            type="button"
            className="improve-btn-secondary"
            style={{ flex: "none", width: 86 }}
            disabled={themeSearchLoading || !themeQuery.trim()}
            onClick={() => void onSearch()}
          >
            {themeSearchLoading ? <span className="improve-mini-spin" /> : "Search"}
          </button>
        </div>
        {themeSearchErr && <div className="improve-err" style={{ marginTop: 8 }}>{themeSearchErr}</div>}

        <div className="template-picker-grid">
          {themeResults.length === 0 ? (
            <div className="template-picker-empty">Search to see template previews.</div>
          ) : (
            themeResults.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`template-card ${selectedThemeId === t.id ? "on" : ""}`}
                onClick={() => void onSelectTheme(t)}
              >
                <div className="template-card-preview-wrap">
                  <div className="template-card-preview-icon">🎨</div>
                  <div className="template-card-preview-label">{t.name || "Template"}</div>
                  {t.tags && (
                    <div className="template-card-preview-tags">
                      {String(t.tags).split(",").slice(0, 3).map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                        <span key={tag} className="template-card-preview-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  {t.themeURL && (
                    <a
                      href={t.themeURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="template-card-view-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View ↗
                    </a>
                  )}
                  {t.themeURL && (
                    <img
                      src={`/api/improve-ppt/theme-preview?url=${encodeURIComponent(t.themeURL)}`}
                      alt={t.name || "Template preview"}
                      className="template-card-preview"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>
                <div className="template-card-name">{t.name || "Untitled template"}</div>
                {t.description ? <div className="template-card-desc">{t.description}</div> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
