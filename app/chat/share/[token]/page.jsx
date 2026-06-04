"use client";

import "@/app/summary/[id]/summary-page.css";
import "../chat-share-page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthMarketingNav from "@/app/components/AuthMarketingNav";
import AuthPageChrome from "@/app/components/AuthPageChrome";
import { Spinner } from "@/app/components/icons";
import SharedConversationView from "../SharedConversationView";
import SharedQuickNotesButton from "../components/SharedQuickNotesButton";

function formatSummaryModelLabel(model) {
  const m = String(model || "").toLowerCase();
  if (m === "chatgpt" || m === "gpt") return "ChatGPT";
  if (m === "deepseek") return "DeepSeek";
  if (m === "gemini") return "Gemini";
  return model || "—";
}

export default function SharedChatPage() {
  const params = useParams();
  const token = String(params?.token ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid share link.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/chat/share/${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "This shared chat is not available.");
          setSnapshot(null);
          return;
        }
        setSnapshot(data.snapshot || null);
      } catch {
        if (!cancelled) setError("Could not load shared chat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthPageChrome header={<AuthMarketingNav />} blobCount={3} shell="themed">
      <main className="chat-share-page">
        {loading ? (
          <div className="chat-share-state">
            <Spinner size={18} />
            <p>Loading shared conversation…</p>
          </div>
        ) : error || !snapshot ? (
          <div className="chat-share-state">
            <h1>Conversation unavailable</h1>
            <p>
              {error ||
                "This link may be invalid or the owner has stopped sharing it."}
            </p>
            <div className="chat-share-footer">
              <Link href="/login" className="chat-share-btn">
                Sign in to Slide2Notes
              </Link>
              <Link href="/" className="chat-share-btn chat-share-btn--ghost">
                Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="chat-share-inner">
            <header className="chat-share-header">
              <p className="chat-share-eyebrow">Shared conversation</p>
              <h1 className="chat-share-title">{snapshot.title}</h1>
              <div className="chat-share-meta">
                {snapshot.model ? (
                  <span>
                    Summary: {formatSummaryModelLabel(snapshot.model)}
                  </span>
                ) : null}
                {snapshot.summarizeFor ? (
                  <span>Mode: {snapshot.summarizeFor}</span>
                ) : null}
                {snapshot.sharedAt ? (
                  <span>
                    Shared{" "}
                    {new Date(snapshot.sharedAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </span>
                ) : null}
              </div>
              <p className="chat-share-banner">
                View-only link — anyone with this URL can read this summary and
                chat. Sign in to create your own summaries and continue chatting.
              </p>
            </header>

            <div className="chat-share-card">
              <SharedConversationView snapshot={snapshot} />
            </div>

            <SharedQuickNotesButton token={token} snapshot={snapshot} />

            <div className="chat-share-footer">
              <Link href="/register" className="chat-share-btn">
                Create free account
              </Link>
              <Link href="/login" className="chat-share-btn chat-share-btn--ghost">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </main>
    </AuthPageChrome>
  );
}
