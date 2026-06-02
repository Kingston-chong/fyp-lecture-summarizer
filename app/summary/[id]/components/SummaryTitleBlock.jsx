"use client";

export default function SummaryTitleBlock({
  summaryLoading,
  summaryError,
  summary,
  chatTitleEditing,
  chatTitleDraft,
  onChatTitleDraftChange,
  onSaveChatTitle,
  onChatTitleKeyDown,
  chatTitleSaving,
  onStartChatTitleEdit,
  chatTitleInputRef,
  className = "",
}) {
  if (summaryError) return null;

  if (summaryLoading || !summary) {
    return (
      <div className={className}>
        <span className="sum-chrome-title-placeholder" aria-hidden="true">
          Loading summary…
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      {chatTitleEditing ? (
        <input
          ref={chatTitleInputRef}
          type="text"
          className="sum-head-title-inp"
          value={chatTitleDraft}
          onChange={(e) => onChatTitleDraftChange(e.target.value)}
          onBlur={onSaveChatTitle}
          onKeyDown={onChatTitleKeyDown}
          disabled={chatTitleSaving}
          maxLength={255}
          aria-label="Summary title"
        />
      ) : (
        <button
          type="button"
          className="sum-head-title-btn"
          onClick={onStartChatTitleEdit}
          disabled={chatTitleSaving}
          title="Click to rename"
        >
          {summary.title?.trim() ? summary.title : "Untitled summary"}
        </button>
      )}
    </div>
  );
}
