"use client";

import "./dashboard-page.css";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swrFetcher";
import { useDocumentManager } from "./hooks/useDocumentManager";
import { markdownToHtml } from "@/lib/markdown";
import {
  ACCEPTED,
  DASH_PROMPT_SUGGESTIONS,
  getDefaultVariant,
  IMPROVE_ACCEPT,
  isImproveSourceType,
  isOfficePreviewName,
  MODEL_PROVIDERS,
  modelDisplayName,
  formatBytes,
  timeAgo,
} from "./helpers";
import {
  ChevronDownIcon,
  CopyIcon,
  FileIcon,
  SparkleIcon,
  UploadIcon,
  CloseIcon,
} from "../components/icons";
import SidebarResizeSplitter from "@/app/components/SidebarResizeSplitter";
import { useLeftSidebarResize } from "@/app/hooks/useLeftSidebarResize";
import DashboardSidebar from "./components/DashboardSidebar";
import DocumentPreviewModal from "./components/DocumentPreviewModal";
import TemplatePickerModal from "./components/TemplatePickerModal";
import AddSourcesModal from "./components/AddSourcesModal";
import { importWebSourceAsDocument, searchWebSources } from "@/lib/importWebSource";
import { domainFromSourceUrl } from "@/lib/webSourceUtils";
import {
  fetchDocumentTextContent,
  readLocalFileAsText,
  shouldUseTextDocumentPreview,
} from "@/lib/documentPreviewClient";
import { LoadingText } from "@/app/components/LoadingText";
import { SUMMARIZE_PHASE, summarizePhaseLabel } from "@/lib/summarizeProgress";
import { uploadDocumentsViaClient } from "@/lib/clientDocumentUpload";
import {
  useEnsureLlmProvider,
  useEnsureUiModelLabel,
  useLlmProviders,
} from "@/app/hooks/useLlmProviders";
import {
  mergeSelectedThemeIntoList,
  pickThemeIdAfterListLoad,
  readStoredThemeChoice,
  writeStoredThemeChoice,
} from "@/lib/themeSelection";
import PublishedYearFilter, {
  publishedYearStateToPayload,
} from "./components/PublishedYearFilter";
import PromptSuggestionsMenu from "./components/PromptSuggestionsMenu";
import { resolvePublishedYearRange } from "@/lib/publishedYearFilter";
import { setGuestPendingSummarize } from "@/lib/guestPendingSummarize";
import { GUEST_SUMMARY_ROUTE_ID } from "@/lib/guestMode";
import { GUEST_MAX_FILES, validateGuestFileSelection } from "@/lib/guestUpload";
import {
  formatUploadLimitLabel,
  MAX_UPLOAD_FILE_BYTES,
  SERVERLESS_PAYLOAD_MAX_BYTES,
} from "@/lib/uploadLimits";
import { SUMMARY_RENAMED_EVENT } from "@/lib/summaryRenameSync";
import { SUMMARIZE_OUTPUT_LENGTHS } from "@/lib/summarizeOutputLength";

