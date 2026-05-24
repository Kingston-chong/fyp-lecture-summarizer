"use client";

import { memo, useMemo } from "react";
import { chatMarkdownToHtml } from "@/lib/markdown";

const ChatBubbleContent = memo(function ChatBubbleContent({ mdSrc }) {
  const html = useMemo(() => chatMarkdownToHtml(mdSrc), [mdSrc]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

export default ChatBubbleContent;
