"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { markdownToHtml } from "@/lib/markdown";
import {
  ChevronDownIcon,
  CopyIcon,
  FileIcon,
  HistoryIcon,
  SparkleIcon,
  UploadIcon,
  CloseIcon,
} from "../components/icons";

// Provider = which API (ChatGPT / DeepSeek / Gemini). Variant = exact model (e.g. gpt-4o, gemini-2.0-flash).
const MODEL_PROVIDERS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    variants: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4", label: "GPT-4" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    variants: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)" },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    variants: [
      { id: "gemini-3-flash-preview", label: "3 Flash (Preview)", desc: "Fast & capable — best for quick, everyday tasks" },
      { id: "gemini-3.1-flash-lite-preview", label: "3.1 Flash Lite (Preview)", desc: "Lightweight & efficient — ideal for simple, high-volume tasks" },
      { id: "gemini-2.5-flash", label: "2.5 Flash", desc: "Balanced speed & intelligence — great for general-purpose use" },
      { id: "gemini-2.5-pro", label: "2.5 Pro", desc: "Highest quality & deep reasoning — best for complex analysis" },
    ],
  },
];
const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";
const IMPROVE_ACCEPT = ".pptx,.pdf";

function isImproveSourceType(type) {
  const u = String(type || "").toUpperCase();
  return u === "PPTX" || u === "PDF";
}

const OFFICE_PREVIEW_EXT = new Set(["pptx", "ppt", "docx", "doc", "xlsx", "xls"]);

function isOfficePreviewName(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  return OFFICE_PREVIEW_EXT.has(ext);
}

function getDefaultVariant(providerId) {
  const p = MODEL_PROVIDERS.find((m) => m.id === providerId);
  return p?.variants?.[0]?.id ?? "gpt-4o";
}