// ── Main Component ─────────────────────────────────────────
export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // {name, type, size, id?, file?, fromPrev?}
  const [prompt, setPrompt] = useState("");
  const [summarizeFor, setSummarizeFor] = useState("lecturer");
  const [outputLength, setOutputLength] = useState("medium");
  const [publishedYearMode, setPublishedYearMode] = useState("all");
  const [customYearFrom, setCustomYearFrom] = useState("");
  const [customYearTo, setCustomYearTo] = useState("");
  const [appliedCustomYearRange, setAppliedCustomYearRange] = useState({
    from: null,
    to: null,
  });
  const summarizeDefaultApplied = useRef(false);
  const [model, setModel] = useState("chatgpt"); // provider: chatgpt | deepseek | gemini
  const [modelVariant, setModelVariant] = useState(
    getDefaultVariant("chatgpt"),
  );
  const llmProviders = useLlmProviders();
  const [modelOpen, setModelOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false); // summarizing
  const [uploading, setUploading] = useState(false); // uploading files
  /** Dashboard summarize button step label while busy. */
  const [summarizeStep, setSummarizeStep] = useState(null);
  const [summaryOutput, setSummaryOutput] = useState(null); // latest result
  const [copied, setCopied] = useState(false);

  const [sidebarSection, setSidebarSection] = useState({
    history: true,
    prev: true,
  });
  const { sidebarWidth, onSidebarResizeStart } = useLeftSidebarResize(260);

  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreviewDoc, setDocPreviewDoc] = useState(null);
  const [docPreviewSrc, setDocPreviewSrc] = useState("");
  const [docPreviewTabHref, setDocPreviewTabHref] = useState("");
  const [docPreviewTokenLoading, setDocPreviewTokenLoading] = useState(false);
  const [docPreviewSetupErr, setDocPreviewSetupErr] = useState("");
  const [docPreviewIframeLoading, setDocPreviewIframeLoading] = useState(true);
  const [docPreviewText, setDocPreviewText] = useState("");

  const [error, setError] = useState("");
  const [filePanelError, setFilePanelError] = useState("");

  const {
    data: historyData,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR(status === "authenticated" ? "/api/history" : null, swrFetcher);
  const history = historyData?.summaries || [];
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
    const onRenamed = (e) => {
      const { id, title } = e.detail || {};
      if (id == null) return;
      void mutateHistory(
        (current) => {
          if (!current?.summaries) return current;
          return {
            ...current,
            summaries: current.summaries.map((h) =>
              String(h.id) === String(id)
                ? { ...h, title: title ?? h.title }
                : h,
            ),
          };
        },
        { revalidate: false },
      );
    };
    window.addEventListener(SUMMARY_RENAMED_EVENT, onRenamed);
    return () => window.removeEventListener(SUMMARY_RENAMED_EVENT, onRenamed);
  }, [mutateHistory]);

  const {
    prevUploads,
    prevLoading,
    mutateUploads,
    removingDocId,
    selectedPrevDocIds,
    bulkRemoving,
    prevSelectionMode,
    enterPrevSelectionMode,
    exitPrevSelectionMode,
    handleRemoveDocument,
    handleRemoveSelectedDocuments,
    togglePrevDocSelection,
    toggleSelectAllPrevDocs,
  } = useDocumentManager({ status, setError, setSelectedFiles });

  // ── Dashboard mode: null = choose, "summarize", "improve" ──
  const [dashMode, setDashMode] = useState(null);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "summarize" || mode === "improve") {
      setDashMode(mode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (summarizeDefaultApplied.current || status !== "authenticated") return;
    const role = session?.user?.role;
    if (!role) return;
    setSummarizeFor(role === "Student" ? "student" : "lecturer");
    summarizeDefaultApplied.current = true;
  }, [session?.user?.role, status]);

  // ── Improve-PPT state ──
  const [improveFile, setImproveFile] = useState(null);
  /** When Improve uses a row from Previous Uploads (Vercel Blob), server loads bytes by id */
  const [improveDocumentId, setImproveDocumentId] = useState(null);
  const [improveInstructions, setImproveInstructions] = useState("");
  const [parsedSlides, setParsedSlides] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [planAdjustments, setPlanAdjustments] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const parseRequestIdRef = useRef(0);
  const [addStockImages, setAddStockImages] = useState(true);
  const [additiveImprove, setAdditiveImprove] = useState(true);
  const [improveDetailLevel, setImproveDetailLevel] = useState("lecture");
  const [improveImgQuery, setImproveImgQuery] = useState("");
  const [improveImgSearchLoading, setImproveImgSearchLoading] = useState(false);
  const [improveImgResults, setImproveImgResults] = useState([]);
  const [improveImgSearchHint, setImproveImgSearchHint] = useState("");
  const [improveImageProvider, setImproveImageProvider] = useState(null);
  const [improveTargetSlide, setImproveTargetSlide] = useState(1);
  const [pickedUserImages, setPickedUserImages] = useState([]);
  const [improvePasteUrl, setImprovePasteUrl] = useState("");
  const [themeQuery, setThemeQuery] = useState("");
  const [themeSearchLoading, setThemeSearchLoading] = useState(false);
  const [themeResults, setThemeResults] = useState([]);
  const [themeResultsQuery, setThemeResultsQuery] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [selectedTemplateSpec, setSelectedTemplateSpec] = useState(null);
  const [themeSearchErr, setThemeSearchErr] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [improveGenLoading, setImproveGenLoading] = useState(false);
  const [improveErr, setImproveErr] = useState("");
  const [improveAiModel, setImproveAiModel] = useState("ChatGPT");
  const [improveModelOpen, setImproveModelOpen] = useState(false);
  /** Final PPTX renderer: Alai (default) or 2slides Fast PPT */
  const [improveProvider, setImproveProvider] = useState("alai");

  const [useExistingDialog, setUseExistingDialog] = useState(null); // { names: string[] } when files already on server
  const [addSourcesOpen, setAddSourcesOpen] = useState(false);
  const [linkImporting, setLinkImporting] = useState(false);
  const fileDragDepthRef = useRef(0);

  const isGuest = status === "unauthenticated";

  // Keep modelVariant in sync with provider (e.g. after switching provider)
  useEffect(() => {
    const prov = MODEL_PROVIDERS.find((m) => m.id === model);
    const variantIds = prov?.variants?.map((v) => v.id) ?? [];
    if (variantIds.length && !variantIds.includes(modelVariant)) {
      setModelVariant(getDefaultVariant(model));
    }
  }, [model]);

  // ── Improve-PPT side-effects (must be before any early return) ──
  useEffect(() => {
    if (!parsedSlides?.length) {
      setImproveImageProvider(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/improve-ppt/image-search");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.provider)
          setImproveImageProvider(data.provider);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsedSlides]);

  useEffect(() => {
    setPlanAdjustments([]);
    setPlanError("");
  }, [improveInstructions, improveAiModel]);

  // In improve mode, keep only a single .pptx or .pdf selected.
  useEffect(() => {
    if (dashMode !== "improve") return;
    setSelectedFiles((prev) => {
      const deck = prev.filter((f) => isImproveSourceType(f.type));
      if (deck.length === 0) return [];
      return [deck[deck.length - 1]];
    });
  }, [dashMode]);

  // ── File helpers ───────────────────────────────────────
  function getExt(name) {
    return name.split(".").pop().toUpperCase();
  }

  async function addLocalFiles(newFiles, { sourceUrl = null } = {}) {
    const arr = Array.from(newFiles).map((f) => ({
      file: f,
      name: f.name,
      type: getExt(f.name),
      size: formatBytes(f.size),
      fromPrev: false,
      ...(sourceUrl ? { sourceUrl } : {}),
    }));

    if (dashMode === "improve") {
      const deck = arr.filter((f) => isImproveSourceType(f.type));
      if (deck.length === 0) {
        setFilePanelError("Improve mode only supports .pptx or .pdf files.");
        setSelectedFiles([]);
        return;
      }
      const picked = deck[deck.length - 1];
      setFilePanelError("");
      setSelectedFiles([{ ...picked, uploading: true }]);
      setUploading(true);
      try {
        const doc = await uploadDocumentsViaClient([picked.file]);
        const uploaded = doc[0];
        setSelectedFiles([
          {
            id: uploaded.id,
            name: uploaded.name,
            type: uploaded.type || getExt(uploaded.name),
            size: formatBytes(uploaded.size),
            fromPrev: true,
          },
        ]);
        mutateUploads();
      } catch (err) {
        setFilePanelError(
          err?.message?.includes("FUNCTION_PAYLOAD") ||
            err?.message?.includes("Too Large")
            ? "File is too large to upload through the server. Try again — uploads now go directly to storage."
            : `Upload failed: ${err?.message || err}`,
        );
        setSelectedFiles([]);
      } finally {
        setUploading(false);
      }
      return;
    }

    if (isGuest) {
      const merged = [
        ...selectedFiles.map((f) => ({
          name: f.name,
          size: f.file?.size ?? 0,
        })),
        ...arr.map((f) => ({ name: f.name, size: f.file?.size ?? 0 })),
      ];
      const deduped = [];
      const seen = new Set();
      for (const item of merged) {
        const key = `${item.name}:${item.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
        if (deduped.length > GUEST_MAX_FILES) break;
      }
      const check = validateGuestFileSelection(deduped);
      if (!check.ok) {
        setFilePanelError(check.error);
        return;
      }
      setFilePanelError("");
      setSelectedFiles((prev) => {
        const names = new Set(prev.map((f) => f.name));
        const added = arr.filter((f) => !names.has(f.name));
        const next = [...prev, ...added];
        return next.slice(0, GUEST_MAX_FILES);
      });
      return;
    }

    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !names.has(f.name))];
    });
  }

  function resetFileDragState() {
    fileDragDepthRef.current = 0;
    setDragging(false);
  }

  function onFilePanelDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    fileDragDepthRef.current += 1;
    setDragging(true);
  }

  function onFilePanelDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDragDepthRef.current -= 1;
    if (fileDragDepthRef.current <= 0) resetFileDragState();
  }

  function onFilePanelDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onFilePanelDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    resetFileDragState();
    const files = e.dataTransfer?.files;
    if (files?.length) addLocalFiles(files);
  }

  useEffect(() => {
    const onDragEnd = () => resetFileDragState();
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  }, []);

  function openAddSources() {
    setAddSourcesOpen(true);
  }

  async function handleAddWebSource(url) {
    setLinkImporting(true);
    setFilePanelError("");
    try {
      const result = await importWebSourceAsDocument(url, { isGuest });
      if (result.kind === "document") {
        const doc = result.document;
        if (dashMode === "improve" && !isImproveSourceType(doc.type)) {
          throw new Error("Improve mode only supports .pptx or .pdf files.");
        }
        addPrevFile({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          sourceUrl: doc.sourceUrl || url,
        });
        mutateUploads();
        return;
      }
      await addLocalFiles([result.file], { sourceUrl: result.sourceUrl || url });
    } catch (err) {
      const msg = err?.message || "Could not add website";
      setFilePanelError(msg);
      throw err;
    } finally {
      setLinkImporting(false);
    }
  }

  async function handleWebSearch(query) {
    return searchWebSources(query);
  }

  function uploadLimitCopy() {
    if (dashMode === "improve") {
      return `One .pptx or .pdf · up to ${formatUploadLimitLabel(MAX_UPLOAD_FILE_BYTES)} per file`;
    }
    if (isGuest) {
      return `Up to ${GUEST_MAX_FILES} files · ${formatUploadLimitLabel(SERVERLESS_PAYLOAD_MAX_BYTES)} total · Sign in for larger uploads`;
    }
    return `Up to ${formatUploadLimitLabel(MAX_UPLOAD_FILE_BYTES)} per file · PDF, PPTX, DOCX, TXT, and more`;
  }

  function renderFileDropPanel({ compact = false } = {}) {
    const label =
      dashMode === "improve" ? "Upload .pptx / .pdf" : "Upload documents";
    return (
      <div
        className={`file-drop-panel${compact ? " file-drop-panel--compact" : ""}${dragging ? " dragging" : ""}`}
        role="button"
        tabIndex={0}
        onClick={openAddSources}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openAddSources();
          }
        }}
      >
        <p className="file-drop-panel-title">
          {compact ? "Add more files" : "Drop your files here"}
        </p>
        <p className="file-drop-panel-formats">
          {dashMode === "improve"
            ? "pptx, pdf"
            : "pdf, pptx, docx, txt, and more"}
        </p>
        <p className="file-drop-panel-limit">{uploadLimitCopy()}</p>
        <button
          type="button"
          className="file-drop-panel-btn"
          onClick={(e) => {
            e.stopPropagation();
            openAddSources();
          }}
        >
          <UploadIcon /> {label}
        </button>
        {!compact ? (
          <p className="file-drop-panel-side">
            {isGuest || dashMode === "improve"
              ? "Click to upload files or add website sources"
              : "Click to upload, search the web, or paste a website link"}
          </p>
        ) : null}
      </div>
    );
  }

  function removeFile(name) {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function addPrevFile(doc) {
    if (dashMode === "improve") {
      if (!isImproveSourceType(doc.type)) return;
      setError("");
      setSelectedFiles([
        {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: formatBytes(doc.size),
          fromPrev: true,
        },
      ]);
      return;
    }
    if (selectedFiles.find((f) => f.name === doc.name)) return;
    setSelectedFiles((prev) => [
      ...prev,
      {
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: formatBytes(doc.size),
        fromPrev: true,
        sourceUrl: doc.sourceUrl || null,
      },
    ]);
  }

  // ── Upload files to Vercel Blob via API ────────────────
  async function uploadNewFiles(files) {
    const list = files ?? selectedFiles;
    const newFiles = list.filter((f) => !f.fromPrev && f.file);
    if (newFiles.length === 0) return [];

    setUploading(true);
    try {
      const uploaded = await uploadDocumentsViaClient(
        newFiles.map((f) => f.file),
      );
      mutateUploads();
      return uploaded;
    } finally {
      setUploading(false);
    }
  }

  // ── Upload + summarize (used by handleSummarize and by "use existing" dialog)
  async function doUploadAndSummarize(filesOverride = null) {
    const files = filesOverride !== null ? filesOverride : selectedFiles;
    if (!files.length) return;

    setError("");
    setLoading(true);
    setSummarizeStep(SUMMARIZE_PHASE.UPLOAD);
    setSummaryOutput(null);

    try {
      let uploadedDocs = [];
      try {
        uploadedDocs = await uploadNewFiles(files);
      } catch (err) {
        setError("File upload failed: " + err.message);
        setLoading(false);
        setSummarizeStep(null);
        return;
      }

      // Merge newly uploaded docs into state so retry won't re-upload (prevents duplicates)
      if (uploadedDocs.length > 0 && filesOverride === null) {
        setSelectedFiles((prev) =>
          prev.map((f) => {
            if (f.fromPrev || !f.file) return f;
            const doc = uploadedDocs.find((d) => d.name === f.name);
            if (!doc) return f;
            return {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              size: formatBytes(doc.size),
              fromPrev: true,
            };
          }),
        );
      }
      if (filesOverride !== null && uploadedDocs.length > 0) {
        // When called with override (e.g. after "Use existing"), we already replaced some entries; merge upload results into override list
        const merged = files.map((f) => {
          if (f.fromPrev && f.id) return f;
          const doc = uploadedDocs.find((d) => d.name === f.name);
          if (doc)
            return {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              size: formatBytes(doc.size),
              fromPrev: true,
            };
          return f;
        });
        setSelectedFiles(merged);
      }

      const prevIds = files.filter((f) => f.fromPrev && f.id).map((f) => f.id);
      const newIds = uploadedDocs.map((d) => d.id);
      const documentIds = [...prevIds, ...newIds];

      if (documentIds.length === 0) {
        setError("No documents could be processed.");
        setLoading(false);
        setSummarizeStep(null);
        return;
      }

      setSummarizeStep(SUMMARIZE_PHASE.PREPARE);

      // Create a pending summary row, redirect immediately, then stream generation on the summary page.
      const yearPayload =
        summarizeFor === "lecturer"
          ? publishedYearStateToPayload(
              publishedYearMode,
              customYearFrom,
              customYearTo,
              appliedCustomYearRange,
            )
          : {
              publishedYearMode: "all",
              publishedYearFrom: null,
              publishedYearTo: null,
            };

      if (summarizeFor === "lecturer" && publishedYearMode === "custom") {
        const customRange = resolvePublishedYearRange({
          mode: "custom",
          from: yearPayload.publishedYearFrom,
          to: yearPayload.publishedYearTo,
        });
        if (!customRange.active) {
          setError(
            "Choose a custom year range and click Search, or enter at least one year.",
          );
          setLoading(false);
          setSummarizeStep(null);
          return;
        }
      }

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds,
          model,
          modelVariant,
          summarizeFor,
          outputLength,
          prompt,
          initOnly: true,
          ...yearPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Failed to start summarization");

      const sid = data?.summaryId;
      if (sid == null) throw new Error("Missing summaryId from server");
      setSummarizeStep(SUMMARIZE_PHASE.OPEN);
      router.push(`/summary/${sid}?autostart=1`);
      mutateHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setSummarizeStep(null);
    }
  }

  async function doGuestSummarize() {
    const rawFiles = selectedFiles.map((f) => f.file).filter(Boolean);
    if (!rawFiles.length) {
      setFilePanelError("Add at least one source (file or website) to summarize.");
      return;
    }

    const sizeCheck = validateGuestFileSelection(rawFiles);
    if (!sizeCheck.ok) {
      setFilePanelError(sizeCheck.error);
      return;
    }
    setFilePanelError("");

    const yearPayload =
      summarizeFor === "lecturer"
        ? publishedYearStateToPayload(
            publishedYearMode,
            customYearFrom,
            customYearTo,
            appliedCustomYearRange,
          )
        : {
            publishedYearMode: "all",
            publishedYearFrom: null,
            publishedYearTo: null,
          };

    if (summarizeFor === "lecturer" && publishedYearMode === "custom") {
      const customRange = resolvePublishedYearRange({
        mode: "custom",
        from: yearPayload.publishedYearFrom,
        to: yearPayload.publishedYearTo,
      });
      if (!customRange.active) {
        setError(
          "Choose a custom year range and click Search, or enter at least one year.",
        );
        return;
      }
    }

    setError("");
    setGuestPendingSummarize(rawFiles, {
      model,
      modelVariant,
      summarizeFor,
      outputLength,
      prompt,
      ...yearPayload,
    });
    router.push(`/summary/${GUEST_SUMMARY_ROUTE_ID}?autostart=1`);
  }

  // ── Summarize: show "use existing?" dialog if some selected files already on server ─────────────────────────────────────────
  async function handleSummarize() {
    if (!selectedFiles.length) return;

    if (isGuest) {
      await doGuestSummarize();
      return;
    }

    const newFiles = selectedFiles.filter((f) => !f.fromPrev && f.file);
    const alreadyOnServer = newFiles.filter((f) =>
      prevUploads.some((d) => d.name === f.name),
    );

    if (alreadyOnServer.length > 0) {
      setUseExistingDialog({ names: alreadyOnServer.map((f) => f.name) });
      return;
    }

    await doUploadAndSummarize();
  }

  function handleUseExistingConfirm(useExisting) {
    const dialog = useExistingDialog;
    setUseExistingDialog(null);
    if (!dialog) return;

    if (useExisting) {
      const resolved = selectedFiles.map((f) => {
        if (!dialog.names.includes(f.name)) return f;
        const doc = prevUploads.find((d) => d.name === f.name);
        if (!doc) return f;
        return {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          size: formatBytes(doc.size),
          fromPrev: true,
        };
      });
      setSelectedFiles(resolved);
      doUploadAndSummarize(resolved);
    } else {
      doUploadAndSummarize();
    }
  }

  function handleCopy() {
    if (!summaryOutput) return;
    navigator.clipboard.writeText(summaryOutput.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedProvider = MODEL_PROVIDERS.find((m) => m.id === model);
  const variants = selectedProvider?.variants ?? [];
  const selectedVariant =
    variants.find((v) => v.id === modelVariant) ?? variants[0];
  const setModelAndVariant = useCallback((providerId) => {
    setModel(providerId);
    setModelVariant(getDefaultVariant(providerId));
  }, []);

  useEnsureLlmProvider(model, setModelAndVariant, llmProviders);
  useEnsureUiModelLabel(improveAiModel, setImproveAiModel, llmProviders);

  const selectedImproveSource =
    selectedFiles.find((f) => isImproveSourceType(f.type)) || null;
  const improveFileBusy =
    dashMode === "improve" &&
    Boolean(selectedImproveSource) &&
    (uploading || parseLoading);
  const improveFileBusyLabel = uploading
    ? "Uploading presentation…"
    : parseLoading
      ? "Reading slides…"
      : "";
  const selectedImproveSourceKey = selectedImproveSource
    ? selectedImproveSource.fromPrev
      ? `prev:${selectedImproveSource.id ?? selectedImproveSource.name}`
      : `local:${selectedImproveSource.file?.lastModified ?? ""}:${selectedImproveSource.name}`
    : "";

  // Parse the selected deck whenever we enter improve mode.
  useEffect(() => {
    if (dashMode !== "improve") return;

    if (!selectedImproveSource) {
      setImproveFile(null);
      setImproveDocumentId(null);
      setParsedSlides(null);
      setParseLoading(false);
      setPlanAdjustments([]);
      setPlanError("");
      setPickedUserImages([]);
      setImproveTargetSlide(1);
      setImproveImgResults([]);
      setImproveImgSearchHint("");
      setImproveErr("");
      return;
    }

    // Reset improve-state when switching file.
    setPlanAdjustments([]);
    setPlanError("");
    setPickedUserImages([]);
    setImproveTargetSlide(1);
    setImproveImgResults([]);
    setImproveImgSearchHint("");
    setImproveErr("");
    setParsedSlides(null);

    if (selectedImproveSource.fromPrev || !selectedImproveSource.file) {
      if (!selectedImproveSource.fromPrev || !selectedImproveSource.id) {
        setImproveFile(null);
        setImproveDocumentId(null);
        setParseLoading(false);
        setImproveErr(
          "Pick a .pptx or .pdf from Previous Uploads, or upload a file locally.",
        );
        return;
      }
      const reqId = ++parseRequestIdRef.current;
      setImproveFile(null);
      setImproveDocumentId(selectedImproveSource.id);
      setParseLoading(true);
      void (async () => {
        try {
          const res = await fetch("/api/improve-ppt/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: selectedImproveSource.id,
              model: improveAiModel,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (reqId !== parseRequestIdRef.current) return;
          if (!res.ok) throw new Error(data.error || "Could not read slides");
          setParsedSlides(Array.isArray(data.slides) ? data.slides : []);
          if (data.ocrWarning) {
            setImproveErr(String(data.ocrWarning));
          }
        } catch (err) {
          if (reqId !== parseRequestIdRef.current) return;
          setImproveErr(err?.message || String(err));
          setParsedSlides(null);
        } finally {
          if (reqId === parseRequestIdRef.current) setParseLoading(false);
        }
      })();
      return;
    }

    // Local picks are uploaded to Blob in addLocalFiles before parse runs.
    setImproveFile(null);
    setImproveDocumentId(null);
    setParseLoading(false);
    setImproveErr(
      "File upload did not finish. Remove the file and upload again.",
    );
  }, [
    dashMode,
    selectedImproveSourceKey,
    selectedImproveSource,
    improveAiModel,
  ]);

  const DEFAULT_2SLIDES_THEME_QUERY = "business";

  function restoreImproveThemeForProvider(provider) {
    const stored = readStoredThemeChoice("improve", provider);
    if (stored?.id) {
      setSelectedThemeId(stored.id);
      setSelectedTemplateSpec({
        _themeName: stored.name || "Theme",
        _summary: stored.description || "",
      });
      return;
    }
    setSelectedThemeId(null);
    setSelectedTemplateSpec(null);
  }

  const loadImproveThemeList = useCallback(
    async (searchQuery) => {
      setThemeSearchLoading(true);
      setThemeSearchErr("");
      try {
        const provider = improveProvider === "2slides" ? "2slides" : "alai";
        const params = new URLSearchParams({ provider, limit: "24" });
        const q = String(searchQuery ?? "").trim();
        if (provider === "2slides") {
          params.set("query", q || DEFAULT_2SLIDES_THEME_QUERY);
        }
        const res = await fetch(`/api/themes?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error || data.hint || "Could not load design templates",
          );
        }
        let themes = (Array.isArray(data.themes) ? data.themes : []).map(
          (t) => ({
            id: String(t.id || t.theme_id || ""),
            name: String(t.name || t.title || t.label || "").trim(),
            description: String(t.description || "").trim(),
            tags: t.tags,
            themeURL: String(t.themeURL || ""),
          }),
        );
        if (provider === "alai" && q) {
          const needle = q.toLowerCase();
          themes = themes.filter(
            (t) =>
              t.name.toLowerCase().includes(needle) ||
              t.description.toLowerCase().includes(needle) ||
              String(t.tags || "")
                .toLowerCase()
                .includes(needle),
          );
        }
        themes = themes.filter((t) => t.id);
        const stored = readStoredThemeChoice("improve", provider);
        const want = selectedThemeId || stored?.id || null;
        const nextId = pickThemeIdAfterListLoad(want, themes);
        if (nextId !== selectedThemeId) setSelectedThemeId(nextId);
        if (
          !selectedTemplateSpec &&
          nextId &&
          stored?.id === nextId &&
          stored.name
        ) {
          setSelectedTemplateSpec({
            _themeName: stored.name,
            _summary: stored.description || "",
          });
        }
        const mergeMeta = selectedTemplateSpec || {
          name: stored?.name,
          description: stored?.description,
        };
        setThemeResults(
          mergeSelectedThemeIntoList(
            themes,
            nextId || selectedThemeId,
            mergeMeta,
          ),
        );
        setThemeResultsQuery(q);
        if (themes.length === 0) {
          setThemeSearchErr(
            data.hint ||
              (provider === "alai"
                ? "No Alai themes match. Clear the filter or check ALAI_API_KEY."
                : "No templates found. Try another search term."),
          );
        }
      } catch (e) {
        setThemeSearchErr(e?.message || String(e));
        setThemeResults([]);
      } finally {
        setThemeSearchLoading(false);
      }
    },
    [improveProvider, selectedThemeId, selectedTemplateSpec],
  );

  useEffect(() => {
    if (!templatePickerOpen) return;
    void loadImproveThemeList("");
  }, [templatePickerOpen, improveProvider, loadImproveThemeList]);

  if (status === "loading")
    return (
      <div className="app">
        <div className="body dash-loading-body">
          <div className="dash-loading-spinner" aria-hidden />
        </div>
      </div>
    );

  function addPickedImageFromUrl(url, thumb) {
    if (!url || pickedUserImages.length >= 10) return;
    const maxSlide = parsedSlides?.length || 1;
    const idx = Math.min(Number(improveTargetSlide) || 1, maxSlide);
    setPickedUserImages((prev) => {
      const filtered = prev.filter((p) => p.slideIndex !== idx);
      return [...filtered, { slideIndex: idx, url, thumb }];
    });
  }

  function removePickedImage(slideIndex) {
    setPickedUserImages((prev) =>
      prev.filter((p) => p.slideIndex !== slideIndex),
    );
  }

  async function handleThemeSearch() {
    await loadImproveThemeList(themeQuery);
  }

  async function handleThemeSelect(t) {
    if (!t?.id) return;
    setSelectedThemeId(t.id);
    writeStoredThemeChoice("improve", improveProvider, t);
    const displaySpec = {
      _themeName: String(t.name || "Theme").trim(),
      _summary: String(t.description || "").trim(),
    };
    if (improveProvider === "2slides") {
      setSelectedTemplateSpec(displaySpec);
      setTemplatePickerOpen(false);
      return;
    }
    if (t._templateSpec) {
      setSelectedTemplateSpec(t._templateSpec);
      setTemplatePickerOpen(false);
      return;
    }
    setSelectedTemplateSpec(displaySpec);
    if (!t.themeURL) {
      setTemplatePickerOpen(false);
      return;
    }
    setThemeSearchLoading(true);
    setThemeSearchErr("");
    try {
      const baseQ = (themeResultsQuery || themeQuery).trim() || t.name;
      const params = new URLSearchParams({
        q: baseQ,
        model: improveAiModel,
        themeId: String(t.id),
        themeName: t.name || "",
      });
      const res = await fetch(
        `/api/improve-ppt/theme-search?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Theme fetch failed");
      if (data.templateSpec) {
        setSelectedTemplateSpec(data.templateSpec);
      }
      setTemplatePickerOpen(false);
    } catch (e) {
      setThemeSearchErr(e?.message || String(e));
    } finally {
      setThemeSearchLoading(false);
    }
  }

  async function handleImproveImageSearch() {
    const q = improveImgQuery.trim();
    setImproveImgSearchHint("");
    if (!q) return;
    if (!parsedSlides?.length) {
      setImproveImgSearchHint("Upload a .pptx or .pdf file first.");
      return;
    }
    setImproveImgSearchLoading(true);
    try {
      const res = await fetch(
        `/api/improve-ppt/image-search?q=${encodeURIComponent(q.slice(0, 200))}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Image search failed");
      setImproveImgResults(Array.isArray(data.results) ? data.results : []);
      setImproveImgSearchHint(
        data.hint || (data.results?.length ? "" : "No results found."),
      );
    } catch (e) {
      setImproveImgSearchHint(e?.message || String(e));
    } finally {
      setImproveImgSearchLoading(false);
    }
  }

  async function runImprovePlanNow() {
    if (!parsedSlides?.length || !improveInstructions.trim()) return [];
    setPlanLoading(true);
    setPlanError("");
    try {
      const res = await fetch("/api/improve-ppt/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: parsedSlides,
          instructions: improveInstructions.trim(),
          model: improveAiModel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Planning failed");
      const adj = Array.isArray(data.adjustments) ? data.adjustments : [];
      setPlanAdjustments(adj);
      return adj;
    } catch (e) {
      setPlanError(e?.message || String(e));
      setPlanAdjustments([]);
      return [];
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleImproveGenerate() {
    setImproveErr("");
    if (!parsedSlides?.length) {
      setImproveErr(
        "Upload a .pptx or .pdf file and wait until slides finish loading.",
      );
      return;
    }
    if (!improveInstructions.trim()) {
      setImproveErr("Describe what you want to improve.");
      return;
    }
    if (improveProvider === "2slides" && !selectedThemeId) {
      setImproveErr("Choose a design template before building with 2slides.");
      return;
    }
    setImproveGenLoading(true);
    try {
      const adjustments = await runImprovePlanNow();
      const payload = {
        instructions: improveInstructions.trim(),
        model: improveAiModel,
        provider: improveProvider,
        slides: parsedSlides,
        adjustments,
        addStockImages,
        sourceName: improveFile?.name || selectedImproveSource?.name || "",
        ...(improveDocumentId != null && improveDocumentId > 0
          ? { documentId: improveDocumentId }
          : {}),
        additiveImprove,
        detailLevel: improveDetailLevel,
        themeId: selectedThemeId || undefined,
        templateSpec:
          improveProvider === "alai"
            ? (selectedTemplateSpec ?? undefined)
            : undefined,
        userImageRefs: pickedUserImages.map((p) => ({
          slideIndex: p.slideIndex,
          url: p.url,
        })),
      };
      const fd = new FormData();
      if (improveFile) fd.append("file", improveFile);
      fd.append("payload", JSON.stringify(payload));
      const res = await fetch("/api/improve-ppt/generate", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let msg = "Generate failed";
        try {
          const err = await res.json();
          if (err?.error) msg = err.error;
        } catch {}
        throw new Error(msg);
      }
      const pptxBlob = await res.blob();
      const url = URL.createObjectURL(pptxBlob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      a.download = match?.[1] || "improved-slides.pptx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setImproveErr(e.message || String(e));
    } finally {
      setImproveGenLoading(false);
    }
  }

  async function openDocFilePreview(doc, e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setDocPreviewDoc(doc);
    setDocPreviewSetupErr("");
    setDocPreviewSrc("");
    setDocPreviewText("");
    setDocPreviewTabHref(
      doc.id
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/documents/${doc.id}/view`
        : "",
    );
    setDocPreviewIframeLoading(true);
    setDocPreviewTokenLoading(Boolean(doc.id));
    setDocPreviewOpen(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const basePath = doc.id ? `/api/documents/${doc.id}/view` : "";

    try {
      if (doc.file && shouldUseTextDocumentPreview(doc)) {
        const text = await readLocalFileAsText(doc.file);
        setDocPreviewText(text);
        setDocPreviewIframeLoading(false);
        setDocPreviewTokenLoading(false);
        return;
      }

      if (!doc.id) {
        setDocPreviewSetupErr("Preview is available after the file is uploaded.");
        setDocPreviewIframeLoading(false);
        return;
      }

      if (shouldUseTextDocumentPreview(doc)) {
        const text = await fetchDocumentTextContent(doc.id);
        setDocPreviewText(text);
        setDocPreviewTabHref(`${origin}${basePath}`);
        setDocPreviewIframeLoading(false);
        return;
      }

      if (isOfficePreviewName(doc.name)) {
        const res = await fetch(`/api/documents/${doc.id}/view-token`);
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 404) {
          setDocPreviewSetupErr(data.error || "Preview link not available");
          setDocPreviewIframeLoading(false);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Could not prepare preview");
        const viewUrl = `${origin}${basePath}?t=${encodeURIComponent(data.token)}`;
        const enc = encodeURIComponent(viewUrl);
        setDocPreviewSrc(
          `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`,
        );
        setDocPreviewTabHref(
          `https://view.officeapps.live.com/op/view.aspx?src=${enc}`,
        );
      } else {
        setDocPreviewSrc(`${origin}${basePath}?v=${Date.now()}`);
        setDocPreviewTabHref(`${origin}${basePath}`);
      }
    } catch (err) {
      setDocPreviewSetupErr(err?.message || String(err));
      setDocPreviewIframeLoading(false);
    } finally {
      setDocPreviewTokenLoading(false);
    }
  }

  function openSelectedFilePreview(f, e) {
    openDocFilePreview(
      {
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        sourceUrl: f.sourceUrl || null,
        file: f.file,
      },
      e,
    );
  }

  function closeDocPreview() {
    setDocPreviewOpen(false);
    setDocPreviewDoc(null);
    setDocPreviewSrc("");
    setDocPreviewText("");
    setDocPreviewTabHref("");
    setDocPreviewIframeLoading(true);
    setDocPreviewTokenLoading(false);
    setDocPreviewSetupErr("");
  }

  return (
    <>
      <div className={`app ${sidebarOpen ? "app--sidebar-open" : ""}`}>
        <div className="body">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <div className="sidebar-toggle-dot" />
            <span>{sidebarOpen ? "Hide panel" : "Show panel"}</span>
          </button>

          <DashboardSidebar
            isGuest={isGuest}
            sidebarWidth={sidebarWidth}
            sidebarSection={sidebarSection}
            setSidebarSection={setSidebarSection}
            historyLoading={historyLoading}
            history={history}
            historySearch={historySearch}
            onHistorySearchChange={setHistorySearch}
            onHistoryNavigate={(id, sources) => {
              const q = sources
                ? `?sources=${encodeURIComponent(sources)}`
                : "";
              router.push(`/summary/${id}${q}`);
            }}
            onHistoryRefresh={() => void mutateHistory()}
            onHistoryUpdated={(updater) => {
              void mutateHistory(
                (current) => {
                  if (!current?.summaries) return current;
                  return { ...current, summaries: updater(current.summaries) };
                },
                { revalidate: false },
              );
            }}
            timeAgo={timeAgo}
            prevLoading={prevLoading}
            prevUploads={prevUploads}
            selectedPrevDocIds={selectedPrevDocIds}
            toggleSelectAllPrevDocs={toggleSelectAllPrevDocs}
            handleRemoveSelectedDocuments={handleRemoveSelectedDocuments}
            bulkRemoving={bulkRemoving}
            prevSelectionMode={prevSelectionMode}
            enterPrevSelectionMode={enterPrevSelectionMode}
            exitPrevSelectionMode={exitPrevSelectionMode}
            removingDocId={removingDocId}
            selectedFiles={selectedFiles}
            addPrevFile={addPrevFile}
            togglePrevDocSelection={togglePrevDocSelection}
            openDocFilePreview={openDocFilePreview}
            handleRemoveDocument={handleRemoveDocument}
            formatBytes={formatBytes}
          />

          <SidebarResizeSplitter
            className="sidebar-splitter-desktop"
            onMouseDown={onSidebarResizeStart}
          />

          {/* ── MAIN GRID ── */}
          <main className="main">
            {/* Panel 1 — Files */}
            <div
              className={`panel${dragging ? " panel--drop-active" : ""}`}
              onDragEnter={onFilePanelDragEnter}
              onDragLeave={onFilePanelDragLeave}
              onDragOver={onFilePanelDragOver}
              onDrop={onFilePanelDrop}
            >
              <div>
                <div className="panel-title">
                  {dashMode === "improve"
                    ? "Presentation for improve"
                    : "Uploaded / Selected Files"}
                </div>
                <div className="improve-slot-row">
                  <div className="panel-sub">
                    {dashMode === "improve"
                      ? selectedFiles.length > 0
                        ? "1 file loaded — remove it to pick another or add a new upload"
                        : "Add one .pptx or .pdf — only a single file is used in Improve mode"
                      : `${selectedFiles.length} document${selectedFiles.length !== 1 ? "s" : ""} selected`}
                  </div>
                  {dashMode === "improve" && (
                    <span
                      className="improve-slot-pill"
                      title="Improve mode accepts one presentation only"
                    >
                      {selectedFiles.length >= 1 ? "1 / 1 slot" : "0 / 1 slot"}
                    </span>
                  )}
                </div>
              </div>

              {dashMode === "improve" && (
                <div className="improve-files-banner" role="status">
                  <span
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  >
                    ⓘ
                  </span>
                  <span>
                    <strong>Improve mode:</strong> choose exactly one .pptx or
                    .pdf. Accepts 1 file only.
                  </span>
                </div>
              )}

              {isGuest && dashMode !== "improve" ? (
                <div className="upload-limit-banner" role="status">
                  <span aria-hidden="true" style={{ flexShrink: 0 }}>
                    ⓘ
                  </span>
                  <span>
                    <strong>Guest upload limit:</strong> {uploadLimitCopy()}
                  </span>
                </div>
              ) : null}

              {filePanelError ? (
                <div className="file-panel-error" role="alert">
                  {filePanelError}
                </div>
              ) : null}

              {selectedFiles.length > 0 ? (
                <>
                  <div
                    className={`file-list${dashMode === "improve" ? " improve-single" : ""}`}
                  >
                    {selectedFiles.map((f) => {
                      const fileUploading =
                        dashMode === "improve" && Boolean(f.uploading);
                      const fileParsing =
                        dashMode === "improve" &&
                        !fileUploading &&
                        parseLoading &&
                        selectedImproveSource?.name === f.name;
                      const fileBusy = fileUploading || fileParsing;
                      const busyLabel = fileUploading
                        ? "Uploading…"
                        : fileParsing
                          ? "Reading slides…"
                          : "";
                      return (
                        <div
                          className={`file-item${fileBusy ? " file-item--busy" : ""}`}
                          key={f.name}
                          aria-busy={fileBusy || undefined}
                        >
                          <FileIcon type={f.type} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="file-name" title={f.name}>
                              {f.name}
                            </div>
                            <div className="file-size">
                              {f.size}
                              {f.sourceUrl ? (
                                <span className="file-web-tag">
                                  {" "}
                                  ·{" "}
                                  {domainFromSourceUrl(f.sourceUrl) || "website"}
                                </span>
                              ) : null}
                              {f.fromPrev && !f.sourceUrl && !fileBusy && (
                                <span className="file-prev-tag">
                                  {" "}
                                  · prev upload
                                </span>
                              )}
                            </div>
                            {fileBusy ? (
                              <div className="file-item-status" role="status">
                                <span className="improve-mini-spin" />
                                {busyLabel}
                              </div>
                            ) : null}
                          </div>
                          <span className="file-badge">{f.type}</span>
                          {f.id || f.file ? (
                            <button
                              type="button"
                              className="file-preview-btn"
                              title="Preview file"
                              disabled={fileBusy}
                              onClick={(e) => openSelectedFilePreview(f, e)}
                            >
                              View
                            </button>
                          ) : null}
                          <button
                            className="file-remove"
                            disabled={fileBusy}
                            title={
                              fileBusy
                                ? "Wait until upload and slide read finish"
                                : "Remove file"
                            }
                            onClick={() => removeFile(f.name)}
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {dashMode !== "improve" ? renderFileDropPanel({ compact: true }) : null}
                </>
              ) : (
                renderFileDropPanel()
              )}

              {dashMode === "improve" && improveFileBusy ? (
                <div className="improve-file-panel-status" role="status">
                  <span className="improve-mini-spin" />
                  {improveFileBusyLabel}
                </div>
              ) : null}

              {dashMode === "improve" &&
              selectedFiles.length > 0 &&
              !improveFileBusy ? (
                <div className="upload-hint">
                  Remove the file above to choose a different one.
                </div>
              ) : null}
            </div>

            {/* Panel 2 — Prompt / Output */}
            <div className="panel panel--prompt">
              {dashMode === "improve" ? (
                <>
                  <div>
                    <div className="panel-title">What should change?</div>
                    <div className="panel-sub">
                      Describe design/content improvements for the lecture
                      slides
                    </div>
                  </div>

                  <div>
                    <div className="improve-section-head">Improve mode</div>
                    <div className="improve-mode-tabs">
                      <button
                        type="button"
                        className={`improve-mode-tab ${additiveImprove ? "active" : ""}`}
                        onClick={() => setAdditiveImprove(true)}
                      >
                        <span className="improve-mode-tab-name">Additive</span>
                        <span className="improve-mode-tab-sub">
                          Keep original wording, add on top
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`improve-mode-tab ${!additiveImprove ? "active" : ""}`}
                        onClick={() => setAdditiveImprove(false)}
                      >
                        <span className="improve-mode-tab-name">
                          Full redesign
                        </span>
                        <span className="improve-mode-tab-sub">
                          Rewrite titles, bullets, structure
                        </span>
                      </button>
                    </div>
                  </div>

                  <PromptSuggestionsMenu
                    suggestions={DASH_PROMPT_SUGGESTIONS.improve}
                    placeholder={
                      "e.g. Switch to a green theme and add images. Expand speaker notes, keep bullets concise. Tighten bullets for clarity."
                    }
                    value={improveInstructions}
                    onChange={setImproveInstructions}
                    onSelect={setImproveInstructions}
                    countLabel={`${improveInstructions.length} / 500`}
                  />
                </>
              ) : summaryOutput ? (
                <>
                  <div className="output-header">
                    <div>
                      <div className="panel-title">Summary Output</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <span
                          className={`status-badge ${summaryOutput.summarizeFor === "lecturer" ? "badge-lecturer" : "badge-student"}`}
                        >
                          {summaryOutput.summarizeFor}
                        </span>
                        <span className="status-badge badge-model">
                          {modelDisplayName(summaryOutput.model)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={`copy-btn ${copied ? "copied" : ""}`}
                        onClick={handleCopy}
                      >
                        <CopyIcon /> {copied ? "copied" : "Copy"}
                      </button>
                      <button
                        className="copy-btn"
                        onClick={() => setSummaryOutput(null)}
                      >
                        New
                      </button>
                    </div>
                  </div>
                  <div className="output-area">
                    <div
                      className="output-text"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(summaryOutput.output),
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="panel-title">Additional Prompts</div>
                    <div className="panel-sub">
                      Optional — refine the summary
                    </div>
                  </div>
                  <PromptSuggestionsMenu
                    suggestions={
                      summarizeFor === "lecturer"
                        ? DASH_PROMPT_SUGGESTIONS.summarizeLecturer
                        : DASH_PROMPT_SUGGESTIONS.summarizeStudent
                    }
                    placeholder={
                      "ex: focus on key concepts and definitions\nex: highlight any formulas or theorems\nex: point out the concept of Denormalization..."
                    }
                    value={prompt}
                    onChange={setPrompt}
                    onSelect={setPrompt}
                    countLabel={`${prompt.length} / 500`}
                  />
                </>
              )}
            </div>

            {/* Panel 3 — Controls */}
            <div className="panel panel--controls">
              {/* ── Mode dropdown ── */}
              <div className="mode-dropdown-wrap">
                <div className="mode-dropdown-label">
                  What would you like to do?
                </div>
                <div className="model-wrap">
                  <button
                    className={`model-btn ${modeOpen ? "open" : ""}`}
                    onClick={() => setModeOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setModeOpen(false), 150)}
                  >
                    <div className="model-left">
                      <div className="model-dot" />
                      <span>
                        {dashMode === "improve"
                          ? "Improve Lecture Slides Design/Content"
                          : "Summarize Notes"}
                      </span>
                    </div>
                    <ChevronDownIcon />
                  </button>
                  {modeOpen && (
                    <div className="model-menu">
                      {[
                        { value: "summarize", label: "Summarize Notes" },
                        {
                          value: "improve",
                          label: "Improve Lecture Slides Design/Content",
                          guestLocked: true,
                        },
                      ].map((opt) => (
                        <div
                          key={opt.value}
                          className={`model-opt ${(dashMode ?? "summarize") === opt.value ? "on" : ""}${isGuest && opt.guestLocked ? " model-opt--guest-locked" : ""}`}
                          onMouseDown={() => {
                            if (isGuest && opt.guestLocked) return;
                            setDashMode(opt.value);
                            setModeOpen(false);
                          }}
                          title={
                            isGuest && opt.guestLocked
                              ? "Sign in to use this feature"
                              : undefined
                          }
                        >
                          <div className="model-opt-name">{opt.label}</div>
                          {isGuest && opt.guestLocked ? (
                            <span className="model-opt-guest-hint">
                              Sign in to use
                            </span>
                          ) : (dashMode ?? "summarize") === opt.value ? (
                            <span className="model-check">✓</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Summarize mode ── */}
              {(dashMode === null || dashMode === "summarize") && (
                <>
                  <div>
                    <div className="radio-label">Summarize for</div>
                    {[
                      {
                        id: "lecturer",
                        title: "Lecturer",
                        sub: "Detailed summary + related journal references",
                      },
                      {
                        id: "student",
                        title: "Student",
                        sub: "Simplified, key points",
                      },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        className={`radio-option ${summarizeFor === opt.id ? "selected" : ""}`}
                        onClick={() => setSummarizeFor(opt.id)}
                      >
                        <div
                          className={`radio-dot ${summarizeFor === opt.id ? "on" : ""}`}
                        />
                        <div>
                          <div className="radio-title">{opt.title}</div>
                          <div className="radio-sub">{opt.sub}</div>
                        </div>
                      </div>
                    ))}
                    {summarizeFor === "lecturer" ? (
                      <p className="pub-year-hint summarize-lecturer-ref-hint">
                        Lecturer mode automatically searches academic databases
                        for relevant articles and references while your summary
                        is generated. Matching papers appear in the References
                        panel on the summary page.
                      </p>
                    ) : null}
                  </div>

                  <div className="pub-year-filter">
                    <div className="pub-year-label">Output length</div>
                    <p className="pub-year-hint">
                      {
                        SUMMARIZE_OUTPUT_LENGTHS.find(
                          (o) => o.id === outputLength,
                        )?.hint
                      }
                    </p>
                    <div className="pub-year-pills" role="group" aria-label="Output length">
                      {SUMMARIZE_OUTPUT_LENGTHS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`pub-year-pill${outputLength === opt.id ? " on" : ""}`}
                          aria-pressed={outputLength === opt.id}
                          onClick={() => setOutputLength(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {summarizeFor === "lecturer" ? (
                    <PublishedYearFilter
                      mode={publishedYearMode}
                      onModeChange={setPublishedYearMode}
                      customFrom={customYearFrom}
                      customTo={customYearTo}
                      onCustomFromChange={setCustomYearFrom}
                      onCustomToChange={setCustomYearTo}
                      appliedCustom={appliedCustomYearRange}
                      onApplyCustom={(range) =>
                        setAppliedCustomYearRange(range)
                      }
                    />
                  ) : null}

                  <div>
                    <div className="model-label">Provider</div>
                    <div className="model-wrap">
                      <button
                        className={`model-btn ${modelOpen ? "open" : ""}`}
                        onClick={() => {
                          setModelOpen((v) => !v);
                          setVariantOpen(false);
                        }}
                        onBlur={() =>
                          setTimeout(() => setModelOpen(false), 150)
                        }
                      >
                        <div className="model-left">
                          <div className="model-dot" />
                          <span>{selectedProvider?.label ?? model}</span>
                        </div>
                        <ChevronDownIcon />
                      </button>
                      {modelOpen && (
                        <div className="model-menu">
                          {MODEL_PROVIDERS.map((m) => {
                            const unavailable = !llmProviders.isProviderAvailable(
                              m.id,
                            );
                            return (
                              <div
                                key={m.id}
                                className={`model-opt ${model === m.id ? "on" : ""} ${unavailable ? "model-opt--guest-locked" : ""}`}
                                title={
                                  unavailable
                                    ? "API key not configured on server"
                                    : undefined
                                }
                                onMouseDown={() => {
                                  if (unavailable) return;
                                  setModelAndVariant(m.id);
                                  setModelOpen(false);
                                }}
                              >
                                <div>
                                  <div className="model-opt-name">{m.label}</div>
                                  {unavailable && (
                                    <div className="model-opt-guest-hint">
                                      Not configured
                                    </div>
                                  )}
                                </div>
                                {model === m.id && !unavailable && (
                                  <span className="model-check">✓</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="model-label">Model version</div>
                    <div className="model-wrap">
                      <button
                        className={`model-btn ${variantOpen ? "open" : ""}`}
                        onClick={() => {
                          setVariantOpen((v) => !v);
                          setModelOpen(false);
                        }}
                        onBlur={() =>
                          setTimeout(() => setVariantOpen(false), 150)
                        }
                      >
                        <div className="model-left">
                          <span>{selectedVariant?.label ?? modelVariant}</span>
                        </div>
                        <ChevronDownIcon />
                      </button>
                      {variantOpen && variants.length > 0 && (
                        <div className="model-menu">
                          {variants.map((v) => (
                            <div
                              key={v.id}
                              className={`model-opt ${modelVariant === v.id ? "on" : ""}`}
                              onMouseDown={() => {
                                setModelVariant(v.id);
                                setVariantOpen(false);
                              }}
                            >
                              <div>
                                <div className="model-opt-name">{v.label}</div>
                                {v.desc && (
                                  <div className="model-opt-desc">{v.desc}</div>
                                )}
                              </div>
                              {modelVariant === v.id && (
                                <span className="model-check">✓</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div className="error-box">{error}</div>}

                  <button
                    className="summarize-btn"
                    onClick={handleSummarize}
                    disabled={
                      loading || uploading || selectedFiles.length === 0
                    }
                  >
                    {loading || uploading ? (
                      <>
                        <div className="spinner" />
                        <LoadingText active>
                          {summarizePhaseLabel(
                            summarizeStep ||
                              (uploading
                                ? SUMMARIZE_PHASE.UPLOAD
                                : SUMMARIZE_PHASE.PREPARE),
                          )}
                        </LoadingText>
                      </>
                    ) : (
                      <>
                        <SparkleIcon /> Summarize
                      </>
                    )}
                  </button>
                </>
              )}

              {/* ── Improve mode ── */}
              {dashMode === "improve" && (
                <div className="improve-panel">
                  {improveGenLoading || planLoading ? (
                    <div className="improve-panel-busy">
                      <div className="improve-section-head">
                        AI plan preview
                      </div>
                      {planLoading && planAdjustments.length === 0 && (
                        <div className="improve-plan-loading">
                          <span className="improve-mini-spin" /> Planning
                          changes…
                        </div>
                      )}
                      {planAdjustments.length > 0 && (
                        <div className="improve-plan-box improve-plan-box--fill">
                          {planAdjustments.map((adj, i) => (
                            <div key={i} className="improve-plan-item">
                              <span className="improve-plan-check">✓</span>
                              <span>
                                {typeof adj === "string"
                                  ? adj
                                  : (adj.description ?? JSON.stringify(adj))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {improveGenLoading && (
                        <div className="improve-generating-status">
                          <span className="improve-mini-spin" />
                          Building PPTX…
                        </div>
                      )}
                      {planError && (
                        <div className="improve-err">{planError}</div>
                      )}
                      {improveErr && (
                        <div className="improve-err">{improveErr}</div>
                      )}
                    </div>
                  ) : (
                    <div className="improve-controls">
                      {improveFileBusy ? (
                        <div className="improve-file-status" role="status">
                          <span className="improve-mini-spin" />
                          <span>{improveFileBusyLabel}</span>
                        </div>
                      ) : null}

                      <div>
                        <div className="radio-label">Detail level</div>
                        {[
                          {
                            value: "concise",
                            title: "Concise",
                            sub: "2+ bullets · brief speaker notes",
                          },
                          {
                            value: "lecture",
                            title: "Lecture",
                            sub: "3–6 full-sentence bullets · examples in notes",
                          },
                          {
                            value: "deep",
                            title: "Deep",
                            sub: "4–8 bullets · definitions, examples, misconceptions",
                          },
                        ].map((opt) => (
                          <div
                            key={opt.value}
                            className={`radio-option ${improveDetailLevel === opt.value ? "selected" : ""}`}
                            onClick={() => setImproveDetailLevel(opt.value)}
                          >
                            <div
                              className={`radio-dot ${improveDetailLevel === opt.value ? "on" : ""}`}
                            />
                            <div>
                              <div className="radio-title">{opt.title}</div>
                              <div className="radio-sub">{opt.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="improve-section-head">
                          Slide generator
                        </div>
                        <div className="improve-mode-tabs">
                          <button
                            type="button"
                            className={`improve-mode-tab ${improveProvider === "alai" ? "active" : ""}`}
                            onClick={() => {
                              setImproveProvider("alai");
                              restoreImproveThemeForProvider("alai");
                            }}
                          >
                            <span className="improve-mode-tab-name">Alai</span>
                            <span className="improve-mode-tab-sub">
                              AI-designed slides and layout
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`improve-mode-tab ${improveProvider === "2slides" ? "active" : ""}`}
                            onClick={() => {
                              setImproveProvider("2slides");
                              restoreImproveThemeForProvider("2slides");
                            }}
                          >
                            <span className="improve-mode-tab-name">
                              2slides
                            </span>
                            <span className="improve-mode-tab-sub">
                              Template-based Fast PPT
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="improve-section-head">
                        Design template{" "}
                        <span
                          style={{
                            fontWeight: 400,
                            textTransform: "none",
                            fontSize: 10,
                          }}
                        >
                          {improveProvider === "2slides"
                            ? "(required)"
                            : "(optional)"}
                        </span>
                      </div>
                      {selectedTemplateSpec ? (
                        <div className="improve-template-selected">
                          <div className="improve-template-info">
                            <div className="improve-template-name">
                              {selectedTemplateSpec._themeName}
                            </div>
                            <div className="improve-template-vibe">
                              {selectedTemplateSpec._summary}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="improve-template-change"
                            onClick={() => setTemplatePickerOpen(true)}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="improve-btn-secondary improve-template-btn"
                          onClick={() => setTemplatePickerOpen(true)}
                        >
                          {themeSearchLoading ? (
                            <span className="improve-mini-spin" />
                          ) : (
                            "Choose template…"
                          )}
                        </button>
                      )}
                      {themeSearchErr && (
                        <div className="improve-err">{themeSearchErr}</div>
                      )}
                      {improveProvider === "2slides" && !selectedThemeId && (
                        <div className="improve-provider-hint">
                          Search and select a 2slides theme to enable Build
                          PPTX.
                        </div>
                      )}

                      <div className="improve-section-head">AI model</div>
                      <div className="model-wrap">
                        <button
                          className={`model-btn ${improveModelOpen ? "open" : ""}`}
                          onClick={() => setImproveModelOpen((v) => !v)}
                          onBlur={() =>
                            setTimeout(() => setImproveModelOpen(false), 150)
                          }
                        >
                          <div className="model-left">
                            <div className="model-dot" />
                            <span>{improveAiModel}</span>
                          </div>
                          <ChevronDownIcon />
                        </button>
                        {improveModelOpen && (
                          <div className="model-menu">
                            {["ChatGPT", "DeepSeek", "Gemini"].map((opt) => {
                              const unavailable =
                                !llmProviders.isLabelAvailable(opt);
                              return (
                                <div
                                  key={opt}
                                  className={`model-opt ${improveAiModel === opt ? "on" : ""} ${unavailable ? "model-opt--guest-locked" : ""}`}
                                  title={
                                    unavailable
                                      ? "API key not configured on server"
                                      : undefined
                                  }
                                  onMouseDown={() => {
                                    if (unavailable) return;
                                    setImproveAiModel(opt);
                                    setImproveModelOpen(false);
                                  }}
                                >
                                  <div>
                                    <div className="model-opt-name">{opt}</div>
                                    {unavailable && (
                                      <div className="model-opt-guest-hint">
                                        Not configured
                                      </div>
                                    )}
                                  </div>
                                  {improveAiModel === opt && !unavailable && (
                                    <span className="model-check">✓</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {improveErr && (
                        <div className="improve-err">{improveErr}</div>
                      )}

                      <div className="improve-btn-row">
                        <button
                          className="improve-btn-primary improve-btn-full"
                          onClick={handleImproveGenerate}
                          disabled={
                            improveGenLoading ||
                            uploading ||
                            parseLoading ||
                            !parsedSlides?.length ||
                            !improveInstructions.trim() ||
                            (improveProvider === "2slides" && !selectedThemeId)
                          }
                        >
                          {improveGenLoading ? (
                            <span className="improve-mini-spin" />
                          ) : (
                            "✦"
                          )}{" "}
                          Build PPTX
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {docPreviewOpen && docPreviewDoc && (
        <DocumentPreviewModal
          doc={docPreviewDoc}
          onClose={closeDocPreview}
          formatBytes={formatBytes}
          docPreviewTabHref={docPreviewTabHref}
          docPreviewSrc={docPreviewSrc}
          docPreviewTokenLoading={docPreviewTokenLoading}
          docPreviewIframeLoading={docPreviewIframeLoading}
          docPreviewSetupErr={docPreviewSetupErr}
          textContent={docPreviewText || null}
          onPreviewIframeLoad={() => {
            setTimeout(() => setDocPreviewIframeLoading(false), 650);
          }}
        />
      )}

      <AddSourcesModal
        open={addSourcesOpen}
        onClose={() => setAddSourcesOpen(false)}
        accept={dashMode === "improve" ? IMPROVE_ACCEPT : ACCEPTED}
        multiple={dashMode !== "improve"}
        improveMode={dashMode === "improve"}
        isGuest={isGuest}
        uploadLimitText={uploadLimitCopy()}
        prevUploads={prevUploads}
        prevLoading={prevLoading}
        onPickFiles={(files) => addLocalFiles(files)}
        onImportWebSource={handleAddWebSource}
        onWebSearch={handleWebSearch}
        onSelectPrevious={addPrevFile}
        importing={linkImporting || uploading}
      />

      <TemplatePickerModal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        themeQuery={themeQuery}
        onThemeQueryChange={setThemeQuery}
        onSearch={handleThemeSearch}
        themeSearchLoading={themeSearchLoading}
        themeSearchErr={themeSearchErr}
        themeResults={themeResults}
        selectedThemeId={selectedThemeId}
        onSelectTheme={handleThemeSelect}
      />

      {useExistingDialog && (
        <div
          className="modal-backdrop"
          onClick={() => setUseExistingDialog(null)}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Files already on server</div>
            <div className="modal-desc">
              {useExistingDialog.names.length} file
              {useExistingDialog.names.length !== 1 ? "s" : ""} with the same
              name
              {useExistingDialog.names.length === 1 ? " is" : " are"} already
              uploaded. Use existing uploads to avoid duplicates?
            </div>
            <div className="modal-btns">
              <button
                className="modal-btn secondary"
                onClick={() => handleUseExistingConfirm(false)}
              >
                Upload again
              </button>
              <button
                className="modal-btn primary"
                onClick={() => handleUseExistingConfirm(true)}
              >
                Use existing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
