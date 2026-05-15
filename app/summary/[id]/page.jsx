"use client";

import "./summary-page.css";

import {
  Fragment,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";
import { buildChatSuggestions } from "@/lib/chatSuggestionsFromSummary";
import Button from "@/app/components/ui/Button";
import DocumentPreviewModal from "@/app/dashboard/components/DocumentPreviewModal";
import { formatBytes, isOfficePreviewName } from "@/app/dashboard/helpers";
import SummaryModalStack from "./components/SummaryModalStack";
import {
  DEFAULT_HL_HEX,
  fmtDate,
  formatSlideDeckSavedAt,
  formatSummaryModelLabel,
  HIGHLIGHT_PRESETS,
  parseNumericSummaryId,
  settingsFromQuizSet,
} from "./helpers";
import {
  unwrapHighlightMarks,
  wrapQuoteInRoot,
} from "./hooks/highlightDom";
import ChatBubbleContent from "./components/ChatBubbleContent";
import ChatSelectionPopover from "./components/ChatSelectionPopover";
import QuizAttemptDetailModal from "./components/QuizAttemptDetailModal";
import SourcesSidebar from "./components/SourcesSidebar";
import MobileMoreSheet from "./components/MobileMoreSheet";
import { useSourcesPanelResize } from "./hooks/useSourcesPanelResize";
import { useSlideDecks } from "./hooks/useSlideDecks";
import { useQuizSets } from "./hooks/useQuizSets";
import {
  MODELS,
  ATTACH_ACCEPT,
  SUMMARY_BODY_INNER_STYLE,
} from "./constants";
import {
  downscaleImageFileToJpegDataUrl,
  MAX_CHAT_PASTE_IMAGES,
} from "./lib/chatImages";
import { chatMessageToApiPayload, mapChatModelToApi } from "./lib/chatApi";
import { exportSummaryPdf } from "./lib/exportSummaryPdf";
import {
  Chevron,
  Spinner,
  SendIco,
  CopyIco,
  RegenIco,
  HighlightIco,
  SaveIco,
  BotIco,
  UserIco,
  DocIco,
  QuizIco,
  PdfIco,
  SlidesIco,
  ClipIco,
} from "@/app/components/icons";

// Component
export default function SummaryView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const summaryId = params?.id;
  const numericSummaryId = useMemo(
    () => parseNumericSummaryId(summaryId),
    [summaryId],
  );

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState("");
  /** Latest summary for autostart stream — avoids effect deps on `summary` (each SSE chunk re-ran the effect and cancelled the stream). */
  const latestSummaryForAutostartRef = useRef(null);
  latestSummaryForAutostartRef.current = summary;

  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [chatModel, setChatModel] = useState("ChatGPT");
  const [modelOpen, setModelOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  // Web fallback is automatic server-side (ChatGPT-like). No UI toggle needed.
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [sourceUploadLoading, setSourceUploadLoading] = useState(false);
  const [extraSources, setExtraSources] = useState([]);
  const [pendingSourceFiles, setPendingSourceFiles] = useState([]); // { clientId, file, name, type }
  /** Pasted screenshots for the next chat send — { clientId, dataUrl } */
  const [pendingPasteImages, setPendingPasteImages] = useState([]);
  /** Temporary selected chat text waiting for explicit "Reply" click */
  const [chatSelectionDraft, setChatSelectionDraft] = useState(null); // { text, messageId, x, y }
  /** Selected chat excerpts queued as context for the next user send */
  const [pendingChatReferences, setPendingChatReferences] = useState([]); // { id, text, messageId }
  const [headings, setHeadings] = useState([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [slidesModal, setSlidesModal] = useState(false);
  const [quizModal, setQuizModal] = useState(false);
  const [quizView, setQuizView] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [quizSettings, setQuizSettings] = useState(null);

  const [compactActBar, setCompactActBar] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [pendingHighlights, setPendingHighlights] = useState([]);
  const [hlLoading, setHlLoading] = useState(false);
  const [hlModeActive, setHlModeActive] = useState(false);
  const [hlColorMenuOpen, setHlColorMenuOpen] = useState(false);
  const [hlColorHex, setHlColorHex] = useState(DEFAULT_HL_HEX);
  const [hlSaving, setHlSaving] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [sourcePreviewDoc, setSourcePreviewDoc] = useState(null);
  const [sourcePreviewSrc, setSourcePreviewSrc] = useState("");
  const [sourcePreviewTabHref, setSourcePreviewTabHref] = useState("");
  const [sourcePreviewTokenLoading, setSourcePreviewTokenLoading] = useState(false);
  const [sourcePreviewIframeLoading, setSourcePreviewIframeLoading] = useState(true);
  const [sourcePreviewSetupErr, setSourcePreviewSetupErr] = useState("");

  const {
    sourcesWidth,
    onSplitterMouseDown,
  } = useSourcesPanelResize();

  const slideDecksApi = useSlideDecks({ summaryId, status });
  const {
    slideDecks,
    slideDecksLoading,
    slideDeckDeletingId,
    slideDeckPreviewOpen,
    setSlideDeckPreviewOpen,
    slideDeckPreviewUrl,
    slideDeckRemotePptUrl,
    slideDeckPreviewTitle,
    slideDeckDlRef,
    fetchSlideDecks,
    openSlideDeckPreview,
    downloadSlideDeck,
    deleteSlideDeck,
  } = slideDecksApi;

  const quizSetsApi = useQuizSets({
    summaryId,
    status,
    setQuizData,
    setQuizSettings,
    setQuizView,
  });
  const {
    quizSets,
    quizSetsLoading,
    quizSetOpeningId,
    quizHistoryOpenId,
    quizHistoryLoading,
    quizHistoryList,
    quizAttemptDetail,
    setQuizAttemptDetail,
    fetchQuizSets,
    toggleQuizHistoryPanel,
    openQuizAttemptDetail,
    openSavedQuizSet,
  } = quizSetsApi;
  const [open, setOpen] = useState(false);

  const [chatTitleEditing, setChatTitleEditing] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [chatTitleSaving, setChatTitleSaving] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const chatTitleInputRef = useRef(null);
  const sourceInputRef = useRef(null);
  const summaryBodyRef = useRef(null);
  const hlToolbarRef = useRef(null);
  const lastSelectionTriggerRef = useRef(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setCompactActBar(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  /** Turn off highlighter when switching summaries (same route, new id) */
  useEffect(() => {
    setHlModeActive(false);
    setHlColorMenuOpen(false);
    setPendingHighlights([]);
    setChatTitleEditing(false);
    setPendingPasteImages([]);
    setChatSelectionDraft(null);
    setPendingChatReferences([]);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, [summaryId]);

  function queueChatReference(text, message) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    setPendingChatReferences((prev) => {
      const alreadyAdded = prev.some(
        (x) => x.text.toLowerCase() === cleaned.toLowerCase(),
      );
      if (alreadyAdded) return prev;
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: cleaned.slice(0, 500),
          messageId: message?.id,
        },
      ];
      return next.slice(-5);
    });
  }

  function removePendingChatReference(refId) {
    setPendingChatReferences((prev) => prev.filter((r) => r.id !== refId));
  }

  function addDraftChatReference() {
    if (!chatSelectionDraft?.text) return;
    queueChatReference(chatSelectionDraft.text, {
      id: chatSelectionDraft.messageId,
    });
    setChatSelectionDraft(null);
    window.getSelection()?.removeAllRanges();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function openReplyPopoverFromSelection(selection, range, messageId, anchorPoint) {
    const selectedText = selection.toString().trim();
    if (!selectedText) return;
    const rectList = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 || r.height > 0,
    );
    if (rectList.length === 0) return;
    // firstRect = the first line of the selection (topmost).
    const firstRect = rectList[0];
    if (firstRect.width < 1 && firstRect.height < 1) return;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const margin = 6;
    const buttonWidth = 72;
    const buttonHeight = 36;
    // For X: center over the first line only.
    // boundingRect spans the full container width for multi-line selections,
    // which pushes the button far off the actual highlighted text.
    const selectionCenterX = firstRect.left + firstRect.width / 2;
    // For Y: always anchor to the top of the first line.
    const selectionTopY = firstRect.top;
    const nextX = Math.max(
      margin,
      Math.min(vw - buttonWidth - margin, selectionCenterX - buttonWidth / 2),
    );
    const prefersAbove = selectionTopY - buttonHeight - 6 >= margin;
    const nextY = prefersAbove
      ? selectionTopY - buttonHeight - 6
      : Math.min(vh - buttonHeight - margin, selectionTopY + firstRect.height + 4);
    setChatSelectionDraft({
      text: selectedText.replace(/\s+/g, " ").trim().slice(0, 500),
      messageId,
      x: Number.isFinite(nextX) ? nextX : margin,
      y: Number.isFinite(nextY) ? nextY : margin,
    });
  }

  function handleChatBubbleMouseUp(e, message) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const bubbleEl = e.currentTarget;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range) return;
    const startInside = bubbleEl.contains(range.startContainer);
    const endInside = bubbleEl.contains(range.endContainer);
    if (!startInside || !endInside) return;
    openReplyPopoverFromSelection(selection, range, message?.id, {
      x: e?.clientX,
      y: e?.clientY,
    });
  }

  useEffect(() => {
    if (!chatSelectionDraft) return;
    function onPointerDown(ev) {
      const target = ev.target;
      if (target instanceof Element) {
        if (target.closest(".chat-selection-popover")) return;
        if (target.closest(".m-bub")) return;
      }
      setChatSelectionDraft(null);
    }
    function onEscape(ev) {
      if (ev.key === "Escape") setChatSelectionDraft(null);
    }
    function onViewportMove(ev) {
      // Ignore scrolls that happen inside the chat/summary scroll container —
      // those are internal and should not dismiss the selection popover.
      if (ev.target instanceof Element && ev.target.closest(".unified-scroll")) return;
      setChatSelectionDraft(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onViewportMove, true);
    window.addEventListener("resize", onViewportMove);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onViewportMove, true);
      window.removeEventListener("resize", onViewportMove);
    };
  }, [chatSelectionDraft]);

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
    function onCancelHighlighter() {
      setHlModeActive(false);
      setHlColorMenuOpen(false);
      setPendingHighlights([]);
      window.getSelection()?.removeAllRanges();
    }
    window.addEventListener("s2n-cancel-highlighter", onCancelHighlighter);
    return () =>
      window.removeEventListener("s2n-cancel-highlighter", onCancelHighlighter);
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Load summary
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

  // Auto-start live summarization stream when coming from dashboard redirect (?autostart=1)
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
        let gotDone = false;

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
          } else if (event === "done") {
            gotDone = true;
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

        // Refresh summary once done (ensures DB output is in sync)
        if (!cancelled) {
          const r = await fetch(`/api/summary/${summaryId}`);
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.summary) setSummary(d.summary);
        }

        // Remove the autostart query so refresh doesn't re-trigger.
        if (!cancelled) {
          const sid = String(summaryId);
          router.replace(`/summary/${encodeURIComponent(sid)}`);
        }
      } catch (e) {
        if (!cancelled) setSummarizeError(e?.message ?? "Summarization failed");
      } finally {
        // Always clear — if `summary` were in the effect deps, each SSE chunk re-ran the effect,
        // set cancelled=true on the in-flight reader, and the previous `if (!cancelled)` skipped this,
        // leaving the UI stuck on "Generating summary…".
        setSummarizing(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId, summaryLoading, searchParams, router]);

  // Load persisted chat turns (so refresh/resume keeps the conversation)
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId) return;

    let cancelled = false;
    setMessages([]);

    async function loadChat() {
      try {
        const res = await fetch(`/api/summary/${summaryId}/chat`, {
          method: "GET",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load chat");
        if (cancelled) return;

        const dbMessages = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(
          dbMessages.map((m) => {
            const role = m.role === "assistant" ? "ai" : "user";
            if (
              role === "user" &&
              typeof m.content === "string" &&
              m.content.startsWith('{"v":1')
            ) {
              try {
                const o = JSON.parse(m.content);
                return {
                  id: m.id,
                  role: "user",
                  content: typeof o.t === "string" ? o.t : "",
                  lostPastedImageCount: Number(o.n) > 0 ? Number(o.n) : 0,
                  modelLabel: null,
                };
              } catch {
                /* fall through */
              }
            }
            return {
              id: m.id,
              role,
              content: m.content,
              modelLabel: m.role === "assistant" ? m.modelLabel : null,
            };
          }),
        );
      } catch {
        // If chat loading fails, keep the chat empty (fallback behavior).
        if (!cancelled) setMessages([]);
      }
    }

    loadChat();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  useEffect(() => {
    if (status !== "authenticated" || !summaryId) return;
    let cancelled = false;
    async function loadHl() {
      setHlLoading(true);
      try {
        const res = await fetch(`/api/summary/${summaryId}/highlights`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to load highlights");
        if (!cancelled) setHighlights(data.highlights || []);
      } catch {
        if (!cancelled) setHighlights([]);
      } finally {
        if (!cancelled) setHlLoading(false);
      }
    }
    loadHl();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId]);

  useLayoutEffect(() => {
    const root = summaryBodyRef.current;
    if (!root || !summary?.output) return;
    unwrapHighlightMarks(root);
    const pendingRows = pendingHighlights.map((p) => ({
      id: p.clientId,
      quote: p.quote,
      color: p.color,
      pending: true,
    }));
    const savedRows = highlights.map((h) => ({
      id: h.id,
      quote: h.quote,
      color: h.color,
      pending: false,
    }));
    const sorted = [...pendingRows, ...savedRows].sort(
      (a, b) => a.quote.length - b.quote.length,
    );
    for (const h of sorted) {
      const c =
        h.color && /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : DEFAULT_HL_HEX;
      wrapQuoteInRoot(root, h.quote, h.id, c, h.pending);
    }
  }, [summaryHtml, highlights, pendingHighlights]);

  useEffect(() => {
    function onDocDown(e) {
      if (hlToolbarRef.current?.contains(e.target)) return;
      setHlColorMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (pendingHighlights.length === 0) return;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingHighlights.length]);

  // Extract headings from markdown and broadcast for sidebar navigation
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

  // Handle jump-to-heading requests from sidebar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const id = e.detail;
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("s2n-jump-to-heading", handler);
    return () => window.removeEventListener("s2n-jump-to-heading", handler);
  }, []);

  function handleCopySummary() {
    const text = summary?.output?.trim();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    });
  }

  function handleCopyMessage(m) {
    const text = (m?.content || "").trim();
    const imgN =
      (m?.imagePreviews?.length || 0) + (m?.lostPastedImageCount || 0);
    if (!text && !imgN) return;
    const clip =
      text +
      (imgN
        ? `${text ? "\n\n" : ""}[${imgN} image(s) in this message — copy text only]`
        : "");
    navigator.clipboard?.writeText(clip).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  async function addPastedImageFromFile(file) {
    if (!file?.type?.startsWith("image/")) return;
    try {
      const dataUrl = await downscaleImageFileToJpegDataUrl(file);
      const clientId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      let added = false;
      setPendingPasteImages((p) => {
        if (p.length >= MAX_CHAT_PASTE_IMAGES) return p;
        added = true;
        return [...p, { clientId, dataUrl }];
      });
      if (added) setChatNotice("");
      else {
        setChatNotice(
          `You can attach at most ${MAX_CHAT_PASTE_IMAGES} images per message.`,
        );
      }
    } catch {
      setChatNotice(
        "Could not add image. Try a different file or smaller image.",
      );
    }
  }

  async function addChatImagesFromFileList(fileList) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    for (const file of files) {
      await addPastedImageFromFile(file);
    }
  }

  async function handleAttachmentFilesSelected(fileList) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const docs = files.filter((f) => !f.type.startsWith("image/"));
    if (docs.length) handleSourceUpload(docs);
    if (images.length) await addChatImagesFromFileList(images);
  }

  function removePendingPasteByClientId(clientId) {
    setPendingPasteImages((p) => p.filter((x) => x.clientId !== clientId));
  }

  async function appendAssistantReplyGradually(reply, modelLabel, webSearch = null) {
    const text = String(reply || "");
    const msgId = Date.now() + 1;
    setMessages((p) => [
      ...p,
      {
        id: msgId,
        role: "ai",
        content: "",
        modelLabel,
        ...(webSearch ? { webSearch } : {}),
      },
    ]);

    const pieces = text.match(/.{1,16}(\s+|$)/g) || [text];
    for (const piece of pieces) {
      setMessages((p) =>
        p.map((m) =>
          m.id === msgId ? { ...m, content: `${m.content || ""}${piece}` } : m,
        ),
      );
      await new Promise((r) => setTimeout(r, 14));
    }
  }

  async function sendMessage(text) {
    const msg = (text ?? inputVal).trim();
    const refSnapshot = pendingChatReferences;
    const referencesBlock =
      refSnapshot.length > 0
        ? `Referenced chat excerpts:\n${refSnapshot
            .map((r, i) => `${i + 1}. "${r.text}"`)
            .join("\n")}`
        : "";
    const apiContent = referencesBlock
      ? `${referencesBlock}${msg ? `\n\nUser request: ${msg}` : ""}`
      : msg;
    if (
      (!msg &&
        refSnapshot.length === 0 &&
        pendingPasteImages.length === 0 &&
        pendingSourceFiles.length === 0) ||
      chatLoading ||
      sourceUploadLoading
    )
      return;
    if (!summary?.output) return;
    const threadHasInlineImages = messages.some(
      (m) => m.role === "user" && (m.imagePreviews?.length || 0) > 0,
    );
    if (
      chatModel === "DeepSeek" &&
      (pendingPasteImages.length > 0 || threadHasInlineImages)
    ) {
      setChatNotice(
        "DeepSeek cannot view pasted images in this thread. Choose ChatGPT or Gemini, or refresh if you no longer need image context.",
      );
      return;
    }
    setChatNotice("");
    setInputVal("");
    setChatSelectionDraft(null);
    setPendingChatReferences([]);
    const pasteSnapshot = pendingPasteImages.map((x) => x.dataUrl);
    const stagedDocSnapshot = pendingSourceFiles.map((f) => ({
      name: f.name,
      type: f.type,
    }));
    setPendingPasteImages([]);
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: msg,
      ...(refSnapshot.length > 0 ? { references: refSnapshot } : {}),
      ...(apiContent ? { apiContent } : {}),
      ...(pasteSnapshot.length > 0 ? { imagePreviews: pasteSnapshot } : {}),
      ...(stagedDocSnapshot.length > 0
        ? { attachedFiles: stagedDocSnapshot }
        : {}),
    };
    const historyPayload = [...messages, userMsg].map(chatMessageToApiPayload);
    const modelParam = mapChatModelToApi(chatModel);
    setMessages((p) => [...p, userMsg]);
    setChatLoading(true);
    try {
      // Upload staged attachments right before sending (ChatGPT-like "upload on send").
      let nextExtraSources = extraSources;
      if (pendingSourceFiles.length > 0) {
        setSourceUploadLoading(true);
        try {
          const formData = new FormData();
          pendingSourceFiles.forEach((p) => formData.append("files", p.file));
          const upRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const upData = await upRes.json().catch(() => ({}));
          if (!upRes.ok) {
            throw new Error(upData?.error || "Attachment upload failed");
          }
          const docs = Array.isArray(upData?.documents) ? upData.documents : [];
          const baseIds = new Set(
            (summary?.files || []).map((d) => d?.id).filter(Boolean),
          );
          const existing = new Set(
            nextExtraSources.map((d) => d?.id).filter(Boolean),
          );
          const merged = docs.filter((d) => {
            if (!d?.id) return false;
            if (baseIds.has(d.id)) return false;
            if (existing.has(d.id)) return false;
            return true;
          });
          nextExtraSources = [...nextExtraSources, ...merged];
          setExtraSources(nextExtraSources);
          setPendingSourceFiles([]);
        } finally {
          setSourceUploadLoading(false);
        }
      }

      const attachedDocumentIds = nextExtraSources
        .map((d) => d?.id)
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: Number(summaryId),
          model: modelParam,
          modelLabel: chatModel,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Chat request failed");
      }
      const reply = (data?.reply || "").trim();
      if (!reply) throw new Error("Empty reply from assistant");
      const ws =
        data?.webSearch && typeof data.webSearch === "object"
          ? data.webSearch
          : null;
      await appendAssistantReplyGradually(reply, chatModel, ws);
    } catch (e) {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          role: "ai",
          content:
            e?.message ??
            "Something went wrong (including possible attachment upload). Please try again.",
          error: true,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function regenerateLastResponse() {
    if (chatLoading || sourceUploadLoading || !summary?.output) return;
    const threadHasInlineImages = messages.some(
      (m) => m.role === "user" && (m.imagePreviews?.length || 0) > 0,
    );
    if (chatModel === "DeepSeek" && threadHasInlineImages) {
      setChatNotice(
        "Regenerate is unavailable with DeepSeek while this thread still has pasted image previews.",
      );
      return;
    }
    const idx = messages.length - 1;
    const last = messages[idx];
    if (!last || last.role !== "ai" || last.error) return;
    const prev = messages[idx - 1];
    if (!prev || prev.role !== "user") return;

    const removed = last;
    const historyPayload = messages.slice(0, -1).map(chatMessageToApiPayload);
    const modelParam = mapChatModelToApi(chatModel);

    setChatNotice("");
    setMessages((p) => p.slice(0, -1));
    setChatLoading(true);
    try {
      const attachedDocumentIds = extraSources
        .map((d) => d?.id)
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: Number(summaryId),
          model: modelParam,
          modelLabel: chatModel,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
          regenerate: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Regenerate failed");
      }
      const reply = (data?.reply || "").trim();
      if (!reply) throw new Error("Empty reply from assistant");
      const ws =
        data?.webSearch && typeof data.webSearch === "object"
          ? data.webSearch
          : null;
      await appendAssistantReplyGradually(reply, chatModel, ws);
    } catch (e) {
      setMessages((p) => [...p, removed]);
      setChatNotice(
        (e?.message || "Could not regenerate. Try again.").toString(),
      );
    } finally {
      setChatLoading(false);
    }
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

  function handlePDF() {
    if (!summary) return;
    setPdfLoading(true);
    exportSummaryPdf(summary, messages, summaryBodyRef.current?.innerHTML || "");
    setTimeout(() => setPdfLoading(false), 900);
  }

  async function openSourceDocPreview(doc, e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (!doc?.id) return;
    setMobileMoreOpen(false);
    setSourcePreviewDoc(doc);
    setSourcePreviewSetupErr("");
    setSourcePreviewSrc("");
    setSourcePreviewTabHref(
      `${typeof window !== "undefined" ? window.location.origin : ""}/api/documents/${doc.id}/view`,
    );
    setSourcePreviewIframeLoading(true);
    setSourcePreviewTokenLoading(true);
    setSourcePreviewOpen(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const basePath = `/api/documents/${doc.id}/view`;

    try {
      if (isOfficePreviewName(doc.name)) {
        const res = await fetch(`/api/documents/${doc.id}/view-token`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not prepare preview");
        const viewUrl = `${origin}${basePath}?t=${encodeURIComponent(data.token)}`;
        const enc = encodeURIComponent(viewUrl);
        setSourcePreviewSrc(
          `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`,
        );
        setSourcePreviewTabHref(
          `https://view.officeapps.live.com/op/view.aspx?src=${enc}`,
        );
      } else {
        setSourcePreviewSrc(`${origin}${basePath}?v=${Date.now()}`);
        setSourcePreviewTabHref(`${origin}${basePath}`);
      }
    } catch (err) {
      setSourcePreviewSetupErr(err?.message || String(err));
      setSourcePreviewIframeLoading(false);
    } finally {
      setSourcePreviewTokenLoading(false);
    }
  }

  function closeSourceDocPreview() {
    setSourcePreviewOpen(false);
    setSourcePreviewDoc(null);
    setSourcePreviewSrc("");
    setSourcePreviewTabHref("");
    setSourcePreviewIframeLoading(true);
    setSourcePreviewTokenLoading(false);
    setSourcePreviewSetupErr("");
  }

  const handleSummarySelectionTrigger = useCallback((anchorPoint = null) => {
    const root = summaryBodyRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text || text.length > 2000) return;
    const range = sel.getRangeAt(0);
    const startInside = root.contains(range.startContainer);
    const endInside = root.contains(range.endContainer);
    if (!startInside || !endInside) return;
    if (!hlModeActive) {
      openReplyPopoverFromSelection(sel, range, null, anchorPoint);
      return;
    }
    if (hlSaving) return;
    const clientId = `p-${crypto.randomUUID()}`;
    setPendingHighlights((prev) => [
      { clientId, quote: text, color: hlColorHex },
      ...prev,
    ]);
    window.getSelection()?.removeAllRanges();
  }, [hlModeActive, hlSaving, hlColorHex]);

  const handleSummaryMouseUp = useCallback(
    (e) => {
      const anchorPoint = {
        x:
          Number.isFinite(e?.clientX) && e.clientX > 0
            ? e.clientX
            : Number.isFinite(e?.changedTouches?.[0]?.clientX)
              ? e.changedTouches[0].clientX
              : null,
        y:
          Number.isFinite(e?.clientY) && e.clientY > 0
            ? e.clientY
            : Number.isFinite(e?.changedTouches?.[0]?.clientY)
              ? e.changedTouches[0].clientY
              : null,
      };
      const now = Date.now();
      if (now - lastSelectionTriggerRef.current < 350) return;
      lastSelectionTriggerRef.current = now;

      const isTouch =
        (e && e.pointerType === "touch") || (e && e.type === "touchend");

      // On touch devices the selection can finalize slightly after the event.
      if (isTouch) {
        setTimeout(() => handleSummarySelectionTrigger(anchorPoint), 0);
      } else {
        handleSummarySelectionTrigger(anchorPoint);
      }
    },
    [handleSummarySelectionTrigger],
  );

  async function flushPendingHighlights() {
    if (!summaryId || hlSaving || pendingHighlights.length === 0) return;
    const queue = [...pendingHighlights];
    setHlSaving(true);
    const created = [];
    const stillPending = [];
    try {
      for (const p of queue) {
        const res = await fetch(`/api/summary/${summaryId}/highlights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: p.quote, color: p.color }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.highlight) {
          stillPending.push(p);
          continue;
        }
        created.push(data.highlight);
      }
      if (created.length) {
        setHighlights((prev) => [...created, ...prev]);
      }
      setPendingHighlights(stillPending);
      if (stillPending.length) {
        alert(
          stillPending.length === queue.length
            ? queue.length === 1
              ? "Could not save the highlight. Please try again."
              : "Could not save highlights. Please try again."
            : `Saved ${created.length} highlight(s); ${stillPending.length} could not be saved.`,
        );
      }
    } finally {
      setHlSaving(false);
    }
  }

  function removePendingHighlight(clientId) {
    setPendingHighlights((prev) => prev.filter((p) => p.clientId !== clientId));
  }

  async function deleteHighlight(hid) {
    try {
      const res = await fetch(`/api/summary/${summaryId}/highlights/${hid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setHighlights((p) => p.filter((h) => h.id !== hid));
    } catch (e) {
      alert(e?.message ?? "Could not remove highlight");
    }
  }

  function scrollToHighlight(hid) {
    const id = String(hid);
    const safe =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(id)
        : id.replace(/"/g, '\\"');
    const el = document.querySelector(`mark.s2n-hl[data-hl-id="${safe}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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

  const chatSuggestions = useMemo(() => {
    if (aiChatSuggestions.length > 0) return aiChatSuggestions;
    return buildChatSuggestions({
      markdown: summary?.output || "",
      headings,
      title: summary?.title || "",
      max: 4,
    });
  }, [aiChatSuggestions, summary?.output, summary?.title, headings]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!summaryId || !summary?.output) {
      setAiChatSuggestions([]);
      return;
    }
    let cancelled = false;
    async function loadAiSuggestions() {
      try {
        const res = await fetch(`/api/summary/${summaryId}/chat-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max: 4 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.error || "Failed to load suggestions");
        const next = Array.isArray(data?.suggestions) ? data.suggestions : [];
        if (!cancelled) setAiChatSuggestions(next);
      } catch {
        if (!cancelled) setAiChatSuggestions([]);
      }
    }
    loadAiSuggestions();
    return () => {
      cancelled = true;
    };
  }, [status, summaryId, summary?.output]);

  function fileExtUpper(name) {
    const parts = String(name || "").split(".");
    const ext = parts.length > 1 ? parts[parts.length - 1] : "";
    return ext ? ext.toUpperCase() : "FILE";
  }

  function handleSourceUpload(files) {
    // Stage files locally; actual upload happens when user presses Send.
    if (!files || !files.length) return;
    const incoming = Array.from(files).map((f) => ({
      clientId: `local-${crypto.randomUUID()}`,
      file: f,
      name: f.name,
      type: fileExtUpper(f.name),
    }));
    setPendingSourceFiles((prev) => {
      const names = new Set(prev.map((p) => p.name));
      const deduped = incoming.filter((p) => !names.has(p.name));
      return [...prev, ...deduped];
    });
  }

  function removePendingSourceByClientId(clientId) {
    setPendingSourceFiles((prev) =>
      prev.filter((p) => p.clientId !== clientId),
    );
  }

  return (
    <>
      <div className="wrap">
        <div className="atm">
          <div className="atm-a" />
          <div className="atm-b" />
        </div>

        <div className="body">
          {/* ── Main + Sources ── */}
          <div className="main-wrap">
            <main className="main">
              {/* Action bar */}
              <div className="act-bar">
                <div className="act-bar-title-wrap">
                  {!summaryLoading && !summaryError && summary && (
                    <>
                      {chatTitleEditing ? (
                        <input
                          ref={chatTitleInputRef}
                          type="text"
                          className="act-bar-chat-title-inp"
                          value={chatTitleDraft}
                          onChange={(e) => setChatTitleDraft(e.target.value)}
                          onBlur={() => saveChatTitle()}
                          onKeyDown={onChatTitleKeyDown}
                          disabled={chatTitleSaving}
                          maxLength={255}
                          aria-label="Chat title"
                        />
                      ) : (
                        <button
                          type="button"
                          className="act-bar-chat-title-btn"
                          onClick={startChatTitleEdit}
                          disabled={chatTitleSaving}
                          title="Click to rename"
                        >
                          {summary.title?.trim()
                            ? summary.title
                            : "Untitled summary"}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="act-bar-btns">
                  <Button variant="quiz" onClick={() => setQuizModal(true)}>
                    <QuizIco /> {compactActBar ? "Quiz" : "Generate Quiz"}
                  </Button>
                  <Button
                    variant="pdf"
                    onClick={handlePDF}
                    disabled={pdfLoading || !summary}
                  >
                    {pdfLoading ? (
                      <Spinner size={compactActBar ? 11 : 13} />
                    ) : (
                      <PdfIco />
                    )}{" "}
                    {compactActBar ? "PDF" : "Save as PDF"}
                  </Button>
                  <Button variant="slides" onClick={() => setSlidesModal(true)}>
                    <SlidesIco /> {compactActBar ? "Slides" : "Generate Slides"}
                  </Button>
                </div>
              </div>

              {/* Card: summary + chat */}
              <div className="card">
                <div className="sum-head">
                  <div className="sum-left">
                    <div className="sum-title">Your summarized content</div>
                    <div className="sum-tags">
                      <span className="tag tag-m">{summary?.model ?? "—"}</span>
                      <span
                        className={`tag ${summary?.summarizeFor === "lecturer" ? "tag-lec" : "tag-stu"}`}
                      >
                        {summary?.summarizeFor ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="sum-right">
                    <div className="sum-head-actions">
                      <button
                        type="button"
                        className={`sum-copy-btn ${summaryCopied ? "copied" : ""}`}
                        title={summaryCopied ? "Copied!" : "Copy summary"}
                        onClick={handleCopySummary}
                        disabled={summaryLoading || !summary?.output}
                        aria-label="Copy summary"
                      >
                        {summaryCopied ? (
                          <span className="sum-copy-txt">Copied</span>
                        ) : (
                          <CopyIco size={12} />
                        )}
                      </button>
                      <div className="sum-hl-wrap" ref={hlToolbarRef}>
                        <button
                          type="button"
                          className={`sum-hl-main ${hlModeActive ? "on" : ""}`}
                          title={
                            hlModeActive
                              ? "Highlight on — drag to select text in the summary, then save highlights in the sidebar"
                              : "Highlight — turn on, pick a color, select text in the summary to mark it"
                          }
                          aria-pressed={hlModeActive}
                          aria-label={
                            hlModeActive
                              ? "Highlight mode on; select text in the summary"
                              : "Turn on highlight mode to mark text in the summary"
                          }
                          disabled={summaryLoading || !summary?.output}
                          onClick={() => {
                            setHlModeActive((v) => !v);
                            setHlColorMenuOpen(false);
                          }}
                        >
                          <HighlightIco size={13} />
                          <span className="sum-hl-main-txt">Highlight</span>
                        </button>
                        <button
                          type="button"
                          className={`sum-hl-chevron ${hlColorMenuOpen ? "open" : ""}`}
                          title="Highlight color"
                          aria-expanded={hlColorMenuOpen}
                          aria-haspopup="true"
                          disabled={summaryLoading || !summary?.output}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setHlColorMenuOpen((v) => !v);
                          }}
                        >
                          <Chevron open={hlColorMenuOpen} />
                        </button>
                        {hlColorMenuOpen && (
                          <div
                            className="sum-hl-menu"
                            role="menu"
                            aria-label="Highlight colors"
                          >
                            <div className="sum-hl-menu-label">Color</div>
                            <div className="sum-hl-swatch-row">
                              {HIGHLIGHT_PRESETS.map((p) => (
                                <button
                                  key={p.hex}
                                  type="button"
                                  role="menuitem"
                                  title={p.label}
                                  className={`sum-hl-swatch ${hlColorHex === p.hex ? "cur" : ""}`}
                                  style={{ backgroundColor: p.hex }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setHlColorHex(p.hex);
                                    setHlModeActive(true);
                                    setHlColorMenuOpen(false);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mobile-only: three-dot "More" button → bottom sheet with full right panel */}
                      <button
                        type="button"
                        className="mob-more-btn"
                        title="More — sources, slide decks, quizzes, highlights"
                        aria-label="More options"
                        onClick={() => setMobileMoreOpen(true)}
                        disabled={summaryLoading || !summary?.output}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <circle cx="3" cy="8" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="13" cy="8" r="1.5" />
                        </svg>
                        {pendingHighlights.length > 0 && (
                          <span className="hl-list-badge">
                            {Math.min(99, pendingHighlights.length)}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="sum-files">
                      {summary?.files?.map?.((f) => (
                        <span key={f.id} className="fchip">
                          <DocIco ext={f.type} />
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="unified-scroll">
                  {summaryLoading ? (
                    <div className="sum-text" style={{ paddingTop: 8 }}>
                      Loading summary...
                    </div>
                  ) : summaryError ? (
                    <div className="sum-text" style={{ paddingTop: 8 }}>
                      Error: {summaryError}
                    </div>
                  ) : (
                    <>
                      <div
                        className={`hl-select-ctx${hlModeActive ? " hl-mode-active" : ""}`}
                        style={
                          hlModeActive
                            ? { ["--hl-pick"]: hlColorHex }
                            : undefined
                        }
                      >
                        <div
                          ref={summaryBodyRef}
                          role="article"
                          className="sum-text md sum-selectable"
                          style={SUMMARY_BODY_INNER_STYLE}
                          onMouseUp={handleSummaryMouseUp}
                          onPointerUp={handleSummaryMouseUp}
                          onTouchEnd={handleSummaryMouseUp}
                          dangerouslySetInnerHTML={summaryBodyDangerousHtml}
                        />
                      </div>
                      <div className="sum-gen-meta">
                        Generated by {formatSummaryModelLabel(summary?.model)} ·{" "}
                        {fmtDate(summary?.createdAt)}
                      </div>
                    </>
                  )}

                  {(messages.length > 0 || chatLoading) && (
                    <div className="conv-divider">
                      <div className="conv-label">
                        Continue the conversation
                      </div>
                      <div className="chat-thread">
                        {messages.map((m, i) => {
                          const showRegen =
                            m.role === "ai" &&
                            !m.error &&
                            i === messages.length - 1 &&
                            !chatLoading;
                          return (
                            <div key={m.id} className={`m-row ${m.role}`}>
                              <div className={`m-ava ${m.role}`}>
                                {m.role === "ai" ? <BotIco /> : <UserIco />}
                              </div>
                              <div className="m-bub-wrap">
                                <div className="m-bub-col">
                                  <div
                                    className={`m-bub ${m.role} ${m.error ? "err" : ""} md`}
                                    onMouseUp={(e) =>
                                      handleChatBubbleMouseUp(e, m)
                                    }
                                  >
                                    {m.role === "user" &&
                                      Array.isArray(m.attachedFiles) &&
                                      m.attachedFiles.length > 0 && (
                                        <div className="chat-msg-files">
                                          {m.attachedFiles.map((f, ii) => (
                                            <div
                                              key={`${f.name}-${ii}`}
                                              className="chat-msg-file-chip"
                                              title={f.name}
                                            >
                                              <DocIco ext={f.type} size={14} />
                                              <span className="file-name">
                                                {f.name}
                                              </span>
                                              <span className="file-type">
                                                {String(
                                                  f.type || "file",
                                                ).toUpperCase()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    {m.role === "user" &&
                                      m.imagePreviews &&
                                      m.imagePreviews.length > 0 && (
                                        <div className="chat-msg-images">
                                          {m.imagePreviews.map((src, ii) => (
                                            <img key={ii} src={src} alt="" />
                                          ))}
                                        </div>
                                      )}
                                    {m.role === "user" &&
                                      (m.lostPastedImageCount || 0) > 0 && (
                                        <div className="chat-img-lost-note">
                                          {m.lostPastedImageCount} pasted image
                                          {m.lostPastedImageCount === 1
                                            ? ""
                                            : "s"}{" "}
                                          in this message (previews are not kept
                                          after refresh)
                                        </div>
                                      )}
                                    {(() => {
                                      const raw = (m.content || "").trim();
                                      const hidePlaceholder =
                                        m.role === "user" &&
                                        raw === "[Image message]" &&
                                        ((m.imagePreviews?.length || 0) > 0 ||
                                          (m.lostPastedImageCount || 0) > 0);
                                      const mdSrc = hidePlaceholder
                                        ? ""
                                        : m.content || "";
                                      if (
                                        m.role === "user" &&
                                        !mdSrc.trim() &&
                                        ((m.imagePreviews?.length || 0) > 0 ||
                                          (m.lostPastedImageCount || 0) > 0)
                                      ) {
                                        return null;
                                      }
                                      return (
                                        <ChatBubbleContent mdSrc={mdSrc} />
                                      );
                                    })()}
                                    {m.role === "user" &&
                                      Array.isArray(m.references) &&
                                      m.references.length > 0 && (
                                        <div className="chat-msg-references">
                                          {m.references.map((r) => (
                                            <div
                                              key={r.id || `${m.id}-${r.text}`}
                                              className="chat-msg-reference-chip"
                                              title={r.text}
                                            >
                                              <span className="ref-text">
                                                {r.text}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                  {m.role === "ai" &&
                                    m.modelLabel &&
                                    !m.error && (
                                      <div className="m-meta">
                                        Generated by {m.modelLabel}
                                      </div>
                                    )}
                                  {/* Web fallback is automatic; keep UI clean like ChatGPT. */}
                                </div>
                                {m.role === "ai" &&
                                  (m.content || "").trim() && (
                                    <div className="m-bub-side-actions">
                                      {showRegen && (
                                        <button
                                          type="button"
                                          className="m-copy"
                                          title="Regenerate response"
                                          onClick={() =>
                                            regenerateLastResponse()
                                          }
                                          aria-label="Regenerate response"
                                        >
                                          <RegenIco size={12} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className={`m-copy ${copiedId === m.id ? "copied" : ""}`}
                                        title={
                                          copiedId === m.id ? "Copied!" : "Copy"
                                        }
                                        onClick={() => handleCopyMessage(m)}
                                        aria-label="Copy message"
                                      >
                                        {copiedId === m.id ? (
                                          <span className="m-copy-txt">
                                            Copied
                                          </span>
                                        ) : (
                                          <CopyIco size={12} />
                                        )}
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                        {chatLoading && (
                          <div className="m-row ai">
                            <div className="m-ava ai">
                              <BotIco />
                            </div>
                            <div className="m-bub ai">
                              <div className="dots">
                                <div className="dot" />
                                <div className="dot" />
                                <div className="dot" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {messages.length === 0 && !chatLoading && (
                    <>
                      <div className="chat-hint">
                        <div className="chat-empty">
                          <BotIco />
                          <span>
                            Continue below — your replies stay in this thread
                            with the summary above.
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {messages.length > 0 &&
                    summary?.output &&
                    chatSuggestions.length > 0 && (
                      <div
                        className="suggests suggests--end-chat"
                        role="group"
                        aria-label="Suggested questions from this summary"
                      >
                        {chatSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="sug"
                            onClick={() => {
                              setInputVal(s);
                              requestAnimationFrame(() =>
                                inputRef.current?.focus(),
                              );
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                  <div ref={bottomRef} />
                </div>

                {chatNotice ? (
                  <div className="chat-notice" role="status">
                    {chatNotice}
                  </div>
                ) : null}

                {/* Input */}
                <div className="inp-row">
                  <input
                    ref={sourceInputRef}
                    type="file"
                    multiple
                    accept={ATTACH_ACCEPT}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      void handleAttachmentFilesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div
                    className={`chatbox ${pendingSourceFiles.length > 0 || pendingPasteImages.length > 0 ? "with-files" : ""}`}
                  >
                    <button
                      type="button"
                      className="attach-btn"
                      title="Add attachment (documents or images)"
                      aria-label="Add attachment"
                      disabled={sourceUploadLoading || chatLoading}
                      onClick={() => sourceInputRef.current?.click()}
                    >
                      {sourceUploadLoading ? (
                        <Spinner size={12} />
                      ) : (
                        <ClipIco size={16} />
                      )}
                      {pendingSourceFiles.length > 0 && (
                        <span className="attach-badge">
                          {Math.min(99, pendingSourceFiles.length)}
                        </span>
                      )}
                    </button>
                    <span className="attach-divider" aria-hidden />
                    <div className="chatbox-main">
                      {(pendingSourceFiles.length > 0 ||
                        pendingPasteImages.length > 0 ||
                        pendingChatReferences.length > 0) && (
                        <div
                          className="chat-uploads"
                          aria-label="Attached files and references"
                        >
                          {pendingChatReferences.map((r, i) => (
                            <div
                              key={r.id}
                              className="chat-upload-chip chat-reference-chip"
                              title={r.text}
                            >
                              <div className="chat-upload-badge" aria-hidden>
                                #
                              </div>
                              <div className="chat-upload-content">
                                <span className="chat-upload-name">
                                  {r.text}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="chat-upload-rm"
                                onClick={() => removePendingChatReference(r.id)}
                                aria-label={`Remove reference ${i + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {pendingPasteImages.map((p, pi) => (
                            <div
                              key={p.clientId}
                              className="chat-upload-chip chat-paste-chip"
                              title={`Image ${pi + 1}`}
                            >
                              <div className="chat-upload-badge" aria-hidden>
                                <span className="chat-paste-ico" />
                              </div>
                              <div className="chat-upload-content chat-upload-content-single">
                                <span className="chat-upload-name">
                                  Image {pi + 1}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="chat-upload-rm"
                                onClick={() =>
                                  removePendingPasteByClientId(p.clientId)
                                }
                                aria-label={`Remove image ${pi + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {pendingSourceFiles.map((f) => (
                            <div
                              key={f.clientId}
                              className="chat-upload-chip"
                              title={f.name}
                            >
                              <div className="chat-upload-badge" aria-hidden>
                                <DocIco ext={f.type} size={18} />
                              </div>
                              <div className="chat-upload-content">
                                <span className="chat-upload-name">
                                  {f.name}
                                </span>
                                <span className="chat-upload-type">
                                  {f.type}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="chat-upload-rm"
                                onClick={() =>
                                  removePendingSourceByClientId(f.clientId)
                                }
                                aria-label={`Remove ${f.name}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="chatbox-row">
                        <input
                          ref={inputRef}
                          className="inp"
                          placeholder="Refine your summary or ask question..."
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items?.length) return;
                            for (const item of items) {
                              if (
                                item.kind === "file" &&
                                item.type.startsWith("image/")
                              ) {
                                const file = item.getAsFile();
                                if (file) {
                                  e.preventDefault();
                                  void addPastedImageFromFile(file);
                                  break;
                                }
                              }
                            }
                          }}
                          onKeyDown={(e) =>
                            e.key === "Enter" && !e.shiftKey && sendMessage()
                          }
                          disabled={chatLoading || sourceUploadLoading}
                        />
                        <div className="mdl-wrap">
                          <button
                            className={`mdl-btn ${modelOpen ? "open" : ""}`}
                            onClick={() => setModelOpen((v) => !v)}
                            onBlur={() =>
                              setTimeout(() => setModelOpen(false), 150)
                            }
                            disabled={chatLoading || sourceUploadLoading}
                          >
                            {chatModel} <Chevron open={modelOpen} />
                          </button>
                          {modelOpen && (
                            <div className="mdl-menu">
                              {MODELS.map((m) => (
                                <div
                                  key={m}
                                  className={`mdl-opt ${chatModel === m ? "on" : ""}`}
                                  onMouseDown={() => {
                                    setChatModel(m);
                                    setModelOpen(false);
                                  }}
                                >
                                  {m} {chatModel === m && "✓"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="send-btn send-btn--inline"
                      onClick={() => sendMessage()}
                      disabled={
                        chatLoading ||
                        sourceUploadLoading ||
                        (!inputVal.trim() &&
                          pendingChatReferences.length === 0 &&
                          pendingPasteImages.length === 0 &&
                          pendingSourceFiles.length === 0) ||
                        !summary?.output
                      }
                    >
                      {chatLoading || sourceUploadLoading ? (
                        <Spinner size={14} />
                      ) : (
                        <SendIco />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {/* /card */}
            </main>

            <SourcesSidebar
              sourcesWidth={sourcesWidth}
              onSplitterMouseDown={onSplitterMouseDown}
              summary={summary}
              extraSources={extraSources}
              onSourcePreview={openSourceDocPreview}
              slideDecksProps={{
                slideDecks,
                slideDecksLoading,
                slideDeckDeletingId,
                onRefresh: () => void fetchSlideDecks(),
                onPreview: openSlideDeckPreview,
                onDownload: downloadSlideDeck,
                onDelete: deleteSlideDeck,
              }}
              quizSetsProps={{
                quizSets,
                quizSetsLoading,
                quizSetOpeningId,
                quizHistoryOpenId,
                quizHistoryLoading,
                quizHistoryList,
                onRefresh: () => void fetchQuizSets(),
                onToggleHistory: toggleQuizHistoryPanel,
                onOpenSet: openSavedQuizSet,
                onOpenAttempt: openQuizAttemptDetail,
              }}
              highlightsProps={{
                highlights,
                pendingHighlights,
                hlLoading,
                hlSaving,
                onSave: () => void flushPendingHighlights(),
                onRemovePending: removePendingHighlight,
                onDelete: deleteHighlight,
                onScrollTo: scrollToHighlight,
              }}
            />
          </div>
        </div>
      </div>
      <SummaryModalStack
        slidesModal={slidesModal}
        setSlidesModal={setSlidesModal}
        summary={summary}
        summaryId={summaryId}
        fetchSlideDecks={fetchSlideDecks}
        slideDeckPreviewOpen={slideDeckPreviewOpen}
        setSlideDeckPreviewOpen={setSlideDeckPreviewOpen}
        slideDeckPreviewUrl={slideDeckPreviewUrl}
        slideDeckRemotePptUrl={slideDeckRemotePptUrl}
        slideDeckPreviewTitle={slideDeckPreviewTitle}
        slideDeckDlRef={slideDeckDlRef}
        quizModal={quizModal}
        setQuizModal={setQuizModal}
        setQuizData={setQuizData}
        setQuizSettings={setQuizSettings}
        setQuizView={setQuizView}
        fetchQuizSets={fetchQuizSets}
        quizView={quizView}
        quizData={quizData}
        quizSettings={quizSettings}
        setQuizViewState={setQuizView}
      />

      {sourcePreviewOpen && sourcePreviewDoc && (
        <DocumentPreviewModal
          doc={sourcePreviewDoc}
          onClose={closeSourceDocPreview}
          formatBytes={formatBytes}
          docPreviewTabHref={sourcePreviewTabHref}
          docPreviewSrc={sourcePreviewSrc}
          docPreviewTokenLoading={sourcePreviewTokenLoading}
          docPreviewIframeLoading={sourcePreviewIframeLoading}
          docPreviewSetupErr={sourcePreviewSetupErr}
          onPreviewIframeLoad={() => {
            setTimeout(() => setSourcePreviewIframeLoading(false), 650);
          }}
        />
      )}

      <QuizAttemptDetailModal
        detail={quizAttemptDetail}
        onClose={() => setQuizAttemptDetail(null)}
      />

      {/* ── Mobile "More" bottom sheet ── */}
      <MobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        summary={summary}
        extraSources={extraSources}
        onSourcePreview={openSourceDocPreview}
        slideDecksProps={{
          slideDecks,
          slideDecksLoading,
          slideDeckDeletingId,
          onRefresh: () => void fetchSlideDecks(),
          onPreview: openSlideDeckPreview,
          onDownload: downloadSlideDeck,
          onDelete: deleteSlideDeck,
        }}
        quizSetsProps={{
          quizSets,
          quizSetsLoading,
          quizSetOpeningId,
          quizHistoryOpenId,
          quizHistoryLoading,
          quizHistoryList,
          onRefresh: () => void fetchQuizSets(),
          onToggleHistory: toggleQuizHistoryPanel,
          onOpenSet: openSavedQuizSet,
          onOpenAttempt: openQuizAttemptDetail,
        }}
        highlightsProps={{
          highlights,
          pendingHighlights,
          hlLoading,
          hlSaving,
          onSave: () => void flushPendingHighlights(),
          onRemovePending: removePendingHighlight,
          onDelete: deleteHighlight,
          onScrollTo: scrollToHighlight,
        }}
      />

      {/* Chat selection reply popover — rendered at the top level of the fragment,
          OUTSIDE .card, so that position:fixed is relative to the viewport.
          .card has backdrop-filter:blur() which creates a CSS containing block
          and breaks fixed positioning for any descendants. */}
      <ChatSelectionPopover
        draft={chatSelectionDraft}
        onReply={addDraftChatReference}
      />
    </>
  );
}