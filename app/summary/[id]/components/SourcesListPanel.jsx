"use client";

import { DocIco } from "@/app/components/icons";

export default function SourcesListPanel({
  summary,
  extraSources,
  onPreview,
  emptyMessage = "No attached sources. Use “Add sources” to pick documents from the dashboard.",
  listClassName = "src-list",
  wrapInPanel = false,
}) {
  const base = summary?.files || [];
  const extras = extraSources.filter((es) => !base.some((f) => f.id === es.id));
  const all = [...base, ...extras];

  const list = (
    <div
      className={listClassName}
      style={wrapInPanel ? { padding: 0 } : undefined}
    >
      {!all.length ? (
        <div className="src-empty">{emptyMessage}</div>
      ) : (
        all.map((f) => (
          <div key={f.id} className="src-item">
            <DocIco ext={f.type} />
            <div className="src-info">
              <div className="src-name" title={f.name}>
                {f.name}
              </div>
              <div className="src-meta">{f.type}</div>
            </div>
            <button
              type="button"
              className="src-preview-btn"
              onClick={(ev) => onPreview(f, ev)}
              title="Preview file"
              aria-label={`Preview ${f.name}`}
            >
              Preview
            </button>
          </div>
        ))
      )}
    </div>
  );

  if (!wrapInPanel) return list;

  return (
    <div className="hl-panel" aria-label="Sources">
      <div className="hl-head-row">
        <div className="hl-head">SOURCES</div>
      </div>
      {list}
    </div>
  );
}
