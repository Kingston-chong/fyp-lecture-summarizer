import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";

export function useSummaryData({ status, summaryId }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState("");
  const latestSummaryForAutostartRef = useRef(null);
  latestSummaryForAutostartRef.current = summary;

  const [headings, setHeadings] = useState([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [summaryCopied, setSummaryCopied] = useState(false);

  const [chatTitleEditing, setChatTitleEditing] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [chatTitleSaving, setChatTitleSaving] = useState(false);
  const chatTitleInputRef = useRef(null);

  useEffect(() => {
    setChatTitleEditing(false);
  }, [summaryId]);

  useEffect(() => {
    if (!chatTitleEditing) return;
    const id = requestAnimationFrame(() => {
      const el = chatTitleInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [chatTitleEditing]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId) return;
    let cancelled = false;
    async function load() {
      setSummaryLoading(true);
      setSummaryError("");
      try {
        const res = await fetch(`/api/summary/${summaryId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load summary");
        if (!cancelled) setSummary(data.summary);
      } catch (e) {
        if (!cancelled) setSummaryError(e?.message ?? "Failed to load summary");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId) return;
    if (summaryLoading) return;
    if (searchParams?.get("autostart") !== "1") return;

    const s = latestSummaryForAutostartRef.current;
    if (!s) return;
    if (typeof s.output === "string" && s.output.trim().length > 0) return;

    let cancelled = false;
    async function run() {
      setSummarizeError("");
      setSummarizing(true);
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summaryId: Number(summaryId),
            stream: true,
          }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream") || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to start stream");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let streamError = "";

        const applySseBlock = (block) => {
          const lines = block.split(/\r?\n/);
          let event = "message";
          const dataLines = [];
          for (const ln of lines) {
            if (!ln) continue;
            if (ln.startsWith("event:")) event = ln.slice(6).trim();
            else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trimStart());
          }
          if (!dataLines.length) return;
          let payload = {};
          try {
            payload = JSON.parse(dataLines.join("\n"));
          } catch {
            payload = {};
          }
          if (event === "chunk" && payload?.text) {
            setSummary((prev) => {
              if (!prev) return prev;
              return { ...prev, output: String(prev.output || "") + payload.text };
            });
          } else if (event === "error") {
            streamError = payload?.error || "Summarization failed";
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let splitIdx = buffer.indexOf("\n\n");
          while (splitIdx !== -1) {
            const block = buffer.slice(0, splitIdx);
            buffer = buffer.slice(splitIdx + 2);
            applySseBlock(block);
            splitIdx = buffer.indexOf("\n\n");
          }
          if (cancelled) break;
        }

        if (!cancelled && buffer.trim()) applySseBlock(buffer.trim());
        if (!cancelled && streamError) throw new Error(streamError);

        if (!cancelled) {
          const r = await fetch(`/api/summary/${summaryId}`);
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.summary) setSummary(d.summary);
        }

        if (!cancelled) {
          const sid = String(summaryId);
          router.replace(`/summary/${encodeURIComponent(sid)}`);
        }
      } catch (e) {
        if (!cancelled) setSummarizeError(e?.message ?? "Summarization failed");
      } finally {
        setSummarizing(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId, summaryLoading, searchParams, router]);

  useEffect(() => {
    if (!summary || !summary.output) {
      setHeadings([]);
      setSummaryHtml("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("s2n-summary-headings", { detail: [] }),
        );
      }
      return;
    }

    const md = summary.output;
    const found = [];
    const re = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = re.exec(md))) {
      const level = match[1].length;
      const text = match[2].trim();
      const slugBase =
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `section-${found.length}`;
      const id = `s2n-h-${slugBase}-${found.length}`;
      found.push({ id, level, text });
    }

    let html = markdownToHtml(md);
    found.forEach((h) => {
      const tag = `h${h.level}`;
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`<${tag}>${escaped}</${tag}>`);
      html = html.replace(pattern, `<${tag} id="${h.id}">${h.text}</${tag}>`);
    });

    setHeadings(found);
    setSummaryHtml(html);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("s2n-summary-headings", { detail: found }),
      );
    }
  }, [summary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const id = e.detail;
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("s2n-jump-to-heading", handler);
    return () => window.removeEventListener("s2n-jump-to-heading", handler);
  }, []);

  const summaryBodyDangerousHtml = useMemo(() => {
    const hasOutput =
      typeof summary?.output === "string" && summary.output.trim().length > 0;
    const fallback = summarizing
      ? "Generating summary…"
      : summarizeError
        ? `Error: ${summarizeError}`
        : "No summary output found.";
    const raw = summaryHtml || markdownToHtml(hasOutput ? summary.output : fallback);
    return { __html: raw };
  }, [summaryHtml, summary?.output, summarizing, summarizeError]);

  function handleCopySummary() {
    const text = summary?.output?.trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    });
  }

  function startChatTitleEdit() {
    if (!summary || summaryLoading || chatTitleSaving) return;
    setChatTitleDraft(summary.title || "");
    setChatTitleEditing(true);
  }

  async function saveChatTitle() {
    if (!summaryId || !summary) return;
    const next = chatTitleDraft.trim();
    const prev = (summary.title || "").trim();
    if (!next) {
      setChatTitleDraft(prev);
      setChatTitleEditing(false);
      return;
    }
    if (next === prev) {
      setChatTitleEditing(false);
      return;
    }
    setChatTitleSaving(true);
    try {
      const res = await fetch(`/api/summary/${summaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save title");
      setSummary((s) => (s ? { ...s, title: next } : s));
      setChatTitleEditing(false);
    } catch {
      setChatTitleDraft(prev);
      setChatTitleEditing(false);
    } finally {
      setChatTitleSaving(false);
    }
  }

  function onChatTitleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      chatTitleInputRef.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setChatTitleDraft((summary?.title || "").trim());
      setChatTitleEditing(false);
    }
  }

  return {
    summary,
    setSummary,
    summaryLoading,
    summaryError,
    summarizing,
    summarizeError,
    headings,
    summaryHtml,
    summaryCopied,
    summaryBodyDangerousHtml,
    handleCopySummary,
    chatTitleEditing,
    chatTitleDraft,
    setChatTitleDraft,
    chatTitleSaving,
    chatTitleInputRef,
    startChatTitleEdit,
    saveChatTitle,
    onChatTitleKeyDown,
  };
}
