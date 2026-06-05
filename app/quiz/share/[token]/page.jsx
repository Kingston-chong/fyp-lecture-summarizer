"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import QuizViewModal from "@/app/components/QuizViewModal";
import { Spinner } from "@/app/components/icons";
import { useQuizAcceptingLiveState } from "@/app/hooks/useQuizAcceptingLiveState";

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
  const { data: session, status: sessionStatus } = useSession();
  const token = String(params?.token ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quizSet, setQuizSet] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [respondentName, setRespondentName] = useState("");

  const isSignedIn = sessionStatus === "authenticated";
  const accountLabel = useMemo(() => {
    const u = session?.user;
    const name = String(u?.username ?? u?.name ?? "").trim();
    return name.slice(0, 120);
  }, [session?.user]);

  const acceptingResponses = useQuizAcceptingLiveState(
    Boolean(quizSet?.acceptingResponses),
    quizSet?.closesAt,
  );

  const settings = useMemo(
    () => (quizSet ? settingsFromQuizSet(quizSet) : null),
    [quizSet],
  );

  const respondentLabel = isSignedIn
    ? accountLabel
    : respondentName.trim().slice(0, 120);

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
        setQuizSet({
          ...data.quizSet,
          acceptingResponses: Boolean(data.acceptingResponses),
          closesAt: data.closesAt ?? null,
          collectionStatus: data.collectionStatus ?? "closed",
        });
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
          {error ||
            "This link may be invalid or the lecturer has unpublished the quiz."}
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

  if (sessionStatus === "loading") {
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

  const canStart = acceptingResponses;
  const nameRequired = !isSignedIn;
  const nameOk = !nameRequired || respondentName.trim().length > 0;
  const canStartQuiz = canStart && nameOk;

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
          {!canStart && (
            <p
              style={{
                opacity: 0.65,
                maxWidth: 360,
                lineHeight: 1.5,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              Your lecturer has not opened this quiz for responses yet, or
              response collection has ended. Check back when they start
              collecting.
            </p>
          )}
          {canStart && isSignedIn && accountLabel && (
            <p
              style={{
                opacity: 0.65,
                maxWidth: 360,
                lineHeight: 1.5,
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              Submitting as <strong>{accountLabel}</strong>
            </p>
          )}
          {canStart && nameRequired && (
            <label
              style={{
                display: "block",
                maxWidth: 320,
                width: "100%",
                marginBottom: 14,
                textAlign: "left",
                fontSize: 13,
              }}
            >
              <span style={{ display: "block", marginBottom: 6, opacity: 0.7 }}>
                Your name (shown to your lecturer)
              </span>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="e.g. Alex Chen"
                maxLength={120}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              />
            </label>
          )}
          {canStart && !isSignedIn && (
            <p
              style={{
                opacity: 0.55,
                maxWidth: 360,
                fontSize: 12,
                marginBottom: 12,
                lineHeight: 1.45,
              }}
            >
              No account needed.{" "}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/login?callbackUrl=${encodeURIComponent(`/quiz/share/${token}`)}`,
                  )
                }
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#c7d2fe",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  textDecoration: "underline",
                }}
              >
                Sign in
              </button>{" "}
              to link this attempt to your account.
            </p>
          )}
          <button
            type="button"
            className="btn-create"
            disabled={!canStartQuiz}
            onClick={() => setQuizOpen(true)}
            style={
              !canStartQuiz
                ? { opacity: 0.45, cursor: "not-allowed" }
                : undefined
            }
          >
            Start quiz
          </button>
        </div>
      )}
      {quizOpen && (
        <QuizViewModal
          quizSet={{ ...quizSet, acceptingResponses }}
          settings={settings}
          shareToken={token}
          respondentLabel={respondentLabel}
          onClose={() => {
            setQuizOpen(false);
            if (isSignedIn) router.push("/dashboard");
          }}
        />
      )}
    </>
  );
}
