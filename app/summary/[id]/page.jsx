"use client";

import "./summary-page.css";
import "./flashcard-manual.css";
import "./components/ReferencesPanel.css";

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
import { enrichSummaryBodyHtml } from "@/lib/citationHtml";
import {
  splitMarkdownBeforeReferences,
  buildReferencesSectionHtml,
  syntheticUploadReference,
} from "@/lib/referenceDisplay";
import {
  buildMarkerAnchorMap,
  extractCitationMarkers,
  filterReferencesToCitedInBody,
} from "@/lib/referenceUtils";
import CitationPreviewPopover from "./components/CitationPreviewPopover";
import { buildChatSuggestions } from "@/lib/chatSuggestionsFromSummary";
import Button from "@/app/components/ui/Button";
import DocumentPreviewModal from "@/app/dashboard/components/DocumentPreviewModal";
import { formatBytes, isOfficePreviewName } from "@/app/dashboard/helpers";
import { uploadDocumentsViaClient } from "@/lib/clientDocumentUpload";
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
import { unwrapHighlightMarks, wrapQuoteInRoot } from "./hooks/highlightDom";
import ChatBubbleContent from "./components/ChatBubbleContent";
import ChatSourcesList from "./components/ChatSourcesList";
import ChatSelectionPopover from "./components/ChatSelectionPopover";
import QuizAttemptDetailModal from "./components/QuizAttemptDetailModal";
import SourcesSidebar from "./components/SourcesSidebar";
import MobileMoreSheet from "./components/MobileMoreSheet";
import { useSourcesPanelResize } from "./hooks/useSourcesPanelResize";
import { isViewTokenUnavailableStatus } from "@/lib/viewTokenPreview";
import { useSlideDecks } from "./hooks/useSlideDecks";
import { useQuizSets } from "./hooks/useQuizSets";
import { useFlashcardSets, NEW_SET_VALUE } from "./hooks/useFlashcardSets";
import CreateFlashcardDialog from "./components/CreateFlashcardDialog";
import FlashcardSetEditor from "./components/FlashcardSetEditor";
import {
  MODELS,
  CHAT_RESPONSE_LENGTHS,
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
  ReplyQuoteIco,
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
  const [chatResponseLength, setChatResponseLength] = useState("medium");
  const [lengthOpen, setLengthOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  /** Lecturer chat: search Tavily + academic papers for journal/web references (default off). */
  const [searchReferences, setSearchReferences] = useState(false);
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
  const [flashcardModal, setFlashcardModal] = useState(false);
  const [createFlashcardOpen, setCreateFlashcardOpen] = useState(false);
  const [flashcardView, setFlashcardView] = useState(false);
  const [flashcardData, setFlashcardData] = useState(null);

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
  const [sourcePreviewTokenLoading, setSourcePreviewTokenLoading] =
    useState(false);
  const [sourcePreviewIframeLoading, setSourcePreviewIframeLoading] =
    useState(true);
  const [sourcePreviewSetupErr, setSourcePreviewSetupErr] = useState("");
  const [summaryReferences, setSummaryReferences] = useState([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [activeCitationMarker, setActiveCitationMarker] = useState(null);
  const [citationPreview, setCitationPreview] = useState(null);
  const [referenceMutatingId, setReferenceMutatingId] = useState(null);

  const lecturerReferences = useMemo(() => {
    if (
      summary?.summarizeFor !== "lecturer" ||
      summaryReferences.length === 0
    ) {
      return summaryReferences;
    }
    const output = summary?.output?.trim();
    if (!output) return summaryReferences;
    const anchorMap = buildMarkerAnchorMap(output);
    return summaryReferences.map((r) => ({
      ...r,
      anchorIds: anchorMap.get(r.marker) ?? [],
    }));
  }, [summary?.summarizeFor, summary?.output, summaryReferences]);

  const visibleLecturerReferences = useMemo(() => {
    if (summary?.summarizeFor !== "lecturer") return [];
    const output = summary?.output?.trim();
    if (!output) return lecturerReferences;
    return filterReferencesToCitedInBody(lecturerReferences, output);
  }, [summary?.summarizeFor, summary?.output, lecturerReferences]);

  const { sourcesWidth, onSplitterMouseDown } = useSourcesPanelResize();

  const slideDecksApi = useSlideDecks({ summaryId, status });
  const {
    slideDecks,
    slideDecksLoading,
    slideDeckDeletingId,
    slideDeckPreviewOpen,
    setSlideDeckPreviewOpen,
    slideDeckPreviewUrl,
    slideDeckRemotePptUrl,
    slideDeckPreviewLoading,
    slideDeckPreviewUnavailable,
    slideDeckPreviewTitle,
    slideDeckDlRef,
    fetchSlideDecks,
    openSlideDeckPreview,
    downloadSlideDeck,
    deleteSlideDeck,
  } = slideDecksApi;

  const isLecturerSummary = summary?.summarizeFor === "lecturer";

  const quizSetsApi = useQuizSets({
    summaryId,
    status,
    summarizeFor: summary?.summarizeFor || "student",
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

  const flashcardSetsApi = useFlashcardSets({
    summaryId,
    status,
    setFlashcardData,
    setFlashcardView,
  });
  const {
    flashcardSets,
    flashcardSetsLoading,
    flashcardSetOpeningId,
    flashcardSetDeletingId,
    flashcardEditorSet,
    flashcardEditorLoading,
    fetchFlashcardSets,
    fetchSetDetails,
    openFlashcardSet,
    openFlashcardSetEditor,
    closeFlashcardSetEditor,
    deleteFlashcardSet,
    createFlashcardSet,
    addCard,
    updateCard,
    resetStudyProgress,
    deleteCard,
    reorderCards,
  } = flashcardSetsApi;

  const handleManualFlashcardSave = useCallback(
    async ({ saveIn, atPosition, front, back }) => {
      let setId =
        saveIn === NEW_SET_VALUE ? null : Number.parseInt(String(saveIn), 10);
      if (!Number.isFinite(setId) || setId <= 0) {
        const created = await createFlashcardSet("My flashcards");
        setId = created?.id;
        if (!setId) throw new Error("Could not create flashcard set");
        return addCard(setId, { front, back, atPosition });
      }
      return addCard(setId, { front, back, atPosition });
    },
    [createFlashcardSet, addCard],
  );

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
    setCitationPreview(null);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, [summaryId]);

  function queueChatReference(text, message) {
    const cleaned = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
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

  function openReplyPopoverFromSelection(
    selection,
    range,
    messageId,
    anchorPoint,
  ) {
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
      : Math.min(
          vh - buttonHeight - margin,
          selectionTopY + firstRect.height + 4,
        );
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
      if (ev.target instanceof Element && ev.target.closest(".unified-scroll"))
        return;
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
            else if (ln.startsWith("data:"))
              dataLines.push(ln.slice(5).trimStart());
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
              return {
                ...prev,
                output: String(prev.output || "") + payload.text,
              };
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
          void fetch(`/api/summary/${summaryId}/references`)
            .then((rr) => rr.json())
            .then((rd) => {
              if (Array.isArray(rd?.references))
                setSummaryReferences(rd.references);
            })
            .catch(() => {});
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

    const { body: bodyMd, referencesMarkdown } = splitMarkdownBeforeReferences(
      summary.output,
    );
    const found = [];
    const re = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = re.exec(bodyMd))) {
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

    let bodyHtml = markdownToHtml(bodyMd);
    found.forEach((h) => {
      const tag = `h${h.level}`;
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`<${tag}>${escaped}</${tag}>`);
      bodyHtml = bodyHtml.replace(
        pattern,
        `<${tag} id="${h.id}">${h.text}</${tag}>`,
      );
    });

    if (summary.summarizeFor === "lecturer") {
      const citedMarkers = extractCitationMarkers(bodyMd);
      const maxMarker =
        citedMarkers.length > 0 ? Math.max(...citedMarkers) : 99;
      bodyHtml = enrichSummaryBodyHtml(bodyHtml, maxMarker);
    }

    const hasLecturerDbRefs =
      summary.summarizeFor === "lecturer" && summaryReferences.length > 0;

    let html = bodyHtml;
    if (
      summary.summarizeFor === "lecturer" &&
      visibleLecturerReferences.length > 0
    ) {
      html += buildReferencesSectionHtml(visibleLecturerReferences);
    } else if (referencesMarkdown && !hasLecturerDbRefs) {
      html += markdownToHtml(referencesMarkdown);
    }

    setHeadings(found);
    setSummaryHtml(html);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("s2n-summary-headings", { detail: found }),
      );
    }
  }, [summary, summaryReferences, visibleLecturerReferences]);

  const fetchSummaryReferences = useCallback(async () => {
    if (!summaryId || summary?.summarizeFor !== "lecturer") return;
    setReferencesLoading(true);
    try {
      const res = await fetch(`/api/summary/${summaryId}/references`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.references)) {
        setSummaryReferences(data.references);
      }
    } catch {
      /* ignore */
    } finally {
      setReferencesLoading(false);
    }
  }, [summaryId, summary?.summarizeFor]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (summary?.summarizeFor !== "lecturer") {
      setSummaryReferences([]);
      return;
    }
    if (summarizing) {
      setReferencesLoading(true);
      return;
    }
    if (summary?.output?.trim()) {
      void fetchSummaryReferences();
    }
  }, [
    status,
    summary?.summarizeFor,
    summary?.output,
    summarizing,
    fetchSummaryReferences,
  ]);

  /** Block-level container to flash so users see the cited claim, not just [n]. */
  const getCitationFlashTarget = useCallback((el) => {
    if (!el) return null;
    if (el.classList?.contains("cite-marker")) {
      return (
        el.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, pre") ??
        el
      );
    }
    return el;
  }, []);

  /**
   * Brief yellow flash on the passage tied to a citation — similar to
   * Google text-fragment (#:~:text=) behaviour.
   */
  const flashHighlight = useCallback(
    (el) => {
      const target = getCitationFlashTarget(el);
      if (!target) return;
      target.classList.remove("cite-flash");
      void target.offsetWidth;
      target.classList.add("cite-flash");
      target.addEventListener(
        "animationend",
        () => target.classList.remove("cite-flash"),
        { once: true },
      );
    },
    [getCitationFlashTarget],
  );

  const scrollToId = useCallback(
    (id) => {
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash after the scroll settles (~400 ms)
      setTimeout(() => flashHighlight(el), 420);
    },
    [flashHighlight],
  );

  const handleSelectReference = useCallback(
    (ref) => {
      setActiveCitationMarker(ref.marker);
      const anchor = ref.anchorIds?.[0];
      if (anchor) {
        scrollToId(anchor);
      } else {
        const link = summaryBodyRef.current?.querySelector(
          `.cite-marker[data-marker="${ref.marker}"]`,
        );
        if (link) {
          link.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => flashHighlight(link), 420);
        }
      }
    },
    [scrollToId, flashHighlight],
  );

  const handleDeleteSummaryReference = useCallback(
    async (ref) => {
      if (!summaryId || !ref?.id) return;
      const ok = window.confirm(
        "Remove this entry from your reference list? It will disappear from the sidebar and the summary bibliography preview. Inline [n] markers in the saved summary text are unchanged until you edit the summary.",
      );
      if (!ok) return;
      setReferenceMutatingId(ref.id);
      try {
        const res = await fetch(
          `/api/summary/${summaryId}/references/${ref.id}`,
          { method: "DELETE" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(data?.error || "Could not remove reference");
          return;
        }
        if (Array.isArray(data.references)) {
          setSummaryReferences(data.references);
        }
        setCitationPreview((p) => (p?.marker === ref.marker ? null : p));
        setActiveCitationMarker((m) => (m === ref.marker ? null : m));
      } finally {
        setReferenceMutatingId(null);
      }
    },
    [summaryId],
  );

  const handleUpdateSummaryReference = useCallback(
    async (ref) => {
      if (!summaryId || !ref?.id) return false;
      const title = ref.title?.trim();
      if (!title) return false;

      const yearRaw = ref.year;
      const yearParsed =
        yearRaw === "" || yearRaw == null
          ? null
          : parseInt(String(yearRaw), 10);
      const year =
        yearParsed != null && Number.isFinite(yearParsed) ? yearParsed : null;

      setReferenceMutatingId(ref.id);
      try {
        const res = await fetch(
          `/api/summary/${summaryId}/references/${ref.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              authors: ref.authors?.trim() || null,
              year,
              venue: ref.venue?.trim() || null,
              doi: ref.doi?.trim() || null,
              url: ref.url?.trim() || null,
              abstract: ref.abstract?.trim() || null,
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(data?.error || "Could not save reference");
          return false;
        }
        if (Array.isArray(data.references)) {
          setSummaryReferences(data.references);
        }
        return true;
      } finally {
        setReferenceMutatingId(null);
      }
    },
    [summaryId],
  );

  const openCitationPreview = useCallback(
    (marker, anchorEl) => {
      if (!Number.isFinite(marker) || !anchorEl) return;
      const ref =
        summaryReferences.find((r) => r.marker === marker) ??
        syntheticUploadReference(marker, summary?.files);
      setActiveCitationMarker(marker);
      if (anchorEl.classList?.contains("cite-marker")) {
        flashHighlight(anchorEl);
      }
      if (ref) {
        setCitationPreview({
          marker,
          rect: anchorEl.getBoundingClientRect(),
        });
      } else {
        setCitationPreview(null);
        document
          .getElementById(`ref-${marker}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [summaryReferences, summary?.files, flashHighlight],
  );

  useEffect(() => {
    const root = summaryBodyRef.current;
    if (!root) return;
    const onClick = (e) => {
      const backlink = e.target.closest?.(".ref-cite-backlink");
      if (backlink) {
        e.preventDefault();
        const href = backlink.getAttribute("href");
        const id = href?.startsWith("#") ? href.slice(1) : null;
        if (id) scrollToId(id);
        return;
      }
      const cite = e.target.closest?.(".cite-marker");
      if (cite) {
        e.preventDefault();
        const marker = parseInt(cite.getAttribute("data-marker") || "", 10);
        if (!Number.isNaN(marker)) openCitationPreview(marker, cite);
        return;
      }
      const bibItem = e.target.closest?.(".ref-biblio-item");
      if (bibItem) {
        const marker = parseInt(bibItem.getAttribute("data-marker") || "", 10);
        if (!Number.isNaN(marker)) {
          e.preventDefault();
          openCitationPreview(marker, bibItem);
        }
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [summaryHtml, openCitationPreview, scrollToId]);

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

  async function appendAssistantReplyGradually(
    reply,
    modelLabel,
    webSearch = null,
    sources = null,
  ) {
    const text = String(reply || "");
    const msgId = Date.now() + 1;
    const sourceList = Array.isArray(sources) ? sources : [];
    // One assistant bubble: loading dots live here until text replaces them.
    setChatLoading(false);
    setMessages((p) => [
      ...p,
      {
        id: msgId,
        role: "ai",
        content: "",
        streaming: true,
        modelLabel,
        ...(webSearch ? { webSearch } : {}),
        ...(sourceList.length > 0 ? { sources: sourceList } : {}),
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
    setMessages((p) =>
      p.map((m) => (m.id === msgId ? { ...m, streaming: false } : m)),
    );
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
          const docs = await uploadDocumentsViaClient(
            pendingSourceFiles.map((p) => p.file),
          );
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
          responseLength: chatResponseLength,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
          ...(isLecturerSummary ? { searchReferences } : {}),
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
      const src = Array.isArray(data?.sources) ? data.sources : [];
      await appendAssistantReplyGradually(reply, chatModel, ws, src);
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
          responseLength: chatResponseLength,
          messages: historyPayload,
          documentIds: attachedDocumentIds,
          regenerate: true,
          ...(isLecturerSummary ? { searchReferences } : {}),
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
      const src = Array.isArray(data?.sources) ? data.sources : [];
      await appendAssistantReplyGradually(reply, chatModel, ws, src);
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
    exportSummaryPdf(
      summary,
      messages,
      summaryBodyRef.current?.innerHTML || "",
    );
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
        if (isViewTokenUnavailableStatus(res.status)) {
          setSourcePreviewSetupErr(
            data.error || "Preview link not available",
          );
          setSourcePreviewIframeLoading(false);
          return;
        }
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

  const handleSummarySelectionTrigger = useCallback(
    (anchorPoint = null) => {
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
    },
    [hlModeActive, hlSaving, hlColorHex],
  );

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
    const raw =
      summaryHtml || markdownToHtml(hasOutput ? summary.output : fallback);
    return { __html: raw };
  }, [summaryHtml, summary?.output, summarizing, summarizeError]);

  const chatSuggestions = useMemo(() => {
    if (aiChatSuggestions.length > 0) return aiChatSuggestions;
    return buildChatSuggestions({
      markdown: summary?.output || "",
      headings,
      title: summary?.title || "",
      max: 4,
      role: summary?.summarizeFor === "lecturer" ? "lecturer" : "student",
    });
  }, [
    aiChatSuggestions,
    summary?.output,
    summary?.title,
    summary?.summarizeFor,
    headings,
  ]);

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
                <div className="act-bar-btns">
                  <Button variant="quiz" onClick={() => setQuizModal(true)}>
                    <QuizIco />{" "}
                    {compactActBar
                      ? "Quiz"
                      : isLecturerSummary
                        ? "Generate class quiz"
                        : "Generate Quiz"}
                  </Button>
                  {!isLecturerSummary && (
                    <>
                      <Button
                        variant="flashcard"
                        onClick={() => setFlashcardModal(true)}
                      >
                        {compactActBar ? "Gen cards" : "Generate flashcards"}
                      </Button>
                      <Button
                        variant="flashcard"
                        onClick={() => setCreateFlashcardOpen(true)}
                      >
                        {compactActBar ? "Create" : "Create flashcard"}
                      </Button>
                    </>
                  )}
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
              <div className="sum-card">
                <div className="sum-head">
                  <div className="sum-left">
                    {!summaryLoading && !summaryError && summary && (
                      <>
                        {chatTitleEditing ? (
                          <input
                            ref={chatTitleInputRef}
                            type="text"
                            className="sum-head-title-inp"
                            value={chatTitleDraft}
                            onChange={(e) => setChatTitleDraft(e.target.value)}
                            onBlur={() => saveChatTitle()}
                            onKeyDown={onChatTitleKeyDown}
                            disabled={chatTitleSaving}
                            maxLength={255}
                            aria-label="Summary title"
                          />
                        ) : (
                          <button
                            type="button"
                            className="sum-head-title-btn"
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
                    <div
                      className="sum-text sum-loading"
                      style={{ paddingTop: 8 }}
                      role="status"
                      aria-live="polite"
                    >
                      Loading summary
                      <span className="dots dots--inline" aria-hidden>
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </span>
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
                                      if (
                                        m.role === "ai" &&
                                        m.streaming &&
                                        !mdSrc.trim()
                                      ) {
                                        return (
                                          <div className="dots">
                                            <div className="dot" />
                                            <div className="dot" />
                                            <div className="dot" />
                                          </div>
                                        );
                                      }
                                      return (
                                        <ChatBubbleContent mdSrc={mdSrc} />
                                      );
                                    })()}
                                    {m.role === "ai" &&
                                      !m.streaming &&
                                      Array.isArray(m.sources) &&
                                      m.sources.length > 0 && (
                                        <ChatSourcesList sources={m.sources} />
                                      )}
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
                                    !m.error &&
                                    !m.streaming && (
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
                        {chatLoading &&
                          !messages.some(
                            (m) => m.role === "ai" && m.streaming,
                          ) && (
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

                  {summary?.output &&
                    chatSuggestions.length > 0 &&
                    !chatLoading && (
                      <div
                        className={
                          messages.length > 0
                            ? "suggests suggests--end-chat"
                            : "suggests"
                        }
                        role="group"
                        aria-label={
                          summary?.summarizeFor === "lecturer"
                            ? "Suggested lecturer prompts from this summary"
                            : "Suggested questions from this summary"
                        }
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

                {isLecturerSummary && (
                  <label className="chat-ref-search-toggle">
                    <input
                      type="checkbox"
                      checked={searchReferences}
                      onChange={(e) => setSearchReferences(e.target.checked)}
                    />
                    <span className="chat-ref-search-toggle-text">
                      Search journals &amp; web for references
                    </span>
                    <span className="chat-ref-search-toggle-hint">
                      Lecture notes stay in the summary — not listed as
                      References
                    </span>
                  </label>
                )}

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
                    className={`chatbox ${pendingSourceFiles.length > 0 || pendingPasteImages.length > 0 ? "with-files" : ""} ${pendingPasteImages.length > 0 ? "chatbox--with-paste" : ""} ${pendingChatReferences.length > 0 ? "chatbox--with-reply" : ""}`}
                  >
                    {pendingChatReferences.length > 0 && (
                      <div
                        className="chat-reply-stack"
                        aria-label="Replying with selected text"
                      >
                        {pendingChatReferences.map((r, i) => (
                          <div
                            key={r.id}
                            className="chat-reply-preview"
                            title={r.text}
                          >
                            <span className="chat-reply-icon" aria-hidden>
                              <ReplyQuoteIco size={15} />
                            </span>
                            <span className="chat-reply-text">{r.text}</span>
                            <button
                              type="button"
                              className="chat-reply-close"
                              onClick={() => removePendingChatReference(r.id)}
                              aria-label={`Remove reply quote ${i + 1}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {pendingPasteImages.length > 0 && (
                      <div
                        className="chat-paste-previews"
                        aria-label="Pasted images"
                      >
                        {pendingPasteImages.map((p, pi) => (
                          <div
                            key={p.clientId}
                            className="chat-paste-thumb-wrap"
                          >
                            <img
                              src={p.dataUrl}
                              alt=""
                              className="chat-paste-thumb"
                            />
                            <button
                              type="button"
                              className="chat-paste-thumb-rm"
                              onClick={() =>
                                removePendingPasteByClientId(p.clientId)
                              }
                              aria-label={`Remove pasted image ${pi + 1}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="chatbox-input-row">
                      {pendingPasteImages.length === 0 && (
                        <>
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
                        </>
                      )}
                      <div
                        className={`chatbox-main ${pendingPasteImages.length > 0 ? "chatbox-main--stacked" : ""}`}
                      >
                        {pendingSourceFiles.length > 0 && (
                          <div
                            className="chat-uploads"
                            aria-label="Attached documents"
                          >
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
                        <div
                          className={
                            pendingPasteImages.length > 0
                              ? "chatbox-compose"
                              : "chatbox-row"
                          }
                        >
                          <input
                            ref={inputRef}
                            className="inp"
                            placeholder={
                              pendingPasteImages.length > 0
                                ? "Ask anything"
                                : "Refine your summary or ask question..."
                            }
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
                          {pendingPasteImages.length === 0 && (
                            <div className="chatbox-controls">
                              <div className="chat-control-labeled">
                                <span
                                  className="chat-control-label"
                                  id="chat-response-length-label"
                                >
                                  Text response length:
                                </span>
                                <div className="mdl-wrap">
                                  <button
                                    type="button"
                                    className={`mdl-btn ${lengthOpen ? "open" : ""}`}
                                    title="How long the AI reply should be"
                                    aria-labelledby="chat-response-length-label"
                                    onClick={() => {
                                      setLengthOpen((v) => !v);
                                      setModelOpen(false);
                                    }}
                                    onBlur={() =>
                                      setTimeout(
                                        () => setLengthOpen(false),
                                        150,
                                      )
                                    }
                                    disabled={
                                      chatLoading || sourceUploadLoading
                                    }
                                  >
                                    {CHAT_RESPONSE_LENGTHS.find(
                                      (o) => o.id === chatResponseLength,
                                    )?.label || "Medium"}{" "}
                                    <Chevron open={lengthOpen} />
                                  </button>
                                  {lengthOpen && (
                                    <div className="mdl-menu">
                                      {CHAT_RESPONSE_LENGTHS.map((o) => (
                                        <div
                                          key={o.id}
                                          className={`mdl-opt ${chatResponseLength === o.id ? "on" : ""}`}
                                          onMouseDown={() => {
                                            setChatResponseLength(o.id);
                                            setLengthOpen(false);
                                          }}
                                        >
                                          {o.label}{" "}
                                          {chatResponseLength === o.id && "✓"}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mdl-wrap">
                                <button
                                  type="button"
                                  className={`mdl-btn ${modelOpen ? "open" : ""}`}
                                  title="AI model"
                                  onClick={() => {
                                    setModelOpen((v) => !v);
                                    setLengthOpen(false);
                                  }}
                                  onBlur={() =>
                                    setTimeout(() => setModelOpen(false), 150)
                                  }
                                  disabled={
                                    chatLoading || sourceUploadLoading
                                  }
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
                          )}
                        </div>
                        {pendingPasteImages.length > 0 && (
                          <div className="chatbox-toolbar">
                            <button
                              type="button"
                              className="attach-btn attach-btn--toolbar"
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
                            <div className="chatbox-toolbar-end">
                              <div className="chat-control-labeled">
                                <span
                                  className="chat-control-label"
                                  id="chat-response-length-label-stacked"
                                >
                                  Text response length:
                                </span>
                                <div className="mdl-wrap">
                                  <button
                                    type="button"
                                    className={`mdl-btn ${lengthOpen ? "open" : ""}`}
                                    title="How long the AI reply should be"
                                    aria-labelledby="chat-response-length-label-stacked"
                                    onClick={() => {
                                      setLengthOpen((v) => !v);
                                      setModelOpen(false);
                                    }}
                                    onBlur={() =>
                                      setTimeout(
                                        () => setLengthOpen(false),
                                        150,
                                      )
                                    }
                                    disabled={
                                      chatLoading || sourceUploadLoading
                                    }
                                  >
                                    {CHAT_RESPONSE_LENGTHS.find(
                                      (o) => o.id === chatResponseLength,
                                    )?.label || "Medium"}{" "}
                                    <Chevron open={lengthOpen} />
                                  </button>
                                  {lengthOpen && (
                                    <div className="mdl-menu">
                                      {CHAT_RESPONSE_LENGTHS.map((o) => (
                                        <div
                                          key={o.id}
                                          className={`mdl-opt ${chatResponseLength === o.id ? "on" : ""}`}
                                          onMouseDown={() => {
                                            setChatResponseLength(o.id);
                                            setLengthOpen(false);
                                          }}
                                        >
                                          {o.label}{" "}
                                          {chatResponseLength === o.id && "✓"}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mdl-wrap">
                                <button
                                  type="button"
                                  className={`mdl-btn ${modelOpen ? "open" : ""}`}
                                  title="AI model"
                                  onClick={() => {
                                    setModelOpen((v) => !v);
                                    setLengthOpen(false);
                                  }}
                                  onBlur={() =>
                                    setTimeout(() => setModelOpen(false), 150)
                                  }
                                  disabled={
                                    chatLoading || sourceUploadLoading
                                  }
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
                            <button
                              type="button"
                              className="send-btn send-btn--toolbar"
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
                        )}
                      </div>
                      {pendingPasteImages.length === 0 && (
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
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* /sum-card */}
            </main>

            <SourcesSidebar
              sourcesWidth={sourcesWidth}
              onSplitterMouseDown={onSplitterMouseDown}
              summary={summary}
              extraSources={extraSources}
              onSourcePreview={openSourceDocPreview}
              referencesProps={
                summary?.summarizeFor === "lecturer"
                  ? {
                      references: visibleLecturerReferences,
                      loading: referencesLoading || summarizing,
                      activeMarker: activeCitationMarker,
                      onSelectReference: handleSelectReference,
                      onMarkerHover: setActiveCitationMarker,
                      onDeleteReference: handleDeleteSummaryReference,
                      onUpdateReference: handleUpdateSummaryReference,
                      onJumpToAnchor: scrollToId,
                      mutatingRefId: referenceMutatingId,
                    }
                  : null
              }
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
                isLecturer: isLecturerSummary,
                onRefresh: () => void fetchQuizSets(),
                onToggleHistory: toggleQuizHistoryPanel,
                onOpenSet: openSavedQuizSet,
                onOpenAttempt: openQuizAttemptDetail,
              }}
              flashcardSetsProps={{
                flashcardSets,
                flashcardSetsLoading,
                flashcardSetOpeningId,
                flashcardSetDeletingId,
                flashcardEditorLoading,
                onRefresh: () => void fetchFlashcardSets(),
                onOpenSet: openFlashcardSet,
                onEditSet: openFlashcardSetEditor,
                onDeleteSet: deleteFlashcardSet,
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
        slideDeckPreviewLoading={slideDeckPreviewLoading}
        slideDeckPreviewUnavailable={slideDeckPreviewUnavailable}
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
        flashcardModal={flashcardModal}
        setFlashcardModal={setFlashcardModal}
        flashcardView={flashcardView}
        flashcardData={flashcardData}
        setFlashcardData={setFlashcardData}
        setFlashcardView={setFlashcardView}
        fetchFlashcardSets={fetchFlashcardSets}
        onUpdateFlashcard={updateCard}
        onDeleteFlashcard={deleteCard}
        onResetFlashcardStudy={resetStudyProgress}
      />

      {createFlashcardOpen && !isLecturerSummary && (
        <CreateFlashcardDialog
          flashcardSets={flashcardSets}
          fetchSetDetails={fetchSetDetails}
          onClose={() => setCreateFlashcardOpen(false)}
          onSave={handleManualFlashcardSave}
        />
      )}

      {flashcardEditorSet && (
        <FlashcardSetEditor
          flashcardSet={flashcardEditorSet}
          onClose={closeFlashcardSetEditor}
          onUpdateCard={updateCard}
          onDeleteCard={deleteCard}
          onReorderCards={reorderCards}
        />
      )}

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
        referencesProps={
          summary?.summarizeFor === "lecturer"
            ? {
                references: visibleLecturerReferences,
                loading: referencesLoading || summarizing,
                activeMarker: activeCitationMarker,
                onSelectReference: handleSelectReference,
                onMarkerHover: setActiveCitationMarker,
                onDeleteReference: handleDeleteSummaryReference,
                onUpdateReference: handleUpdateSummaryReference,
                onJumpToAnchor: scrollToId,
                mutatingRefId: referenceMutatingId,
              }
            : null
        }
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
          isLecturer: isLecturerSummary,
          onRefresh: () => void fetchQuizSets(),
          onToggleHistory: toggleQuizHistoryPanel,
          onOpenSet: openSavedQuizSet,
          onOpenAttempt: openQuizAttemptDetail,
        }}
        flashcardSetsProps={{
          flashcardSets,
          flashcardSetsLoading,
          flashcardSetOpeningId,
          flashcardSetDeletingId,
          flashcardEditorLoading,
          onRefresh: () => void fetchFlashcardSets(),
          onOpenSet: openFlashcardSet,
          onEditSet: openFlashcardSetEditor,
          onDeleteSet: deleteFlashcardSet,
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
          OUTSIDE .sum-card, so that position:fixed is relative to the viewport.
          .sum-card has backdrop-filter:blur() which creates a CSS containing block
          and breaks fixed positioning for any descendants. */}
      <ChatSelectionPopover
        draft={chatSelectionDraft}
        onReply={addDraftChatReference}
      />

      {citationPreview && summary?.summarizeFor === "lecturer" ? (
        <CitationPreviewPopover
          reference={
            summaryReferences.find(
              (r) => r.marker === citationPreview.marker,
            ) ??
            syntheticUploadReference(citationPreview.marker, summary?.files)
          }
          anchorRect={citationPreview.rect}
          onClose={() => setCitationPreview(null)}
          onViewInSidebar={handleSelectReference}
        />
      ) : null}
    </>
  );
}
