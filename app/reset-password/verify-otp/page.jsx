"use client";

import "./verify-otp-page.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldIcon } from "../../components/icons";
import AuthMarketingNav from "../../components/AuthMarketingNav";
import AuthPageChrome from "../../components/AuthPageChrome";

export default function VerifyOTP() {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("resetEmail");
    const savedExpiresAt = sessionStorage.getItem("resetOtpExpiresAt");
    if (!savedEmail) {
      router.push("/reset-password");
      return;
    }
    setEmail(savedEmail);
    if (savedExpiresAt) {
      const ms = Date.parse(savedExpiresAt);
      if (!Number.isNaN(ms)) setExpiresAtMs(ms);
    }
  }, []);

  useEffect(() => {
    // Keep countdown in sync with the server-provided expiresAt.
    if (!expiresAtMs) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((expiresAtMs - Date.now()) / 1000),
      );
      setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtMs]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleVerify() {
    const otpValue = otp.join("");
    if (otpValue.length < 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (expiresAtMs && Date.now() > expiresAtMs) {
      setError("OTP has expired. Please request a new one.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem("resetToken", data.token);
        router.push("/reset-password/new-password");
      } else {
        setError(data.error || "Invalid OTP. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.expiresAt) {
        sessionStorage.setItem("resetOtpExpiresAt", data.expiresAt);
        const ms = Date.parse(data.expiresAt);
        if (!Number.isNaN(ms)) setExpiresAtMs(ms);
      }
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setResending(false);
    }
  }

  return (
    <>
<AuthPageChrome header={<AuthMarketingNav />} blobCount={2}>
        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <div className="icon-wrap">
              <ShieldIcon />
            </div>
            <h1 className="card-title">Enter OTP</h1>
            <p className="card-desc">We sent a 6-digit code to</p>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <span className="email-badge">{email}</span>
            </div>

            <div className="otp-row" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  className={`otp-input ${error ? "error" : digit ? "filled" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                />
              ))}
            </div>

            <div className="countdown" style={{ marginTop: "12px" }}>
              {countdown > 0 ? (
                <>
                  Code expires in{" "}
                  <span
                    style={{ color: countdown <= 30 ? "#fca5a5" : "#a5b4fc" }}
                  >
                    {formatTime(countdown)}
                  </span>
                </>
              ) : (
                <>
                  Code expired.{" "}
                  <button
                    className="resend-btn"
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? "Sending..." : "Resend OTP"}
                  </button>
                </>
              )}
            </div>

            {countdown > 0 && (
              <div style={{ textAlign: "center", marginBottom: "4px" }}>
                <button
                  className="resend-btn"
                  onClick={handleResend}
                  disabled={resending || countdown > 100}
                >
                  {resending ? "Sending..." : "Resend OTP"}
                </button>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}

            <button
              className="btn-verify"
              onClick={handleVerify}
              disabled={loading || otp.join("").length < 6 || countdown <= 0}
            >
              {loading && <span className="spinner" />}
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              className="back-link"
              onClick={() => router.push("/reset-password")}
            >
              ← Back
            </button>
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
