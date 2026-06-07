"use client";

import Link from "next/link";
import AppLogo from "@/app/components/AppLogo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RegisterPromptModal from "@/app/components/RegisterPromptModal";
import { useRequireAuth } from "@/app/hooks/useRequireAuth";
import {
  ACCEPTED,
  getDefaultVariant,
  MODEL_PROVIDERS,
} from "@/app/dashboard/helpers";
import { GUEST_MAX_FILES, validateGuestFileSelection } from "@/lib/guestUpload";
import {
  formatUploadLimitLabel,
  SERVERLESS_PAYLOAD_MAX_BYTES,
} from "@/lib/uploadLimits";
import { consumeSummarizeSse } from "@/lib/consumeSummarizeSse";
import {
  clearGuestSummarySession,
  loadGuestSummarySession,
  saveGuestSummarySession,
} from "@/lib/guestSessionStorage";
import { markdownToHtml } from "@/lib/markdown";
import { summarizePhaseLabel } from "@/lib/summarizeProgress";
import GuestActionBar from "./components/GuestActionBar";
import {
  useEnsureLlmProvider,
  useLlmProviders,
} from "@/app/hooks/useLlmProviders";
import "./try-page.css";

export default function GuestTryPageClient() {
  const fileInputRef = useRef(null);
  const { authModalOpen, authModalFeature, closeAuthModal, requireAuth } =
    useRequireAuth();

  const [view, setView] = useState("upload");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [summarizeFor, setSummarizeFor] = useState("student");
  const [model, setModel] = useState("gemini");
  const [modelVariant, setModelVariant] = useState(getDefaultVariant("gemini"));
  const llmProviders = useLlmProviders();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusPhase, setStatusPhase] = useState(null);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [output, setOutput] = useState("");
  const [sessionMeta, setSessionMeta] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = loadGuestSummarySession();
    if (saved?.output?.trim()) {
      setTitle(saved.title || "Summary");
      setOutput(saved.output);
      setSessionMeta(saved);
      setSummarizeFor(
        saved.summarizeFor === "lecturer" ? "lecturer" : "student",
      );
      setView("result");
    }
  }, []);

  const setModelAndVariant = useCallback((providerId) => {
    setModel(providerId);
    setModelVariant(getDefaultVariant(providerId));
  }, []);

  useEnsureLlmProvider(model, setModelAndVariant, llmProviders);

  const selectedProvider = MODEL_PROVIDERS.find((m) => m.id === model);
  const variants = selectedProvider?.variants ?? [];

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setSelectedFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= GUEST_MAX_FILES) break;
        if (next.some((f) => f.name === file.name && f.size === file.size))
          continue;
        next.push(file);
      }
      const trimmed = next.slice(0, GUEST_MAX_FILES);
      const check = validateGuestFileSelection(trimmed);
      if (!check.ok) {
        setError(check.error);
        return prev;
      }
      setError("");
      return trimmed;
    });
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const runSummarize = useCallback(async () => {
    if (!selectedFiles.length) {
      setError("Add at least one file to summarize.");
      return;
    }
    setError("");
    setLoading(true);
    setStatusPhase("upload");
    setOutput("");
    setView("result");

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
    formData.append("model", model);
    formData.append("modelVariant", modelVariant);
    formData.append("summarizeFor", summarizeFor);
    formData.append("prompt", prompt);
    formData.append("publishedYearMode", "all");

    let streamTitle =
      selectedFiles[0]?.name?.replace(/\.[^/.]+$/, "") || "Summary";
    let accumulated = "";

    try {
      const res = await fetch("/api/summarize/guest", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Summarization failed");
      }
      if (!contentType.includes("text/event-stream") || !res.body) {
        throw new Error("Unexpected response from server");
      }

      await consumeSummarizeSse(res.body, {
        onStatus: (phase) => setStatusPhase(phase),
        onMeta: (meta) => {
          if (meta?.title) streamTitle = meta.title;
        },
        onChunk: (text) => {
          accumulated += text;
          setOutput(accumulated);
        },
        onDone: (payload) => {
          if (payload?.output) accumulated = payload.output;
        },
      });

      setTitle(streamTitle);
      setOutput(accumulated);
      const session = {
        title: streamTitle,
        output: accumulated,
        summarizeFor,
        model: modelVariant ? `${model}:${modelVariant}` : model,
        fileNames: selectedFiles.map((f) => f.name),
      };
      setSessionMeta(session);
      saveGuestSummarySession(session);
    } catch (err) {
      setError(err?.message ?? "Summarization failed");
      if (!accumulated) setView("upload");
    } finally {
      setLoading(false);
      setStatusPhase(null);
    }
  }, [selectedFiles, model, modelVariant, summarizeFor, prompt]);

  const handleCopy = useCallback(() => {
    if (!output?.trim()) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleNewSummary = useCallback(() => {
    clearGuestSummarySession();
    setView("upload");
    setOutput("");
    setTitle("");
    setSessionMeta(null);
    setSelectedFiles([]);
    setError("");
  }, []);

  const outputHtml = useMemo(() => {
    if (!output?.trim()) return "";
    return markdownToHtml(output);
  }, [output]);

  const hasSummary = Boolean(output?.trim()) && !loading;

  return (
    <div className="try-page">
      <header className="try-nav">
        <Link href="/" className="try-nav-brand">
          <span className="try-nav-logo-mark">
            <AppLogo size={32} priority />
          </span>
          <span className="try-nav-brand-text">Slide2Notes</span>
        </Link>
        <div className="try-nav-links">
          <Link href="/login?callbackUrl=%2Ftry">Sign in</Link>
          <Link href="/register?callbackUrl=%2Ftry" className="try-nav-cta">
            Register
          </Link>
        </div>
      </header>

      <main className="try-main">
        <div className="try-banner">
          Try summarization without an account. Your files and summary are not
          saved to our servers — they stay in this browser session only. Sign up
          to unlock quizzes, slides, chat, and history.
        </div>

        {view === "upload" ? (
          <div className="try-grid">
            <div>
              <div
                className={`try-drop ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  multiple
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <p>
                  <strong>Drop files here</strong> or click to browse
                </p>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.7,
                    marginTop: "0.5rem",
                  }}
                >
                  Up to {GUEST_MAX_FILES} files · max{" "}
                  {formatUploadLimitLabel(SERVERLESS_PAYLOAD_MAX_BYTES)} total ·
                  PDF, PPTX, DOCX, TXT, and more
                </p>
              </div>
              {selectedFiles.length > 0 ? (
                <ul className="try-file-list">
                  {selectedFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="try-file-item">
                      <span>{f.name}</span>
                      <button
                        type="button"
                        className="try-file-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <aside className="try-panel">
              <h3>Settings</h3>
              <label className="try-radio">
                <input
                  type="radio"
                  name="summarizeFor"
                  checked={summarizeFor === "student"}
                  onChange={() => setSummarizeFor("student")}
                />
                Student — key points
              </label>
              <label className="try-radio">
                <input
                  type="radio"
                  name="summarizeFor"
                  checked={summarizeFor === "lecturer"}
                  onChange={() => setSummarizeFor("lecturer")}
                />
                Lecturer — detailed + references
              </label>

              <select
                className="try-select"
                value={model}
                onChange={(e) => {
                  const id = e.target.value;
                  setModel(id);
                  setModelVariant(getDefaultVariant(id));
                }}
                aria-label="AI provider"
              >
                {MODEL_PROVIDERS.map((p) => {
                  const unavailable = !llmProviders.isProviderAvailable(p.id);
                  return (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={unavailable}
                    >
                      {p.label}
                      {unavailable ? " (not configured)" : ""}
                    </option>
                  );
                })}
              </select>
              <select
                className="try-select"
                value={modelVariant}
                onChange={(e) => setModelVariant(e.target.value)}
                aria-label="Model version"
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>

              <textarea
                className="try-prompt"
                placeholder="Optional extra instructions…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                maxLength={500}
              />

              <button
                type="button"
                className="try-submit"
                disabled={loading || selectedFiles.length === 0}
                onClick={runSummarize}
              >
                {loading ? "Summarizing…" : "Generate summary"}
              </button>
              {loading && statusPhase ? (
                <p className="try-status">{summarizePhaseLabel(statusPhase)}</p>
              ) : null}
              {error ? <p className="try-error">{error}</p> : null}
            </aside>
          </div>
        ) : (
          <>
            <div className="try-result-header">
              <div>
                <h1 className="try-result-title">{title || "Your summary"}</h1>
                {sessionMeta?.fileNames?.length ? (
                  <p className="try-result-meta">
                    From: {sessionMeta.fileNames.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="try-output-toolbar">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!hasSummary}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={handleNewSummary}>
                  New summary
                </button>
              </div>
            </div>

            <GuestActionBar
              hasSummary={hasSummary}
              onRequireAuth={(feature) => requireAuth(feature)}
            />

            {loading ? (
              <p className="try-status">
                {summarizePhaseLabel(statusPhase) || "Generating summary…"}
              </p>
            ) : null}
            {error ? <p className="try-error">{error}</p> : null}

            <article className="try-output">
              {outputHtml ? (
                <div dangerouslySetInnerHTML={{ __html: outputHtml }} />
              ) : (
                <p className="try-output-empty">
                  {loading
                    ? "Your summary will appear here…"
                    : "No summary text yet."}
                </p>
              )}
            </article>

            {!loading && view === "result" && selectedFiles.length === 0 ? (
              <p className="try-status" style={{ marginTop: "1rem" }}>
                Tip: use &quot;New summary&quot; to upload different files.
              </p>
            ) : null}
          </>
        )}
      </main>

      <RegisterPromptModal
        open={authModalOpen}
        onClose={closeAuthModal}
        feature={authModalFeature}
      />
    </div>
  );
}
