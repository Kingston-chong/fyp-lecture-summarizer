"use client";

export default function ChatSourcesList({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <div className="chat-sources">
      <div className="chat-sources-label">Sources</div>
      <ul className="chat-sources-list">
        {sources.map((s) => (
          <li key={s.marker} className="chat-source-item">
            <span className="chat-source-marker">[{s.marker}]</span>
            <span className="chat-source-body">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chat-source-link"
                >
                  {s.title}
                </a>
              ) : (
                <span className="chat-source-title">{s.title}</span>
              )}
              {(s.authors || s.year || s.venue) && (
                <span className="chat-source-meta">
                  {[s.authors, s.year, s.venue].filter(Boolean).join(" · ")}
                </span>
              )}
              <span className="chat-source-kind">
                {s.kind === "paper" ? "Academic" : "Web"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
