"use client";

import { memo, useMemo } from "react";
import { markdownToHtml } from "@/lib/markdown";

const ChatBubbleContent = memo(function ChatBubbleContent({ mdSrc }) {
  const html = useMemo(() => markdownToHtml(mdSrc), [mdSrc]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});

export default ChatBubbleContent;
