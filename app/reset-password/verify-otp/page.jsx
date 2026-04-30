"use client";

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
  const [countdown, setCountdown] = useState(120);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem("resetEmail");
    if (!savedEmail) { router.push("/reset-password"); return; }
    setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleVerify() {
    const otpValue = otp.join("");
    if (otpValue.length < 6) { setError("Please enter the complete 6-digit OTP."); return; }
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
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setCountdown(120);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <style>{`
        .main { position: relative; z-index: 5; display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 102px); padding: 48px 16px; }
        .card { width: 100%; max-width: 420px; position: relative; background: rgba(20,20,28,0.9); border: 1px solid rgba(255,255,255,0.075); border-radius: 22px; padding: 40px 40px 36px; backdrop-filter: blur(24px); box-shadow: 0 0 0 1px rgba(99,102,241,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06); animation: cardIn 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .card-glow { position: absolute; top: 0; left: 20%; right: 20%; height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.55), rgba(99,102,241,0.55), transparent); border-radius: 999px; }
        .icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #a5b4fc; }
        .card-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; color: #eeeef8; text-align: center; margin-bottom: 10px; letter-spacing: -0.025em; }
        .card-desc { font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.7; margin-bottom: 8px; }
        .email-badge { display: inline-block; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); border-radius: 6px; padding: 3px 10px; font-size: 12.5px; color: #a5b4fc; font-weight: 500; margin-bottom: 28px; }
        .otp-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 8px; }
        .otp-input { width: 52px; height: 58px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; color: #eeeef8; text-align: center; outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.15s; caret-color: #a5b4fc; }
        .otp-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.08); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); transform: scale(1.05); }
        .otp-input.filled { border-color: rgba(99,102,241,0.35); background: rgba(99,102,241,0.06); }
        .otp-input.error { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.06); }
        .countdown { text-align: center; font-size: 12px; color: rgba(255,255,255,0.25); margin-bottom: 20px; letter-spacing: 0.02em; }
        .countdown span { font-weight: 500; font-variant-numeric: tabular-nums; }
        .resend-btn { background: none; border: none; font-family: 'Sora', sans-serif; font-size: 12px; color: #8080f8; cursor: pointer; text-decoration: underline; transition: color 0.2s; }
        .resend-btn:hover { color: #b0b0ff; }
        .resend-btn:disabled { color: rgba(255,255,255,0.2); cursor: not-allowed; text-decoration: none; }
        .error-msg { margin-top: 10px; padding: 10px 14px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); font-size: 12.5px; color: #fca5a5; text-align: center; }
        .btn-verify { width: 100%; height: 46px; margin-top: 20px; border-radius: 11px; border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; letter-spacing: 0.025em; transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s; box-shadow: 0 4px 18px rgba(99,102,241,0.38); }
        .btn-verify:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 24px rgba(99,102,241,0.52); }
        .btn-verify:disabled { opacity: 0.6; cursor: not-allowed; }
        .back-link { display: flex; align-items: center; justify-content: center; margin-top: 16px; font-size: 12.5px; color: rgba(255,255,255,0.3); background: none; border: none; cursor: pointer; font-family: 'Sora', sans-serif; transition: color 0.2s; width: 100%; }
        .back-link:hover { color: rgba(255,255,255,0.6); }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; display: inline-block; animation: spin 0.7s linear infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <AuthPageChrome header={<AuthMarketingNav />} blobCount={2}>
        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <div className="icon-wrap"><ShieldIcon /></div>
            <h1 className="card-title">Enter OTP</h1>
            <p className="card-desc">We sent a 6-digit code to</p>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <span className="email-badge">{email}</span>
            </div>

            <div className="otp-row" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  className={`otp-input ${error ? "error" : digit ? "filled" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                />
              ))}
            </div>

            <div className="countdown" style={{ marginTop: "12px" }}>
              {countdown > 0 ? (
                <>Code expires in <span style={{ color: countdown <= 30 ? "#fca5a5" : "#a5b4fc" }}>{formatTime(countdown)}</span></>
              ) : (
                <>Code expired. <button className="resend-btn" onClick={handleResend} disabled={resending}>{resending ? "Sending..." : "Resend OTP"}</button></>
              )}
            </div>

            {countdown > 0 && (
              <div style={{ textAlign: "center", marginBottom: "4px" }}>
                <button className="resend-btn" onClick={handleResend} disabled={resending || countdown > 100}>
                  {resending ? "Sending..." : "Resend OTP"}
                </button>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-verify" onClick={handleVerify} disabled={loading || otp.join("").length < 6}>
              {loading && <span className="spinner" />}
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button className="back-link" onClick={() => router.push("/reset-password")}>
              ← Back
            </button>
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}