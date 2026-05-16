"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import QuizViewModal from "@/app/components/QuizViewModal";
import { Spinner } from "@/app/components/icons";

function settingsFromQuizSet(quizSet) {
  const s =
    quizSet?.settings && typeof quizSet.settings === "object"
      ? quizSet.settings
      : {};
  return {
    answerShowMode: s.answerShowMode ?? "Immediately",
    quizMode: s.quizMode ?? "Practice",
    timeLimit:
      typeof s.timeLimit === "number" && !Number.isNaN(s.timeLimit)
        ? s.timeLimit
        : 0,
  };
}

export default function SharedQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { status } = useSession();
  const token = String(params?.token ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quizSet, setQuizSet] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const settings = useMemo(
    () => (quizSet ? settingsFromQuizSet(quizSet) : null),
    [quizSet],
  );

  useEffect(() => {
    if (!token) {
      setError("Invalid quiz link.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/quiz/share/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "This quiz is not available.");
          setQuizSet(null);
          return;
        }
        setQuizSet(data.quizSet);
      } catch {
        if (!cancelled) setError("Could not load quiz.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: "inherit",
        }}
      >
        <Spinner size={16} /> Loading quiz…
      </div>
    );
  }

  if (error || !quizSet) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Quiz unavailable</h1>
        <p style={{ opacity: 0.65, maxWidth: 360, lineHeight: 1.5 }}>
          {error || "This link may be invalid or the lecturer has unpublished the quiz."}
        </p>
        <button
          type="button"
          style={{
            marginTop: 20,
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,.35)",
            background: "rgba(99,102,241,.15)",
            color: "#c7d2fe",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
          onClick={() => router.push("/dashboard")}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>{quizSet.title}</h1>
        <p style={{ opacity: 0.65, maxWidth: 360, lineHeight: 1.5, marginBottom: 20 }}>
          Sign in to take this quiz and save your score.
        </p>
        <button
          type="button"
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,.35)",
            background: "rgba(99,102,241,.15)",
            color: "#c7d2fe",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
          onClick={() =>
            router.push(`/login?callbackUrl=${encodeURIComponent(`/quiz/share/${token}`)}`)
          }
        >
          Sign in
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size={16} />
      </div>
    );
  }

  return (
    <>
      {!quizOpen && (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>{quizSet.title}</h1>
          <p style={{ opacity: 0.6, marginBottom: 16 }}>
            {quizSet.questions?.length ?? 0} questions
          </p>
          <button
            type="button"
            className="btn-create"
            onClick={() => setQuizOpen(true)}
          >
            Start quiz
          </button>
        </div>
      )}
      {quizOpen && (
        <QuizViewModal
          quizSet={quizSet}
          settings={settings}
          shareToken={token}
          onClose={() => router.push("/dashboard")}
        />
      )}
    </>
  );
}
