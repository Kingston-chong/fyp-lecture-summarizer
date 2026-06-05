"use client";

import { memo, useMemo } from "react";
import { chatMarkdownToHtml } from "@/lib/markdown";

const ChatBubbleContent = memo(function ChatBubbleContent({
  mdSrc,
  messageId,
}) {
  const html = useMemo(() => chatMarkdownToHtml(mdSrc), [mdSrc]);
  return (
    <div
      className="chat-hl-selectable md"
      data-chat-hl-root={messageId != null ? String(messageId) : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default ChatBubbleContent;
