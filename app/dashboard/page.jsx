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
import DashboardSidebar from "./components/DashboardSidebar";
import DocumentPreviewModal from "./components/DocumentPreviewModal";
import TemplatePickerModal from "./components/TemplatePickerModal";

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
  const summarizeDefaultApplied = useRef(false);
  const [model, setModel] = useState("chatgpt"); // provider: chatgpt | deepseek | gemini
  const [modelVariant, setModelVariant] = useState("gpt-4o"); // exact model id for API
  const [modelOpen, setModelOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false); // summarizing
  const [uploading, setUploading] = useState(false); // uploading files
  const [summaryOutput, setSummaryOutput] = useState(null); // latest result
  const [copied, setCopied] = useState(false);

  const [expandedHistory, setExpandedHistory] = useState(null);
  const [sidebarSection, setSidebarSection] = useState({
    history: true,
    prev: true,
  });
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarDragRef = useRef({ active: false, startX: 0, startW: 220 });

  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [docPreviewDoc, setDocPreviewDoc] = useState(null);
  const [docPreviewSrc, setDocPreviewSrc] = useState("");
  const [docPreviewTabHref, setDocPreviewTabHref] = useState("");
  const [docPreviewTokenLoading, setDocPreviewTokenLoading] = useState(false);
  const [docPreviewSetupErr, setDocPreviewSetupErr] = useState("");
  const [docPreviewIframeLoading, setDocPreviewIframeLoading] = useState(true);

  const [error, setError] = useState("");

  const {
    data: historyData,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR(status === "authenticated" ? "/api/history" : null, swrFetcher);
  const history = historyData?.summaries || [];
  const [historySearch, setHistorySearch] = useState("");
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) => {
      if (
        String(h.title || "")
          .toLowerCase()
          .includes(q)
      )
        return true;
      return (h.files || []).some((f) =>
        String(f.name || "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [history, historySearch]);

  const {
    prevUploads,
    prevLoading,
    mutateUploads,
    removingDocId,
    selectedPrevDocIds,
    bulkRemoving,
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
  const [improveAiModel, setImproveAiModel] = useState("Gemini");
  const [improveModelOpen, setImproveModelOpen] = useState(false);

  const [useExistingDialog, setUseExistingDialog] = useState(null); // { names: string[] } when files already on server
  const fileInputRef = useRef();
  const fileDragDepthRef = useRef(0);

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status]);

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

  function addLocalFiles(newFiles) {
    const arr = Array.from(newFiles).map((f) => ({
      file: f,
      name: f.name,
      type: getExt(f.name),
      size: formatBytes(f.size),
      fromPrev: false,
    }));

    if (dashMode === "improve") {
      const deck = arr.filter((f) => isImproveSourceType(f.type));
      if (deck.length === 0) {
        setError("Improve mode only supports .pptx or .pdf files.");
        setSelectedFiles([]);
        return;
      }
      setError("");
      setSelectedFiles([deck[deck.length - 1]]);
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

  function openFilePicker() {
    fileInputRef.current?.click();
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
      },
    ]);
  }

  // ── Upload files to Vercel Blob via API ────────────────
  async function uploadNewFiles(files) {
    const list = files ?? selectedFiles;
    const newFiles = list.filter((f) => !f.fromPrev && f.file);
    if (newFiles.length === 0) return [];

    setUploading(true);
    const formData = new FormData();
    newFiles.forEach((f) => formData.append("files", f.file));

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) throw new Error(data.error || "Upload failed");

    mutateUploads();
    return data.documents; // [{id, name, type, size, ...}]
  }

  // ── Upload + summarize (used by handleSummarize and by "use existing" dialog)
  async function doUploadAndSummarize(filesOverride = null) {
    const files = filesOverride !== null ? filesOverride : selectedFiles;
    if (!files.length) return;

    setError("");
    setLoading(true);
    setSummaryOutput(null);

    try {
      let uploadedDocs = [];
      try {
        uploadedDocs = await uploadNewFiles(files);
      } catch (err) {
        setError("File upload failed: " + err.message);
        setLoading(false);
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
        return;
      }

      // Create a pending summary row, redirect immediately, then stream generation on the summary page.
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds,
          model,
          modelVariant,
          summarizeFor,
          prompt,
          initOnly: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Failed to start summarization");

      const sid = data?.summaryId;
      if (sid == null) throw new Error("Missing summaryId from server");
      router.push(`/summary/${sid}?autostart=1`);
      mutateHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Summarize: show "use existing?" dialog if some selected files already on server ─────────────────────────────────────────
  async function handleSummarize() {
    if (!selectedFiles.length) return;

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
  const setModelAndVariant = (providerId) => {
    setModel(providerId);
    setModelVariant(getDefaultVariant(providerId));
  };

  const selectedImproveSource =
    selectedFiles.find((f) => isImproveSourceType(f.type)) || null;
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
            body: JSON.stringify({ documentId: selectedImproveSource.id }),
          });
          const data = await res.json().catch(() => ({}));
          if (reqId !== parseRequestIdRef.current) return;
          if (!res.ok) throw new Error(data.error || "Could not read slides");
          setParsedSlides(Array.isArray(data.slides) ? data.slides : []);
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

    const f = selectedImproveSource.file;
    const reqId = ++parseRequestIdRef.current;
    setImproveFile(f);
    setImproveDocumentId(null);
    setParseLoading(true);
    void (async () => {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/improve-ppt/parse", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (reqId !== parseRequestIdRef.current) return;
        if (!res.ok) throw new Error(data.error || "Could not read slides");
        setParsedSlides(Array.isArray(data.slides) ? data.slides : []);
      } catch (err) {
        if (reqId !== parseRequestIdRef.current) return;
        setImproveErr(err?.message || String(err));
        setParsedSlides(null);
      } finally {
        if (reqId === parseRequestIdRef.current) setParseLoading(false);
      }
    })();
  }, [dashMode, selectedImproveSourceKey, selectedImproveSource]);

  useEffect(() => {
    const onMove = (e) => {
      if (!sidebarDragRef.current.active) return;
      const dx = e.clientX - sidebarDragRef.current.startX;
      const w = Math.min(
        440,
        Math.max(176, sidebarDragRef.current.startW + dx),
      );
      setSidebarWidth(w);
    };
    const onUp = () => {
      if (sidebarDragRef.current.active) {
        sidebarDragRef.current.active = false;
        document.body.classList.remove("no-select");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("no-select");
    };
  }, []);

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
    const q = themeQuery.trim();
    if (!q) return;
    setThemeSearchLoading(true);
    setThemeSearchErr("");
    try {
      const res = await fetch(
        `/api/improve-ppt/theme-search?q=${encodeURIComponent(q)}&model=${encodeURIComponent(improveAiModel)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Theme search failed");
      const themes = Array.isArray(data.themes) ? data.themes : [];
      if (themes.length > 0 && data.templateSpec)
        themes[0]._templateSpec = data.templateSpec;
      setThemeResults(themes);
      setThemeResultsQuery(q);
      if (data.templateSpec) setSelectedTemplateSpec(data.templateSpec);
    } catch (e) {
      setThemeSearchErr(e?.message || String(e));
    } finally {
      setThemeSearchLoading(false);
    }
  }

  async function handleThemeSelect(t) {
    if (!t?.id) return;
    setSelectedThemeId(t.id);
    if (t._templateSpec) {
      setSelectedTemplateSpec(t._templateSpec);
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
        t._templateSpec = data.templateSpec;
        setSelectedTemplateSpec(data.templateSpec);
      }
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
    setImproveGenLoading(true);
    try {
      const adjustments = await runImprovePlanNow();
      const payload = {
        instructions: improveInstructions.trim(),
        model: improveAiModel,
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
        templateSpec: selectedTemplateSpec ?? undefined,
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

  function onSidebarResizeStart(e) {
    e.preventDefault();
    sidebarDragRef.current = {
      active: true,
      startX: e.clientX,
      startW: sidebarWidth,
    };
    document.body.classList.add("no-select");
  }

  async function openDocFilePreview(doc, e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setDocPreviewDoc(doc);
    setDocPreviewSetupErr("");
    setDocPreviewSrc("");
    setDocPreviewTabHref(
      `${typeof window !== "undefined" ? window.location.origin : ""}/api/documents/${doc.id}/view`,
    );
    setDocPreviewIframeLoading(true);
    setDocPreviewTokenLoading(true);
    setDocPreviewOpen(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const basePath = `/api/documents/${doc.id}/view`;

    try {
      if (isOfficePreviewName(doc.name)) {
        const res = await fetch(`/api/documents/${doc.id}/view-token`);
        const data = await res.json().catch(() => ({}));
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

  function closeDocPreview() {
    setDocPreviewOpen(false);
    setDocPreviewDoc(null);
    setDocPreviewSrc("");
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
            sidebarWidth={sidebarWidth}
            sidebarSection={sidebarSection}
            setSidebarSection={setSidebarSection}
            historyLoading={historyLoading}
            history={filteredHistory}
            historySearch={historySearch}
            onHistorySearchChange={setHistorySearch}
            expandedHistory={expandedHistory}
            setExpandedHistory={setExpandedHistory}
            onHistoryNavigate={(id) => {
              router.push(`/summary/${id}`);
            }}
            timeAgo={timeAgo}
            prevLoading={prevLoading}
            prevUploads={prevUploads}
            selectedPrevDocIds={selectedPrevDocIds}
            toggleSelectAllPrevDocs={toggleSelectAllPrevDocs}
            handleRemoveSelectedDocuments={handleRemoveSelectedDocuments}
            bulkRemoving={bulkRemoving}
            removingDocId={removingDocId}
            selectedFiles={selectedFiles}
            addPrevFile={addPrevFile}
            togglePrevDocSelection={togglePrevDocSelection}
            openDocFilePreview={openDocFilePreview}
            handleRemoveDocument={handleRemoveDocument}
            formatBytes={formatBytes}
          />

          <div
            className="splitter-v sidebar-splitter-desktop"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={onSidebarResizeStart}
          />

          {/* ── MAIN GRID ── */}
          <main
            className="main"
            style={{
              gridTemplateColumns:
                "minmax(320px, 1fr) minmax(320px, 1fr) 300px",
            }}
          >
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

              {selectedFiles.length > 0 ? (
                <div
                  className={`file-list${dashMode === "improve" ? " improve-single" : ""}`}
                >
                  {selectedFiles.map((f) => (
                    <div className="file-item" key={f.name}>
                      <FileIcon type={f.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="file-name" title={f.name}>
                          {f.name}
                        </div>
                        <div className="file-size">
                          {f.size}
                          {f.fromPrev && (
                            <span className="file-prev-tag">
                              {" "}
                              · prev upload
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="file-badge">{f.type}</span>
                      <button
                        className="file-remove"
                        onClick={() => removeFile(f.name)}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FileIcon type={dashMode === "improve" ? "PPTX" : "PDF"} />
                  <span>
                    {dashMode === "improve"
                      ? "No presentation selected"
                      : "No files selected"}
                  </span>
                  <span>
                    {dashMode === "improve"
                      ? "Click upload below or drag a file onto this panel"
                      : "Click upload below, drag files here, or pick from the sidebar"}
                  </span>
                </div>
              )}

              {(dashMode !== "improve" || selectedFiles.length === 0) && (
                <>
                  <button
                    type="button"
                    className={`upload-btn${dragging ? " upload-btn--drag-active" : ""}`}
                    onClick={openFilePicker}
                  >
                    <UploadIcon />{" "}
                    {dashMode === "improve"
                      ? "Upload .pptx / .pdf"
                      : "Upload Documents"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={dashMode !== "improve"}
                    accept={dashMode === "improve" ? IMPROVE_ACCEPT : ACCEPTED}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      addLocalFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
              <div className="upload-hint">
                {dashMode === "improve"
                  ? selectedFiles.length > 0
                    ? "Remove the file above to upload a different one or pick from Previous Uploads."
                    : "(or pick one .pptx or .pdf from Previous Uploads)"
                  : "(or select from sidebar)"}
              </div>
            </div>

            {/* Panel 2 — Prompt / Output */}
            <div className="panel">
              {dashMode === "improve" ? (
                <>
                  <div>
                    <div className="panel-title">What should change?</div>
                    <div className="panel-sub">
                      Describe design/content improvements for the lecture
                      slides
                    </div>
                  </div>
                  <div className="prompt-sugs" aria-label="Improve suggestions">
                    {DASH_PROMPT_SUGGESTIONS.improve.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="prompt-sug"
                        onClick={() =>
                          setImproveInstructions((prev) => {
                            const cur = (prev || "").trim();
                            if (!cur) return s.slice(0, 500);
                            const next = `${cur}\n- ${s}`;
                            return next.slice(0, 500);
                          })
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="prompt-area"
                    placeholder={
                      "e.g. Switch to a green theme and add images. Expand speaker notes, keep bullets concise. Tighten bullets for clarity."
                    }
                    value={improveInstructions}
                    onChange={(e) =>
                      setImproveInstructions(e.target.value.slice(0, 500))
                    }
                  />
                  <div className="prompt-count">
                    {improveInstructions.length} / 500
                  </div>
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
                  <div className="prompt-sugs" aria-label="Prompt suggestions">
                    {(summarizeFor === "lecturer"
                      ? DASH_PROMPT_SUGGESTIONS.summarizeLecturer
                      : DASH_PROMPT_SUGGESTIONS.summarizeStudent
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="prompt-sug"
                        onClick={() =>
                          setPrompt((prev) => {
                            const cur = (prev || "").trim();
                            if (!cur) return s.slice(0, 500);
                            const next = `${cur}\n- ${s}`;
                            return next.slice(0, 500);
                          })
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="prompt-area"
                    placeholder={
                      "ex: focus on key concepts and definitions\nex: highlight any formulas or theorems\nex: point out the concept of Denormalization..."
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                  />
                  <div className="prompt-count">{prompt.length} / 500</div>
                </>
              )}
            </div>

            {/* Panel 3 — Controls */}
            <div className="panel" style={{ minHeight: 340 }}>
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
                        },
                      ].map((opt) => (
                        <div
                          key={opt.value}
                          className={`model-opt ${(dashMode ?? "summarize") === opt.value ? "on" : ""}`}
                          onMouseDown={() => {
                            setDashMode(opt.value);
                            setModeOpen(false);
                          }}
                        >
                          <div className="model-opt-name">{opt.label}</div>
                          {(dashMode ?? "summarize") === opt.value && (
                            <span className="model-check">✓</span>
                          )}
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
                        sub: "Detailed & comprehensive",
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
                  </div>

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
                          {MODEL_PROVIDERS.map((m) => (
                            <div
                              key={m.id}
                              className={`model-opt ${model === m.id ? "on" : ""}`}
                              onMouseDown={() => {
                                setModelAndVariant(m.id);
                                setModelOpen(false);
                              }}
                            >
                              <div className="model-opt-name">{m.label}</div>
                              {model === m.id && (
                                <span className="model-check">✓</span>
                              )}
                            </div>
                          ))}
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
                        {uploading ? "Uploading..." : "Summarizing..."}
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
                  <div className="improve-controls">
                    <div className="improve-section-head">Detail Level</div>
                    <select
                      className="improve-dropdown"
                      value={improveDetailLevel}
                      onChange={(e) => setImproveDetailLevel(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      <option value="concise">Concise</option>
                      <option value="lecture">Lecture (default)</option>
                      <option value="deep">Deep (lecture+)</option>
                    </select>

                    <div className="improve-section-head">
                      Find a Design Template{" "}
                      <span
                        style={{
                          fontWeight: 400,
                          textTransform: "none",
                          fontSize: 10,
                        }}
                      >
                        (optional)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="improve-btn-secondary"
                      onClick={() => setTemplatePickerOpen(true)}
                    >
                      {themeSearchLoading ? (
                        <span className="improve-mini-spin" />
                      ) : (
                        "Choose template..."
                      )}
                    </button>
                    {themeSearchErr && (
                      <div className="improve-err">{themeSearchErr}</div>
                    )}
                    {selectedTemplateSpec && (
                      <div
                        style={{ fontSize: 11, color: "rgba(165,180,252,.9)" }}
                      >
                        ✓ Using:{" "}
                        <strong>{selectedTemplateSpec._themeName}</strong> —{" "}
                        {selectedTemplateSpec._summary}
                      </div>
                    )}

                    <div className="improve-section-head">AI Model</div>
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
                          {["ChatGPT", "DeepSeek", "Gemini"].map((opt) => (
                            <div
                              key={opt}
                              className={`model-opt ${improveAiModel === opt ? "on" : ""}`}
                              onMouseDown={() => {
                                setImproveAiModel(opt);
                                setImproveModelOpen(false);
                              }}
                            >
                              <div className="model-opt-name">{opt}</div>
                              {improveAiModel === opt && (
                                <span className="model-check">✓</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 11.5,
                        color: "rgba(255,255,255,.55)",
                      }}
                      onClick={() => setAdditiveImprove((v) => !v)}
                    >
                      <div
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: 4,
                          border: `1.5px solid ${additiveImprove ? "#818cf8" : "rgba(255,255,255,.2)"}`,
                          background: additiveImprove
                            ? "rgba(99,102,241,.3)"
                            : "transparent",
                          flexShrink: 0,
                          marginTop: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                        }}
                      >
                        {additiveImprove && "✓"}
                      </div>
                      Improve in place (keep original wording unless you ask
                      otherwise)
                    </label>

                    {planAdjustments.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(165,180,252,.85)",
                          background: "rgba(99,102,241,.06)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          border: "1px solid rgba(99,102,241,.15)",
                        }}
                      >
                        {planAdjustments.length} planned adjustment
                        {planAdjustments.length !== 1 ? "s" : ""}
                      </div>
                    )}
                    {planError && (
                      <div className="improve-err">{planError}</div>
                    )}
                    {improveErr && (
                      <div className="improve-err">{improveErr}</div>
                    )}

                    <div className="improve-btn-row">
                      <button
                        className="improve-btn-primary improve-btn-full"
                        onClick={handleImproveGenerate}
                        disabled={
                          improveGenLoading ||
                          parseLoading ||
                          !parsedSlides?.length ||
                          !improveInstructions.trim()
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
          onPreviewIframeLoad={() => {
            setTimeout(() => setDocPreviewIframeLoading(false), 650);
          }}
        />
      )}

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