function modelDisplayName(saved) {
  if (!saved) return "";
  const [providerId, variantId] = saved.split(":");
  const prov = MODEL_PROVIDERS.find((m) => m.id === providerId);
  if (!variantId) return prov?.label ?? saved;
  const variant = prov?.variants?.find((v) => v.id === variantId);
  return variant ? `${prov?.label ?? providerId} · ${variant.label}` : saved;
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

// ── Main Component ─────────────────────────────────────────
export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [selectedFiles, setSelectedFiles]   = useState([]);  // {name, type, size, id?, file?, fromPrev?}
  const [prompt, setPrompt]                 = useState("");
  const [summarizeFor, setSummarizeFor]     = useState("lecturer");
  const [model, setModel]                   = useState("chatgpt");           // provider: chatgpt | deepseek | gemini
  const [modelVariant, setModelVariant]     = useState("gpt-4o");            // exact model id for API
  const [modelOpen, setModelOpen]           = useState(false);
  const [variantOpen, setVariantOpen]       = useState(false);
  const [modeOpen, setModeOpen]             = useState(false);
  const [dragging, setDragging]             = useState(false);
  const [loading, setLoading]               = useState(false);  // summarizing
  const [uploading, setUploading]           = useState(false);  // uploading files
  const [summaryOutput, setSummaryOutput]   = useState(null);   // latest result
  const [copied, setCopied]                 = useState(false);

  // Sidebar data (from APIs)
  const [history, setHistory]               = useState([]);
  const [prevUploads, setPrevUploads]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [prevLoading, setPrevLoading]       = useState(true);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [sidebarSection, setSidebarSection] = useState({ history: true, prev: true });
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

  // ── Dashboard mode: null = choose, "summarize", "improve" ──
  const [dashMode, setDashMode] = useState(null);

  // ── Improve-PPT state ──
  const [improveFile, setImproveFile]                         = useState(null);
  /** When Improve uses a row from Previous Uploads (Vercel Blob), server loads bytes by id */
  const [improveDocumentId, setImproveDocumentId]             = useState(null);
  const [improveInstructions, setImproveInstructions]         = useState("");
  const [parsedSlides, setParsedSlides]                       = useState(null);
  const [parseLoading, setParseLoading]                       = useState(false);
  const [planAdjustments, setPlanAdjustments]                 = useState([]);
  const [planLoading, setPlanLoading]                         = useState(false);
  const [planError, setPlanError]                             = useState("");
  const parseRequestIdRef                                     = useRef(0);
  const [addStockImages, setAddStockImages]                   = useState(true);
  const [additiveImprove, setAdditiveImprove]                 = useState(true);
  const [improveDetailLevel, setImproveDetailLevel]           = useState("lecture");
  const [improveImgQuery, setImproveImgQuery]                 = useState("");
  const [improveImgSearchLoading, setImproveImgSearchLoading] = useState(false);
  const [improveImgResults, setImproveImgResults]             = useState([]);
  const [improveImgSearchHint, setImproveImgSearchHint]       = useState("");
  const [improveImageProvider, setImproveImageProvider]       = useState(null);
  const [improveTargetSlide, setImproveTargetSlide]           = useState(1);
  const [pickedUserImages, setPickedUserImages]               = useState([]);
  const [improvePasteUrl, setImprovePasteUrl]                 = useState("");
  const [themeQuery, setThemeQuery]                           = useState("");
  const [themeSearchLoading, setThemeSearchLoading]           = useState(false);
  const [themeResults, setThemeResults]                       = useState([]);
  const [themeResultsQuery, setThemeResultsQuery]             = useState("");
  const [selectedThemeId, setSelectedThemeId]                 = useState(null);
  const [selectedTemplateSpec, setSelectedTemplateSpec]       = useState(null);
  const [themeSearchErr, setThemeSearchErr]                   = useState("");
  const [improveGenLoading, setImproveGenLoading]             = useState(false);
  const [improveErr, setImproveErr]                           = useState("");
  const [improveAiModel, setImproveAiModel]                   = useState("Gemini");
  const [improveModelOpen, setImproveModelOpen]               = useState(false);

  const [useExistingDialog, setUseExistingDialog] = useState(null); // { names: string[] } when files already on server
  const [removingDocId, setRemovingDocId] = useState(null); // id of document being removed from server
  const [selectedPrevDocIds, setSelectedPrevDocIds] = useState([]); // selected docs for bulk delete
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const fileInputRef = useRef();

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status]);

  // ── Fetch history & previous uploads on mount ──────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (res.ok) setHistory(data.summaries || []);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  const fetchPrevUploads = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok) setPrevUploads(data.documents || []);
    } catch { /* silent */ }
    finally { setPrevLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchHistory();
      fetchPrevUploads();
    }
  }, [status]);

  useEffect(() => {
    setSelectedPrevDocIds((prev) =>
      prev.filter((id) => prevUploads.some((doc) => doc.id === id)),
    );
  }, [prevUploads]);

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
    if (!parsedSlides?.length) { setImproveImageProvider(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/improve-ppt/image-search");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data.provider) setImproveImageProvider(data.provider);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
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
  function getExt(name) { return name.split(".").pop().toUpperCase(); }

  function addLocalFiles(newFiles) {
    const arr = Array.from(newFiles).map(f => ({
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

    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
  }

  function addPrevFile(doc) {
    if (dashMode === "improve") {
      if (!isImproveSourceType(doc.type)) return;
      setError("");
      setSelectedFiles([{
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: formatBytes(doc.size),
        fromPrev: true,
      }]);
      return;
    }
    if (selectedFiles.find(f => f.name === doc.name)) return;
    setSelectedFiles(prev => [...prev, {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: formatBytes(doc.size),
      fromPrev: true,
    }]);
  }

  // ── Upload files to Vercel Blob via API ────────────────
  async function uploadNewFiles(files) {
    const list = files ?? selectedFiles;
    const newFiles = list.filter(f => !f.fromPrev && f.file);
    if (newFiles.length === 0) return [];

    setUploading(true);
    const formData = new FormData();
    newFiles.forEach(f => formData.append("files", f.file));

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) throw new Error(data.error || "Upload failed");

    fetchPrevUploads();
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
        setSelectedFiles(prev => prev.map(f => {
          if (f.fromPrev || !f.file) return f;
          const doc = uploadedDocs.find(d => d.name === f.name);
          if (!doc) return f;
          return { id: doc.id, name: doc.name, type: doc.type, size: formatBytes(doc.size), fromPrev: true };
        }));
      }
      if (filesOverride !== null && uploadedDocs.length > 0) {
        // When called with override (e.g. after "Use existing"), we already replaced some entries; merge upload results into override list
        const merged = files.map(f => {
          if (f.fromPrev && f.id) return f;
          const doc = uploadedDocs.find(d => d.name === f.name);
          if (doc) return { id: doc.id, name: doc.name, type: doc.type, size: formatBytes(doc.size), fromPrev: true };
          return f;
        });
        setSelectedFiles(merged);
      }

      const prevIds = files.filter(f => f.fromPrev && f.id).map(f => f.id);
      const newIds  = uploadedDocs.map(d => d.id);
      const documentIds = [...prevIds, ...newIds];

      if (documentIds.length === 0) {
        setError("No documents could be processed.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds, model, modelVariant, summarizeFor, prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Summarization failed");

      setSummaryOutput(data.summary);
      // Use the dedicated summary page for display
      if (data?.summary?.id != null) router.push(`/summary/${data.summary.id}`);
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Summarize: show "use existing?" dialog if some selected files already on server ─────────────────────────────────────────
  async function handleSummarize() {
    if (!selectedFiles.length) return;

    const newFiles = selectedFiles.filter(f => !f.fromPrev && f.file);
    const alreadyOnServer = newFiles.filter(f => prevUploads.some(d => d.name === f.name));

    if (alreadyOnServer.length > 0) {
      setUseExistingDialog({ names: alreadyOnServer.map(f => f.name) });
      return;
    }

    await doUploadAndSummarize();
  }

  function handleUseExistingConfirm(useExisting) {
    const dialog = useExistingDialog;
    setUseExistingDialog(null);
    if (!dialog) return;

    if (useExisting) {
      const resolved = selectedFiles.map(f => {
        if (!dialog.names.includes(f.name)) return f;
        const doc = prevUploads.find(d => d.name === f.name);
        if (!doc) return f;
        return { id: doc.id, name: doc.name, type: doc.type, size: formatBytes(doc.size), fromPrev: true };
      });
      setSelectedFiles(resolved);
      doUploadAndSummarize(resolved);
    } else {
      doUploadAndSummarize();
    }
  }

  async function handleRemoveDocument(doc) {
    if (removingDocId != null || bulkRemoving) return;
    const confirmed = window.confirm(
      `Delete "${doc?.name ?? "this file"}" from server? This cannot be undone.`,
    );
    if (!confirmed) return;
    setRemovingDocId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setSelectedFiles(prev => prev.filter(f => f.id !== doc.id && f.name !== doc.name));
      setSelectedPrevDocIds((prev) => prev.filter((id) => id !== doc.id));
      fetchPrevUploads();
    } catch (e) {
      setError("Could not remove document: " + (e?.message ?? "Unknown error"));
    } finally {
      setRemovingDocId(null);
    }
  }

  function togglePrevDocSelection(docId) {
    setSelectedPrevDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  }

  function toggleSelectAllPrevDocs() {
    if (selectedPrevDocIds.length === prevUploads.length) {
      setSelectedPrevDocIds([]);
      return;
    }
    setSelectedPrevDocIds(prevUploads.map((doc) => doc.id));
  }

  async function handleRemoveSelectedDocuments() {
    if (bulkRemoving || removingDocId != null || selectedPrevDocIds.length === 0) return;
    const docsToRemove = prevUploads.filter((doc) => selectedPrevDocIds.includes(doc.id));
    const confirmed = window.confirm(
      `Delete ${docsToRemove.length} selected file${docsToRemove.length !== 1 ? "s" : ""} from server? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBulkRemoving(true);
    setError("");
    let failed = 0;
    try {
      for (const doc of docsToRemove) {
        try {
          const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to remove");
        } catch {
          failed += 1;
        }
      }
      const removedIds = new Set(docsToRemove.map((doc) => doc.id));
      const removedNames = new Set(docsToRemove.map((doc) => doc.name));
      setSelectedFiles((prev) =>
        prev.filter((f) => !(removedIds.has(f.id) || removedNames.has(f.name))),
      );
      setSelectedPrevDocIds([]);
      await fetchPrevUploads();
      if (failed > 0) {
        setError(`Could not remove ${failed} file${failed !== 1 ? "s" : ""}.`);
      }
    } finally {
      setBulkRemoving(false);
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
  const selectedVariant = variants.find((v) => v.id === modelVariant) ?? variants[0];
  const setModelAndVariant = (providerId) => {
    setModel(providerId);
    setModelVariant(getDefaultVariant(providerId));
  };

  const selectedImproveSource = selectedFiles.find((f) => isImproveSourceType(f.type)) || null;
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
        setImproveErr("Pick a .pptx or .pdf from Previous Uploads, or upload a file locally.");
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
        const res = await fetch("/api/improve-ppt/parse", { method: "POST", body: fd });
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
      const w = Math.min(440, Math.max(176, sidebarDragRef.current.startW + dx));
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
    };
  }, []);

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: "var(--app-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    setPickedUserImages((prev) => prev.filter((p) => p.slideIndex !== slideIndex));
  }

  async function handleThemeSearch() {
    const q = themeQuery.trim();
    if (!q) return;
    setThemeSearchLoading(true);
    setThemeSearchErr("");
    try {
      const res = await fetch(`/api/improve-ppt/theme-search?q=${encodeURIComponent(q)}&model=${encodeURIComponent(improveAiModel)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Theme search failed");
      const themes = Array.isArray(data.themes) ? data.themes : [];
      if (themes.length > 0 && data.templateSpec) themes[0]._templateSpec = data.templateSpec;
      setThemeResults(themes);
      setThemeResultsQuery(q);
      if (data.templateSpec) setSelectedTemplateSpec(data.templateSpec);
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
      const res = await fetch(`/api/improve-ppt/image-search?q=${encodeURIComponent(q.slice(0, 200))}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Image search failed");
      setImproveImgResults(Array.isArray(data.results) ? data.results : []);
      setImproveImgSearchHint(data.hint || (data.results?.length ? "" : "No results found."));
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
        body: JSON.stringify({ slides: parsedSlides, instructions: improveInstructions.trim(), model: improveAiModel }),
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
    if (!parsedSlides?.length) { setImproveErr("Upload a .pptx or .pdf file and wait until slides finish loading."); return; }
    if (!improveInstructions.trim()) { setImproveErr("Describe what you want to improve."); return; }
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
        templateSpec: selectedTemplateSpec ?? undefined,
        userImageRefs: pickedUserImages.map((p) => ({ slideIndex: p.slideIndex, url: p.url })),
      };
      const fd = new FormData();
      if (improveFile) fd.append("file", improveFile);
      fd.append("payload", JSON.stringify(payload));
      const res = await fetch("/api/improve-ppt/generate", { method: "POST", body: fd });
      if (!res.ok) {
        let msg = "Generate failed";
        try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
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
    sidebarDragRef.current = { active: true, startX: e.clientX, startW: sidebarWidth };
    document.body.classList.add("no-select");
  }

  async function openDocFilePreview(doc, e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setDocPreviewDoc(doc);
    setDocPreviewSetupErr("");
    setDocPreviewSrc("");
    setDocPreviewTabHref(`${typeof window !== "undefined" ? window.location.origin : ""}/api/documents/${doc.id}/view`);
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
        setDocPreviewSrc(`https://view.officeapps.live.com/op/embed.aspx?src=${enc}`);
        setDocPreviewTabHref(`https://view.officeapps.live.com/op/view.aspx?src=${enc}`);
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--app-bg); }

        .app { height: 100%; background: var(--app-bg); font-family: 'Sora', sans-serif; display: flex; flex-direction: column; }
        .no-select { user-select: none; }
        .blob1 { position: fixed; top: -10%; right: -5%; width: 500px; height: 500px; background: var(--app-blob-1); pointer-events: none; z-index: 0; }
        .blob2 { position: fixed; bottom: -10%; left: 10%; width: 400px; height: 400px; background: var(--app-blob-2); pointer-events: none; z-index: 0; }

        .navbar { position: relative; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 58px; background: var(--app-nav-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--app-border); flex-shrink: 0; }
        .navbar-logo { display: flex; align-items: center; gap: 9px; }
        .logo-badge { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
        .logo-text { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; background: var(--app-brand-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .navbar-right { display: flex; align-items: center; gap: 10px; }
        .navbar-user-info { font-size: 12px; color: var(--app-greet); }
        .navbar-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--app-btn-border); background: var(--app-btn-bg); display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 12px; color: var(--app-btn-text); transition: all 0.2s; }
        .navbar-btn:hover { border-color: var(--app-btn-hover-border); color: var(--app-btn-hover-text); }

        .subnav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: flex-end; padding: 0 28px; height: 40px; background: var(--app-subnav-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--app-border); flex-shrink: 0; }
        .subnav-item { display: flex; align-items: center; gap: 4px; padding: 0 14px; height: 40px; font-size: 12px; color: var(--app-subnav-item); cursor: pointer; border: none; background: none; font-family: 'Sora', sans-serif; transition: color 0.2s; }
        .subnav-item:hover { color: var(--app-subnav-item-hover); }

        .body { display: flex; flex: 1; position: relative; z-index: 5; height: 100%; overflow: hidden; }

        /* SIDEBAR */
        .sidebar { flex-shrink: 0; background: var(--dash-sidebar); border-right: 1px solid var(--app-sidebar-border); display: flex; flex-direction: column; overflow-y: auto; }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .splitter-v { width: 8px; flex-shrink: 0; cursor: col-resize; background: transparent; position: relative; z-index: 10; touch-action: none; }
        .splitter-v::after { content: ''; position: absolute; top: 10px; bottom: 10px; left: 3px; width: 2px; border-radius: 999px; background: rgba(255,255,255,0.06); }
        .splitter-v:hover::after { background: rgba(99,102,241,0.35); }
        .splitter-v.active::after { background: rgba(99,102,241,0.55); }
        .sidebar-splitter-desktop { display: none; }
        @media (min-width: 1024px) {
          .sidebar-splitter-desktop { display: block; }
        }

        .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 6px; cursor: pointer; user-select: none; }
        .sidebar-title { font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
        .sidebar-chev { color: rgba(255,255,255,0.2); transition: transform 0.2s; }
        .sidebar-chev.open { transform: rotate(180deg); }
        .sidebar-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 6px 16px; }

        .history-item { padding: 8px 16px; cursor: pointer; transition: background 0.15s; position: relative; border-left: 2px solid transparent; }
        .history-item:hover { background: rgba(255,255,255,0.03); }
        .history-item.active { background: rgba(99,102,241,0.08); border-left-color: #6366f1; }
        .history-name { font-size: 12px; font-weight: 500; color: #b8b8d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .history-meta { font-size: 10.5px; color: rgba(255,255,255,0.22); margin-top: 2px; }
        .history-file-chip { display: flex; align-items: center; gap: 5px; padding: 3px 16px 3px 28px; font-size: 10.5px; color: rgba(255,255,255,0.22); }

        .prev-item { display: flex; align-items: center; gap: 6px; padding: 6px 16px; transition: background 0.15s; }
        .prev-item:hover { background: rgba(255,255,255,0.03); }
        .prev-item-main { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: pointer; }
        .prev-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .prev-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 16px 8px; }
        .prev-select-all { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: rgba(255,255,255,0.45); user-select: none; }
        .prev-select-all input { width: 12px; height: 12px; accent-color: #6366f1; }
        .prev-bulk-remove { height: 24px; padding: 0 8px; border-radius: 6px; border: 1px solid rgba(248,113,113,0.25); background: rgba(248,113,113,0.08); color: #fca5a5; font-size: 10.5px; font-family: 'Sora', sans-serif; cursor: pointer; transition: all 0.15s; }
        .prev-bulk-remove:hover:not(:disabled) { background: rgba(248,113,113,0.2); border-color: rgba(248,113,113,0.4); }
        .prev-bulk-remove:disabled { opacity: 0.55; cursor: not-allowed; }
        .prev-check { width: 13px; height: 13px; accent-color: #6366f1; flex-shrink: 0; }
        .prev-remove { width: 22px; height: 22px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.08); background: rgba(248,113,113,0.08); color: #f87171; font-size: 14px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .prev-remove:hover:not(:disabled) { background: rgba(248,113,113,0.2); border-color: rgba(248,113,113,0.3); }
        .prev-remove:disabled { opacity: 0.6; cursor: not-allowed; }
        .prev-info { flex: 1; min-width: 0; }
        .prev-name { font-size: 11.5px; font-weight: 500; color: #a8a8c0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .prev-meta { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .prev-add { width: 20px; height: 20px; border-radius: 5px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; color: #a5b4fc; font-size: 13px; flex-shrink: 0; cursor: pointer; transition: all 0.15s; }
        .prev-item:hover .prev-add { background: rgba(99,102,241,0.25); }
        .prev-add.added { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.3); color: #34d399; }
        .prev-peek { width: 22px; height: 22px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: rgba(200,200,230,0.85); font-size: 11px; font-family: 'Sora', sans-serif; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .prev-peek:hover { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.12); color: #c7d2fe; }
        .doc-preview-panel {
          max-width: min(1680px, 99vw);
          width: 100%;
          max-height: 96vh;
          height: 96vh;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: auto;
          overflow: hidden;
        }
        .doc-preview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-shrink: 0; }
        .doc-preview-title { font-size: 14px; font-weight: 600; color: #e2e8f0; }
        .doc-preview-meta { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .doc-preview-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
        .doc-preview-open-tab {
          font-size: 11.5px; font-family: 'Sora', sans-serif; font-weight: 500;
          padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.15); color: #c7d2fe; text-decoration: none; transition: all 0.15s;
        }
        .doc-preview-open-tab:hover { background: rgba(99,102,241,0.28); color: #e0e7ff; }
        .doc-preview-hint { font-size: 10.5px; color: rgba(255,255,255,0.38); line-height: 1.45; max-width: 52rem; }
        .doc-preview-frame-wrap {
          position: relative;
          flex: 1 1 0;
          min-height: 0;
          height: auto;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: #0c0c12;
        }
        .doc-preview-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
        .doc-preview-frame-busy .doc-preview-frame { opacity: 0; pointer-events: none; }
        .doc-preview-frame-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(12,12,18,0.92); z-index: 1; }

        .sidebar-empty { padding: 12px 16px; font-size: 11px; color: rgba(255,255,255,0.18); font-style: italic; }
        .sidebar-loading { padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(255,255,255,0.2); }
        .mini-spinner { width: 12px; height: 12px; border: 1.5px solid rgba(255,255,255,0.15); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }

        /* MAIN */
        .main { flex: 1; display: grid; gap: 14px; padding: 16px; overflow-y: auto; align-content: start; }
        .main::-webkit-scrollbar { width: 3px; }
        .main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .panel {
          background: var(--dash-panel-bg);
          border: 1px solid var(--dash-panel-border);
          border-radius: 16px;
          padding: 18px;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 220px;
          overflow: visible;
        }
        .panel-title { font-family: 'Fraunces', serif; font-size: 14.5px; font-weight: 600; color: #ddddf0; }
        .panel-sub { font-size: 11px; color: rgba(255,255,255,0.28); margin-top: 8px; }

        .drop-zone { border: 1.5px dashed rgba(99,102,241,0.22); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(99,102,241,0.02); }
        .drop-zone:hover, .drop-zone.dragging { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.07); }
        .drop-zone-text { font-size: 11.5px; color: rgba(255,255,255,0.28); margin-top: 6px; }
        .drop-zone-link { color: #8080f8; }

        .file-list { display: flex; flex-direction: column; gap: 7px; overflow-y: auto; max-height: 230px; }
        .file-list::-webkit-scrollbar { width: 3px; }
        .file-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .file-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .file-name { font-size: 12px; font-weight: 500; color: #c0c0da; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-size { font-size: 10.5px; color: rgba(255,255,255,0.2); margin-top: 1px; }
        .file-badge { font-size: 9px; font-weight: 600; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); letter-spacing: 0.03em; flex-shrink: 0; }
        .file-prev-tag { font-size: 9.5px; color: rgba(99,102,241,0.7); margin-top: 1px; }
        .file-remove { width: 20px; height: 20px; border-radius: 5px; border: none; background: rgba(248,113,113,0.08); color: #f87171; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
        .file-remove:hover { background: rgba(248,113,113,0.22); }

        .formats-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .fmt-chip { font-size: 9.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.06); }

        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: rgba(255,255,255,0.14); font-size: 11.5px; padding: 24px 0; text-align: center; }

        .prompt-area { flex: 1; resize: none; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px; font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 300; color: #c0c0d8; outline: none; transition: border-color 0.2s, box-shadow 0.2s; line-height: 1.65; min-height: 180px; }
        .prompt-area::placeholder { color: rgba(255,255,255,0.15); font-style: italic; }
        .prompt-area:focus { border-color: rgba(99,102,241,0.4); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .prompt-count { font-size: 10.5px; color: rgba(255,255,255,0.18); }

        /* OUTPUT PANEL */
        .output-area { flex: 1; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; overflow-y: auto; }
        .output-area::-webkit-scrollbar { width: 3px; }
        .output-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .output-text { font-size: 13.5px; font-weight: 400; color: #c8c8e0; line-height: 1.8; font-family: 'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .output-text h1 { font-size: 1.5em; font-weight: 700; color: #e8e8f5; margin: 0 0 14px; line-height: 1.35; }
        .output-text h2 { font-size: 1.22em; font-weight: 600; color: #ddddf0; margin: 20px 0 10px; }
        .output-text h3 { font-size: 1.08em; font-weight: 600; color: #d0d0e8; margin: 16px 0 8px; }
        .output-text ol, .output-text ul { margin: 12px 0 14px 22px; padding-left: 8px; }
        .output-text ul { list-style-type: disc; }
        .output-text ul ul { list-style-type: disc; }
        .output-text ol li, .output-text ul li { margin: 6px 0; }
        .output-text table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
        .output-text th, .output-text td { border: 1px solid rgba(255,255,255,0.14); padding: 10px 14px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
        .output-text th { background: rgba(255,255,255,0.08); font-weight: 600; color: #e0e0f0; }
        .output-text td { color: #b8b8d4; line-height: 1.6; }
        .output-placeholder { font-size: 12px; color: rgba(255,255,255,0.16); font-style: italic; }
        .output-header { display: flex; align-items: center; justify-content: space-between; }
        .copy-btn { height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-family: 'Sora', sans-serif; font-size: 11px; color: rgba(255,255,255,0.4); cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s; }
        .copy-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
        .copy-btn.copied { border-color: rgba(52,211,153,0.3); color: #34d399; background: rgba(52,211,153,0.08); }

        /* RIGHT PANEL */
        .upload-btn {
          width: 100%;
          height: 38px;
          border-radius: 9px;
          border: 1.5px solid rgba(22,163,74,0.65);
          background: linear-gradient(135deg, rgba(22,163,74,0.22), rgba(21,128,61,0.16));
          font-family: 'Sora', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.2s;
          box-shadow: 0 6px 18px rgba(16,185,129,0.12);
          margin-bottom: 8px;
        }
        .upload-btn:hover {
          border-color: rgba(22,163,74,0.9);
          background: linear-gradient(135deg, rgba(22,163,74,0.30), rgba(21,128,61,0.22));
          box-shadow: 0 10px 26px rgba(22,163,74,0.30);
          transform: translateY(-1px);
        }
        .upload-hint { font-size: 10.5px; color: rgba(255,255,255,0.2); text-align: center; margin-bottom: 10px; }

        .improve-files-banner {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 9px 11px;
          margin-bottom: 10px;
          border-radius: 10px;
          border: 1px solid rgba(99,102,241,0.35);
          background: rgba(99,102,241,0.10);
          font-size: 11px;
          line-height: 1.45;
          color: rgba(220,220,255,0.92);
        }
        .improve-files-banner strong { color: #e0e7ff; font-weight: 600; }
        .improve-slot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 2px;
        }
        .improve-slot-pill {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.18);
          color: #c7d2fe;
          flex-shrink: 0;
        }
        .file-list.improve-single {
          max-height: 120px;
        }

        .radio-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
        .radio-option { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; padding: 8px 10px; border-radius: 9px; border: 1px solid transparent; transition: all 0.2s; }
        .radio-option:hover { background: rgba(255,255,255,0.03); }
        .radio-option.selected { background: rgba(99,102,241,0.07); border-color: rgba(99,102,241,0.18); }
        .radio-dot { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; transition: border-color 0.2s; }
        .radio-dot.on { border-color: #6366f1; }
        .radio-dot.on::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #6366f1; }
        .radio-title { font-size: 12px; font-weight: 500; color: #b8b8d0; }
        .radio-sub { font-size: 10.5px; color: rgba(255,255,255,0.25); margin-top: 1px; }

        .model-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
        .model-wrap { position: relative; }
        .model-btn { width: 100%; height: 46px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 500; color: #c0c0e0; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; }
        .model-btn:hover, .model-btn.open { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.06); }
        .model-left { display: flex; align-items: center; gap: 8px; }
        .model-dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .model-sub { font-size: 10.5px; color: rgba(255,255,255,0.28); font-weight: 300; }
        /* Drop-up menu so it doesn't cover the action buttons below */
        .model-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: rgba(22,22,32,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 4px; z-index: 80; box-shadow: 0 16px 36px rgba(0,0,0,0.5); animation: menuInUp 0.14s ease; }
        @keyframes menuInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .model-opt { padding: 8px 10px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.14s; }
        .model-opt:hover { background: rgba(99,102,241,0.1); }
        .model-opt.on { background: rgba(99,102,241,0.16); }
        .model-opt-name { font-size: 12.5px; font-weight: 500; color: #c0c0e0; }
        .model-opt-sub { font-size: 10.5px; color: rgba(255,255,255,0.28); }
        .model-opt-desc { font-size: 10.5px; color: rgba(255,255,255,0.28); margin-top: 2px; }
        .model-check { color: #a5b4fc; font-size: 11px; }

        .error-box { padding: 10px 12px; border-radius: 8px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); font-size: 12px; color: #fca5a5; }

        .summarize-btn { width: 100%; height: 44px; border-radius: 10px; border: none; background: linear-gradient(135deg, #5f60f0, #8b5cf6); font-family: 'Sora', sans-serif; font-size: 13.5px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s; box-shadow: 0 4px 16px rgba(99,102,241,0.35); position: relative; overflow: hidden; margin-top: auto; }

        /* ── Mode dropdown ── */
        .mode-dropdown-wrap { display: flex; flex-direction: column; gap: 6px; }
        .mode-dropdown-label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.35); }
        html[data-theme="light"] .mode-dropdown-label { color: rgba(0,0,0,.4); }

        /* ── Mode chooser ── */
        .mode-chooser { display: flex; flex-direction: column; gap: 10px; flex: 1; justify-content: center; }
        .mode-chooser-label { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.35); margin-bottom: 4px; }
        .mode-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.03); cursor: pointer; transition: all .18s; text-align: left; width: 100%; }
        .mode-card:hover { border-color: rgba(99,102,241,.45); background: rgba(99,102,241,.08); transform: translateY(-1px); }
        .mode-card-title { font-size: 13px; font-weight: 600; color: #e0e0f0; display: flex; align-items: center; gap: 7px; }
        .mode-card-sub { font-size: 11.5px; color: rgba(255,255,255,.42); line-height: 1.45; }
        html[data-theme="light"] .mode-chooser-label { color: rgba(0,0,0,.4); }
        html[data-theme="light"] .mode-card { border-color: rgba(0,0,0,.08); background: rgba(0,0,0,.02); }
        html[data-theme="light"] .mode-card:hover { border-color: rgba(99,102,241,.4); background: rgba(99,102,241,.07); }
        html[data-theme="light"] .mode-card-title { color: #111; }
        html[data-theme="light"] .mode-card-sub { color: rgba(0,0,0,.5); }

        /* ── Improve panel (inline in panel 3) ── */
        .improve-panel { display: flex; flex-direction: column; gap: 12px; flex: 1; overflow: visible; padding-bottom: 8px; }
        .improve-panel.centered { align-items: center; justify-content: center; }
        .improve-panel.centered .improve-section-head { text-align: center; }
        .improve-controls { width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 12px; align-items: stretch; }
        .improve-status { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 2px; }
        .improve-status-sub { font-size: 11.5px; color: rgba(255,255,255,0.32); text-align: center; line-height: 1.45; }
        .improve-status-name { font-size: 12.5px; font-weight: 700; color: rgba(220,220,255,0.95); text-align: center; }
        .improve-back-btn { display: flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid rgba(255,255,255,.1); background: transparent; font-family: 'Sora', sans-serif; font-size: 11.5px; color: rgba(255,255,255,.45); cursor: pointer; transition: all .15s; width: fit-content; margin-bottom: 2px; }
        .improve-back-btn:hover { border-color: rgba(255,255,255,.22); color: rgba(255,255,255,.75); }
        .improve-section-head { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.35); margin-top: 4px; }
        .improve-field-label { font-size: 11.5px; color: rgba(255,255,255,.5); margin-bottom: 4px; line-height: 1.4; }
        .improve-upload-zone { width: 100%; min-height: 60px; border-radius: 10px; border: 1.5px dashed rgba(255,255,255,.15); background: rgba(255,255,255,.03); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 12px; color: rgba(255,255,255,.45); transition: all .18s; padding: 12px 14px; text-align: center; }
        .improve-upload-zone:hover { border-color: rgba(99,102,241,.45); color: rgba(255,255,255,.75); background: rgba(99,102,241,.06); }
        .improve-txt-inp { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); font-family: 'Sora', sans-serif; font-size: 12px; color: #dde; outline: none; transition: border-color .15s; }
        .improve-txt-inp:focus { border-color: rgba(99,102,241,.45); }
        .improve-textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); font-family: 'Sora', sans-serif; font-size: 12px; color: #dde; outline: none; resize: vertical; min-height: 80px; transition: border-color .15s; }
        .improve-textarea:focus { border-color: rgba(99,102,241,.45); }
        .improve-dropdown { width: 100%; height: 36px; padding: 0 34px 0 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center; font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; color: #dde; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; transition: border-color .15s, box-shadow .15s; }
        .improve-dropdown:hover { border-color: rgba(99,102,241,.4); background-color: rgba(99,102,241,.06); }
        .improve-dropdown:focus { border-color: rgba(99,102,241,.55); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
        .improve-dropdown option { background: #1a1a28; color: #dde; }
        .improve-btn-row { display: flex; gap: 8px; margin-top: 4px; }
        .improve-btn-secondary { flex: 1; height: 36px; border-radius: 9px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.65); cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .improve-btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,.22); color: rgba(255,255,255,.9); }
        .improve-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }
        .improve-btn-primary { flex: 1; height: 36px; border-radius: 9px; border: none; background: linear-gradient(135deg,#5258ee,#8b5cf6); font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 12px rgba(99,102,241,.3); transition: all .15s; }
        .improve-btn-primary:hover:not(:disabled) { box-shadow: 0 5px 18px rgba(99,102,241,.48); transform: translateY(-1px); }
        .improve-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .improve-btn-primary.improve-btn-full { flex: 1; max-width: 100%; }
        .improve-err { font-size: 11.5px; color: #f87171; padding: 8px 10px; border-radius: 7px; background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.2); }
        .improve-mini-spin { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.25); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; display: inline-block; }
        .improve-theme-chip { padding: 4px 9px; border-radius: 7px; font-size: 11px; cursor: pointer; transition: all .15s; font-family: 'Sora', sans-serif; }
        html[data-theme="light"] .improve-back-btn { border-color: rgba(0,0,0,.12); color: rgba(0,0,0,.45); }
        html[data-theme="light"] .improve-back-btn:hover { border-color: rgba(0,0,0,.25); color: rgba(0,0,0,.75); }
        html[data-theme="light"] .improve-section-head { color: rgba(0,0,0,.4); }
        html[data-theme="light"] .improve-field-label { color: rgba(0,0,0,.5); }
        html[data-theme="light"] .improve-upload-zone { border-color: rgba(0,0,0,.15); color: rgba(0,0,0,.45); background: rgba(0,0,0,.02); }
        html[data-theme="light"] .improve-upload-zone:hover { border-color: rgba(99,102,241,.4); background: rgba(99,102,241,.06); color: rgba(0,0,0,.7); }
        html[data-theme="light"] .improve-txt-inp, html[data-theme="light"] .improve-textarea { border-color: rgba(0,0,0,.12); background: rgba(0,0,0,.02); color: #111; }
        html[data-theme="light"] .improve-dropdown { border-color: rgba(0,0,0,.12); background-color: rgba(0,0,0,.02); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); color: #111; }
        html[data-theme="light"] .improve-dropdown option { background: #fff; color: #111; }
        html[data-theme="light"] .improve-btn-secondary { border-color: rgba(0,0,0,.12); color: rgba(0,0,0,.65); background: rgba(0,0,0,.03); }
        .summarize-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 55%); opacity: 0; transition: opacity 0.2s; }
        .summarize-btn:hover:not(:disabled)::after { opacity: 1; }
        .summarize-btn:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 22px rgba(99,102,241,0.48); }
        .summarize-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .status-badge { font-size: 10.5px; padding: 2px 8px; border-radius: 5px; font-weight: 500; }
        .badge-lecturer { background: rgba(99,102,241,0.15); color: #a5b4fc; }
        .badge-student { background: rgba(52,211,153,0.12); color: #6ee7b7; }
        .badge-model { background: rgba(251,146,60,0.12); color: #fdba74; margin-left: 4px; }

        /* Use-existing modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .modal-backdrop.doc-preview-backdrop { padding: 6px; align-items: stretch; justify-content: center; }
        .modal-box { background: rgba(22,22,32,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 24px; max-width: 400px; width: 100%; box-shadow: 0 24px 48px rgba(0,0,0,0.5); }
        .modal-box.doc-preview-panel { max-width: min(1800px, 98vw); width: 98vw; max-height: 96vh; height: 96vh; padding: 12px; }
        .modal-title { font-size: 15px; font-weight: 600; color: #e0e0f0; margin-bottom: 8px; }
        .modal-desc { font-size: 12.5px; color: rgba(255,255,255,0.5); margin-bottom: 18px; line-height: 1.5; }
        .modal-btns { display: flex; gap: 10px; justify-content: flex-end; }
        .modal-btn { height: 38px; padding: 0 18px; border-radius: 9px; font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .modal-btn.secondary { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #b0b0cc; }
        .modal-btn.secondary:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); }
        .modal-btn.primary { border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); color: white; }
        .modal-btn.primary:hover { filter: brightness(1.08); }

        /* ── Mobile layout (match AppShell 1023px breakpoint; single scroll = shell-content) ── */
        @media (max-width: 1023px) {
          .app {
            height: auto;
            min-height: 100vh;
          }

          .body {
            flex-direction: column;
            flex: none;
            height: auto;
            overflow: visible;
          }

          .sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: 260px !important;
            max-width: 80vw;
            transform: translateX(-100%);
            transition: transform 0.22s ease-out, box-shadow 0.22s ease-out;
            box-shadow: 0 0 0 rgba(0,0,0,0);
            z-index: 50;
          }
          .app--sidebar-open .sidebar {
            transform: translateX(0);
            box-shadow: 0 18px 40px rgba(0,0,0,0.7);
          }

          .main {
            display: flex;
            flex-direction: column;
            padding: 12px;
            overflow-y: visible;
            flex: none;
          }

          .panel {
            min-height: auto;
            max-height: none;
            overflow: visible;
          }

          .file-list {
            max-height: none;
            overflow-y: visible;
          }

          .output-area {
            max-height: none;
            overflow-y: visible;
          }

          .sidebar-toggle {
            display: flex;
          }
        }

        /* Sidebar toggle button (mobile only by default) */
        .sidebar-toggle {
          position: fixed;
          bottom: 16px;
          left: 16px;
          z-index: 60;
          height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(15,15,25,0.9);
          color: rgba(255,255,255,0.78);
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          display: none;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          backdrop-filter: blur(12px);
        }
        .sidebar-toggle span {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: rgba(255,255,255,0.55);
        }
        .sidebar-toggle-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        /* Light-mode overrides (dashboard has hardcoded dark colors otherwise) */
        html[data-theme="light"] .sidebar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .sidebar-title { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .sidebar-chev { color: rgba(0,0,0,0.35); }
        html[data-theme="light"] .sidebar-divider { background: rgba(0,0,0,0.08); }

        html[data-theme="light"] .history-item:hover { background: rgba(0,0,0,0.03); }
        html[data-theme="light"] .history-item.active { background: rgba(99,102,241,0.10); }
        html[data-theme="light"] .history-name { color: #111827; }
        html[data-theme="light"] .history-meta { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .history-file-chip { color: rgba(0,0,0,0.45); }

        html[data-theme="light"] .prev-item:hover { background: rgba(0,0,0,0.04); }
        html[data-theme="light"] .prev-name { color: #111827; }
        html[data-theme="light"] .prev-meta { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .prev-select-all { color: rgba(0,0,0,0.55); }
        html[data-theme="light"] .prev-bulk-remove { border-color: rgba(220,38,38,0.25); background: rgba(220,38,38,0.08); color: #b91c1c; }
        html[data-theme="light"] .prev-bulk-remove:hover:not(:disabled) { background: rgba(220,38,38,0.18); border-color: rgba(220,38,38,0.35); }

        html[data-theme="light"] .sidebar-empty { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .sidebar-loading { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .mini-spinner { border-color: rgba(0,0,0,0.12); border-top-color: #6366f1; }

        html[data-theme="light"] .panel-title { color: #111827; }
        html[data-theme="light"] .panel-sub { color: rgba(0,0,0,0.52); }

        html[data-theme="light"] .improve-files-banner {
          border-color: rgba(79,70,229,0.35);
          background: rgba(79,70,229,0.08);
          color: rgba(30,27,75,0.9);
        }
        html[data-theme="light"] .improve-files-banner strong { color: #3730a3; }
        html[data-theme="light"] .improve-slot-pill {
          border-color: rgba(79,70,229,0.35);
          background: rgba(79,70,229,0.12);
          color: #4338ca;
        }

        html[data-theme="light"] .drop-zone-text { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .drop-zone-link { color: #4f46e5; }

        html[data-theme="light"] .file-item {
          background: rgba(0,0,0,0.015);
          border: 1px solid rgba(0,0,0,0.06);
        }
        html[data-theme="light"] .file-name { color: #111827; }
        html[data-theme="light"] .file-size { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .file-badge { background: rgba(0,0,0,0.03); color: rgba(0,0,0,0.35); }
        html[data-theme="light"] .fmt-chip {
          background: rgba(0,0,0,0.03);
          color: rgba(0,0,0,0.38);
          border: 1px solid rgba(0,0,0,0.06);
        }
        html[data-theme="light"] .empty-state { color: rgba(0,0,0,0.45); }

        html[data-theme="light"] .prompt-area {
          background: rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.10);
          color: #111827;
        }
        html[data-theme="light"] .prompt-area::placeholder { color: rgba(0,0,0,0.35); }
        html[data-theme="light"] .prompt-count { color: rgba(0,0,0,0.35); }
        html[data-theme="light"] .prompt-area:focus { border-color: rgba(99,102,241,0.40); box-shadow: 0 0 0 3px rgba(99,102,241,0.10); }

        html[data-theme="light"] .output-area {
          background: rgba(0,0,0,0.02);
          border: 1px solid rgba(0,0,0,0.07);
        }
        html[data-theme="light"] .output-text { color: #111827; }
        html[data-theme="light"] .output-text h1,
        html[data-theme="light"] .output-text h2,
        html[data-theme="light"] .output-text h3 { color: #111827; }
        html[data-theme="light"] .output-text th,
        html[data-theme="light"] .output-text td { border: 1px solid rgba(0,0,0,0.12); }
        html[data-theme="light"] .output-text th { background: rgba(0,0,0,0.04); color: #111827; }
        html[data-theme="light"] .output-text td { color: rgba(17,24,39,0.92); }

        html[data-theme="light"] .copy-btn {
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(0,0,0,0.03);
          color: rgba(0,0,0,0.45);
        }
        html[data-theme="light"] .copy-btn:hover { border-color: rgba(0,0,0,0.20); color: rgba(0,0,0,0.70); }

        html[data-theme="light"] .upload-hint { color: rgba(0,0,0,0.35); }

        /* Upload button should stay a clear dark-green CTA in light mode */
        html[data-theme="light"] .upload-btn {
          border: 1.5px solid rgba(21,128,61,0.85);
          background: linear-gradient(135deg, #15803d, #166534);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(21,128,61,0.22);
        }
        html[data-theme="light"] .upload-btn:hover {
          border-color: rgba(21,128,61,1);
          background: linear-gradient(135deg, #166534, #0f766e);
          box-shadow: 0 14px 36px rgba(21,128,61,0.26);
        }

        html[data-theme="light"] .radio-label { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .radio-option:hover { background: rgba(0,0,0,0.04); }
        html[data-theme="light"] .radio-option.selected { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.20); }
        html[data-theme="light"] .radio-dot { border-color: rgba(0,0,0,0.18); }
        html[data-theme="light"] .radio-title { color: #111827; }
        html[data-theme="light"] .radio-sub { color: rgba(0,0,0,0.38); }

        html[data-theme="light"] .model-label { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .model-btn {
          border-color: rgba(0,0,0,0.10);
          background: rgba(0,0,0,0.03);
          color: rgba(0,0,0,0.70);
        }
        html[data-theme="light"] .model-sub { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .model-menu {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: 0 16px 36px rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .model-opt-name { color: #111827; }
        html[data-theme="light"] .model-opt-sub { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .model-check { color: #4f46e5; }

        html[data-theme="light"] .modal-box {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: 0 24px 48px rgba(0,0,0,0.12);
        }
        html[data-theme="light"] .modal-title { color: #111827; }
        html[data-theme="light"] .modal-desc { color: rgba(0,0,0,0.55); }
        html[data-theme="light"] .modal-btn.secondary {
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.03);
          color: #4b5563;
        }
        html[data-theme="light"] .modal-btn.secondary:hover {
          border-color: rgba(0,0,0,0.18);
          background: rgba(0,0,0,0.06);
        }
        html[data-theme="light"] .doc-preview-title { color: #111827; }
        html[data-theme="light"] .doc-preview-meta { color: rgba(0,0,0,0.45); }
        html[data-theme="light"] .doc-preview-hint { color: rgba(0,0,0,0.5); }
        html[data-theme="light"] .doc-preview-frame-wrap { border-color: rgba(0,0,0,0.12); background: #f3f4f6; }
        html[data-theme="light"] .doc-preview-open-tab {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.12);
          color: #4338ca;
        }
        html[data-theme="light"] .doc-preview-open-tab:hover { background: rgba(99,102,241,0.2); color: #312e81; }
        html[data-theme="light"] .prev-peek {
          border-color: rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.04);
          color: rgba(0,0,0,0.55);
        }
        html[data-theme="light"] .prev-peek:hover {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.10);
          color: #4338ca;
        }

        html[data-theme="light"] .sidebar-toggle {
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(248,249,252,0.98);
          color: rgba(0,0,0,0.78);
        }
        html[data-theme="light"] .sidebar-toggle span { color: rgba(0,0,0,0.55); }
      `}</style>

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

          {/* ── SIDEBAR ── */}
          <aside className="sidebar" style={{ width: sidebarWidth }}>

            {/* History */}
            <div className="sidebar-header" onClick={() => setSidebarSection(s => ({ ...s, history: !s.history }))}>
              <span className="sidebar-title"><HistoryIcon /> History</span>
              <span className={`sidebar-chev ${sidebarSection.history ? "open" : ""}`}><ChevronDownIcon /></span>
            </div>

            {sidebarSection.history && (
              historyLoading ? (
                <div className="sidebar-loading"><div className="mini-spinner" /> Loading...</div>
              ) : history.length === 0 ? (
                <div className="sidebar-empty">No summaries yet</div>
              ) : history.map(h => (
                <div key={h.id}>
                  <div
                    className={`history-item ${expandedHistory === h.id ? "active" : ""}`}
                    onClick={() => {
                      setExpandedHistory(expandedHistory === h.id ? null : h.id);
                      // Use the dedicated summary page for display
                      router.push(`/summary/${h.id}`);
                    }}
                  >
                    <div className="history-name" title={h.title}>{h.title}</div>
                    <div className="history-meta">
                      {h.files.length} file{h.files.length !== 1 ? "s" : ""} · {timeAgo(h.createdAt)}
                    </div>
                  </div>
                  {expandedHistory === h.id && h.files.map(f => (
                    <div className="history-file-chip" key={f.id}>
                      <FileIcon type={f.type} />
                      <span title={f.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    </div>
                  ))}
                </div>
              ))
            )}

            <div className="sidebar-divider" />

            {/* Previous Uploads */}
            <div className="sidebar-header" onClick={() => setSidebarSection(s => ({ ...s, prev: !s.prev }))}>
              <span className="sidebar-title"><UploadIcon /> Previous Uploaded</span>
              <span className={`sidebar-chev ${sidebarSection.prev ? "open" : ""}`}><ChevronDownIcon /></span>
            </div>

            {sidebarSection.prev && (
              prevLoading ? (
                <div className="sidebar-loading"><div className="mini-spinner" /> Loading...</div>
              ) : prevUploads.length === 0 ? (
                <div className="sidebar-empty">No uploads yet</div>
              ) : <>
                <div className="prev-controls">
                  <label className="prev-select-all">
                    <input
                      type="checkbox"
                      checked={prevUploads.length > 0 && selectedPrevDocIds.length === prevUploads.length}
                      onChange={toggleSelectAllPrevDocs}
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    className="prev-bulk-remove"
                    onClick={handleRemoveSelectedDocuments}
                    disabled={bulkRemoving || removingDocId != null || selectedPrevDocIds.length === 0}
                    title="Delete selected files"
                  >
                    {bulkRemoving
                      ? "Deleting..."
                      : `Delete selected (${selectedPrevDocIds.length})`}
                  </button>
                </div>
                {prevUploads.map(doc => {
                const isAdded = selectedFiles.some(f => f.name === doc.name);
                const isRemoving = removingDocId === doc.id;
                return (
                  <div className="prev-item" key={doc.id}>
                    <input
                      type="checkbox"
                      className="prev-check"
                      checked={selectedPrevDocIds.includes(doc.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => togglePrevDocSelection(doc.id)}
                      aria-label={`Select ${doc.name}`}
                    />
                    <div className="prev-item-main" onClick={() => addPrevFile(doc)}>
                      <FileIcon type={doc.type} />
                      <div className="prev-info">
                        <div className="prev-name" title={doc.name}>{doc.name}</div>
                        <div className="prev-meta">{formatBytes(doc.size)} · {timeAgo(doc.createdAt)}</div>
                      </div>
                    </div>
                    <div className="prev-actions">
                      <button
                        type="button"
                        className="prev-peek"
                        title="Preview file"
                        disabled={bulkRemoving}
                        onClick={(e) => openDocFilePreview(doc, e)}
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        className="prev-remove"
                        title="Remove from server"
                        disabled={isRemoving || bulkRemoving}
                        onClick={(e) => { e.stopPropagation(); handleRemoveDocument(doc); }}
                      >
                        {isRemoving ? <span className="mini-spinner" /> : "×"}
                      </button>
                      <div className={`prev-add ${isAdded ? "added" : ""}`} onClick={(e) => { e.stopPropagation(); addPrevFile(doc); }}>{isAdded ? "✓" : "+"}</div>
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </aside>

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
              gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr) 300px",
            }}
          >

            {/* Panel 1 — Files */}
            <div className="panel"
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
                    <span className="improve-slot-pill" title="Improve mode accepts one presentation only">
                      {selectedFiles.length >= 1 ? "1 / 1 slot" : "0 / 1 slot"}
                    </span>
                  )}
                </div>
              </div>

              {dashMode === "improve" && (
                <div className="improve-files-banner" role="status">
                  <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>ⓘ</span>
                  <span>
                    <strong>Improve mode:</strong> choose exactly one .pptx or .pdf. Accepts 1 file only.
                  </span>
                </div>
              )}

              {selectedFiles.length > 0 ? (
                <div className={`file-list${dashMode === "improve" ? " improve-single" : ""}`}>
                  {selectedFiles.map(f => (
                    <div className="file-item" key={f.name}>
                      <FileIcon type={f.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="file-name" title={f.name}>{f.name}</div>
                        <div className="file-size">
                          {f.size}
                          {f.fromPrev && <span className="file-prev-tag"> · prev upload</span>}
                        </div>
                      </div>
                      <span className="file-badge">{f.type}</span>
                      <button className="file-remove" onClick={() => removeFile(f.name)}><CloseIcon /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FileIcon type={dashMode === "improve" ? "PPTX" : "PDF"} />
                  <span>{dashMode === "improve" ? "No presentation selected" : "No files selected"}</span>
                  <span>
                    {dashMode === "improve"
                      ? "Upload one .pptx or .pdf below (only one file allowed)"
                      : "Click upload below or pick from the sidebar"}
                  </span>
                </div>
              )}

              {(dashMode !== "improve" || selectedFiles.length === 0) && (
                <>
                  <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
                    <UploadIcon />{" "}
                    {dashMode === "improve" ? "Upload .pptx / .pdf" : "Upload Documents"}
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
                    <div className="panel-sub">Describe design/content improvements for the lecture slides</div>
                  </div>
                  <textarea
                    className="prompt-area"
                    placeholder={"e.g. Switch to a green theme and add images. Expand speaker notes, keep bullets concise. Tighten bullets for clarity."}
                    value={improveInstructions}
                    onChange={(e) => setImproveInstructions(e.target.value.slice(0, 500))}
                  />
                  <div className="prompt-count">{improveInstructions.length} / 500</div>
                </>
              ) : summaryOutput ? (
                <>
                  <div className="output-header">
                    <div>
                      <div className="panel-title">Summary Output</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <span className={`status-badge ${summaryOutput.summarizeFor === "lecturer" ? "badge-lecturer" : "badge-student"}`}>
                          {summaryOutput.summarizeFor}
                        </span>
                        <span className="status-badge badge-model">{modelDisplayName(summaryOutput.model)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                        <CopyIcon /> {copied ? "copied" : "Copy"}
                      </button>
                      <button className="copy-btn" onClick={() => setSummaryOutput(null)}>New</button>
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
                    <div className="panel-sub">Optional — refine the summary</div>
                  </div>
                  <textarea
                    className="prompt-area"
                    placeholder={"ex: focus on key concepts and definitions\nex: highlight any formulas or theorems\nex: point out the concept of Denormalization..."}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value.slice(0, 500))}
                  />
                  <div className="prompt-count">{prompt.length} / 500</div>
                </>
              )}
            </div>

            {/* Panel 3 — Controls */}
            <div className="panel" style={{ minHeight: 340 }}>

              {/* ── Mode dropdown ── */}
              <div className="mode-dropdown-wrap">
                <div className="mode-dropdown-label">What would you like to do?</div>
                <div className="model-wrap">
                  <button
                    className={`model-btn ${modeOpen ? "open" : ""}`}
                    onClick={() => setModeOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setModeOpen(false), 150)}
                  >
                    <div className="model-left">
                      <div className="model-dot" />
                      <span>{dashMode === "improve" ? "Improve Lecture Slides Design/Content" : "Summarize Notes"}</span>
                    </div>
                    <ChevronDownIcon />
                  </button>
                  {modeOpen && (
                    <div className="model-menu">
                      {[
                        { value: "summarize", label: "Summarize Notes" },
                        { value: "improve",   label: "Improve Lecture Slides Design/Content" },
                      ].map((opt) => (
                        <div
                          key={opt.value}
                          className={`model-opt ${(dashMode ?? "summarize") === opt.value ? "on" : ""}`}
                          onMouseDown={() => { setDashMode(opt.value); setModeOpen(false); }}
                        >
                          <div className="model-opt-name">{opt.label}</div>
                          {(dashMode ?? "summarize") === opt.value && <span className="model-check">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Summarize mode ── */}
              {(dashMode === null || dashMode === "summarize") && (<>
                <div>
                  <div className="radio-label">Summarize for</div>
                  {[
                    { id: "lecturer", title: "Lecturer", sub: "Detailed & comprehensive" },
                    { id: "student",  title: "Student",  sub: "Simplified, key points" },
                  ].map(opt => (
                    <div key={opt.id} className={`radio-option ${summarizeFor === opt.id ? "selected" : ""}`}
                      onClick={() => setSummarizeFor(opt.id)}>
                      <div className={`radio-dot ${summarizeFor === opt.id ? "on" : ""}`} />
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
                    <button className={`model-btn ${modelOpen ? "open" : ""}`}
                      onClick={() => { setModelOpen((v) => !v); setVariantOpen(false); }}
                      onBlur={() => setTimeout(() => setModelOpen(false), 150)}>
                      <div className="model-left">
                        <div className="model-dot" />
                        <span>{selectedProvider?.label ?? model}</span>
                      </div>
                      <ChevronDownIcon />
                    </button>
                    {modelOpen && (
                      <div className="model-menu">
                        {MODEL_PROVIDERS.map((m) => (
                          <div key={m.id} className={`model-opt ${model === m.id ? "on" : ""}`}
                            onMouseDown={() => { setModelAndVariant(m.id); setModelOpen(false); }}>
                            <div className="model-opt-name">{m.label}</div>
                            {model === m.id && <span className="model-check">✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="model-label">Model version</div>
                  <div className="model-wrap">
                    <button className={`model-btn ${variantOpen ? "open" : ""}`}
                      onClick={() => { setVariantOpen((v) => !v); setModelOpen(false); }}
                      onBlur={() => setTimeout(() => setVariantOpen(false), 150)}>
                      <div className="model-left">
                        <span>{selectedVariant?.label ?? modelVariant}</span>
                      </div>
                      <ChevronDownIcon />
                    </button>
                    {variantOpen && variants.length > 0 && (
                      <div className="model-menu">
                        {variants.map((v) => (
                          <div key={v.id} className={`model-opt ${modelVariant === v.id ? "on" : ""}`}
                            onMouseDown={() => { setModelVariant(v.id); setVariantOpen(false); }}>
                            <div>
                              <div className="model-opt-name">{v.label}</div>
                              {v.desc && <div className="model-opt-desc">{v.desc}</div>}
                            </div>
                            {modelVariant === v.id && <span className="model-check">✓</span>}
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
                  disabled={loading || uploading || selectedFiles.length === 0}
                >
                  {(loading || uploading)
                    ? <><div className="spinner" />{uploading ? "Uploading..." : "Summarizing..."}</>
                    : <><SparkleIcon /> Summarize</>
                  }
                </button>
              </>)}

              {/* ── Improve mode ── */}
              {dashMode === "improve" && (
                <div className="improve-panel centered">
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

                  <div className="improve-section-head">Find a Design Template <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="improve-txt-inp"
                      placeholder="e.g. modern dark, minimal blue…"
                      value={themeQuery}
                      onChange={(e) => setThemeQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleThemeSearch()}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="improve-btn-secondary"
                      style={{ flex: "none", width: 60 }}
                      disabled={themeSearchLoading || !themeQuery.trim()}
                      onClick={() => void handleThemeSearch()}
                    >
                      {themeSearchLoading ? <span className="improve-mini-spin" /> : "Search"}
                    </button>
                  </div>
                  {themeSearchErr && <div className="improve-err">{themeSearchErr}</div>}
                  {themeResults.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {themeResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="improve-theme-chip"
                          style={{
                            border: `1px solid ${selectedThemeId === t.id ? "rgba(99,102,241,.7)" : "rgba(255,255,255,.12)"}`,
                            background: selectedThemeId === t.id ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.04)",
                            color: selectedThemeId === t.id ? "#c7d2fe" : "rgba(255,255,255,.6)",
                          }}
                          onClick={async () => {
                            setSelectedThemeId(t.id);
                            if (t._templateSpec) { setSelectedTemplateSpec(t._templateSpec); return; }
                            setThemeSearchLoading(true);
                            try {
                              const baseQ = (themeResultsQuery || themeQuery).trim() || t.name;
                              const params = new URLSearchParams({ q: baseQ, model: improveAiModel, themeId: String(t.id), themeName: t.name || "" });
                              const res = await fetch(`/api/improve-ppt/theme-search?${params.toString()}`);
                              const data = await res.json().catch(() => ({}));
                              if (data.templateSpec) { t._templateSpec = data.templateSpec; setSelectedTemplateSpec(data.templateSpec); }
                            } catch (e) { setThemeSearchErr(e?.message || String(e)); }
                            finally { setThemeSearchLoading(false); }
                          }}
                        >{t.name}</button>
                      ))}
                    </div>
                  )}
                  {selectedTemplateSpec && (
                    <div style={{ fontSize: 11, color: "rgba(165,180,252,.9)" }}>
                      ✓ Using: <strong>{selectedTemplateSpec._themeName}</strong> — {selectedTemplateSpec._summary}
                    </div>
                  )}

                  <div className="improve-section-head">AI Model</div>
                  <div className="model-wrap">
                    <button
                      className={`model-btn ${improveModelOpen ? "open" : ""}`}
                      onClick={() => setImproveModelOpen((v) => !v)}
                      onBlur={() => setTimeout(() => setImproveModelOpen(false), 150)}
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
                            onMouseDown={() => { setImproveAiModel(opt); setImproveModelOpen(false); }}
                          >
                            <div className="model-opt-name">{opt}</div>
                            {improveAiModel === opt && <span className="model-check">✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 11.5, color: "rgba(255,255,255,.55)" }}
                    onClick={() => setAdditiveImprove((v) => !v)}>
                    <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${additiveImprove ? "#818cf8" : "rgba(255,255,255,.2)"}`, background: additiveImprove ? "rgba(99,102,241,.3)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                      {additiveImprove && "✓"}
                    </div>
                    Improve in place (keep original wording unless you ask otherwise)
                  </label>

                  {planAdjustments.length > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(165,180,252,.85)", background: "rgba(99,102,241,.06)", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(99,102,241,.15)" }}>
                      {planAdjustments.length} planned adjustment{planAdjustments.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {planError && <div className="improve-err">{planError}</div>}
                  {improveErr && <div className="improve-err">{improveErr}</div>}

                  <div className="improve-btn-row">
                    <button
                      className="improve-btn-primary improve-btn-full"
                      onClick={handleImproveGenerate}
                      disabled={improveGenLoading || parseLoading || !parsedSlides?.length || !improveInstructions.trim()}
                    >
                      {improveGenLoading ? <span className="improve-mini-spin" /> : "✦"} Build PPTX
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
        <div className="modal-backdrop doc-preview-backdrop" onClick={closeDocPreview}>
          <div className="modal-box doc-preview-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-preview-head">
              <div>
                <div className="doc-preview-title">{docPreviewDoc.name}</div>
                <div className="doc-preview-meta">
                  {docPreviewDoc.type} · {formatBytes(docPreviewDoc.size)}
                </div>
              </div>
              <button type="button" className="file-remove" aria-label="Close preview" onClick={closeDocPreview}>
                <CloseIcon />
              </button>
            </div>
            <div className="doc-preview-toolbar">
              <a
                className="doc-preview-open-tab"
                href={docPreviewTabHref || `/api/documents/${docPreviewDoc.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in new tab
              </a>
            </div>
            {docPreviewSetupErr ? (
              <div className="improve-err" style={{ margin: 0 }}>{docPreviewSetupErr}</div>
            ) : (
              <p className="doc-preview-hint">
                PDFs and images use the built-in viewer below. PowerPoint, Word, and Excel use Microsoft&apos;s viewer
              </p>
            )}
            <div
              className={`doc-preview-frame-wrap${
                docPreviewTokenLoading || (docPreviewSrc && docPreviewIframeLoading) ? " doc-preview-frame-busy" : ""
              }`}
            >
              {(docPreviewTokenLoading || (docPreviewSrc && docPreviewIframeLoading)) && (
                <div className="doc-preview-frame-overlay">
                  <div className="sidebar-loading" style={{ padding: 0 }}>
                    <div className="mini-spinner" />{" "}
                    {docPreviewTokenLoading ? "Preparing preview…" : "Loading preview…"}
                  </div>
                </div>
              )}
              {docPreviewSrc && !docPreviewSetupErr ? (
                <iframe
                  className="doc-preview-frame"
                  title={`Preview: ${docPreviewDoc.name}`}
                  src={docPreviewSrc}
                  onLoad={() => setDocPreviewIframeLoading(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {useExistingDialog && (        <div className="modal-backdrop" onClick={() => setUseExistingDialog(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Files already on server</div>
            <div className="modal-desc">
              {useExistingDialog.names.length} file{useExistingDialog.names.length !== 1 ? "s" : ""} with the same name
              {useExistingDialog.names.length === 1 ? " is" : " are"} already uploaded. Use existing uploads to avoid duplicates?
            </div>
            <div className="modal-btns">
              <button className="modal-btn secondary" onClick={() => handleUseExistingConfirm(false)}>
                Upload again
              </button>
              <button className="modal-btn primary" onClick={() => handleUseExistingConfirm(true)}>
                Use existing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}