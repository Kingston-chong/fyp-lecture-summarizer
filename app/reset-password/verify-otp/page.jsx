"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SlidesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
);

const UserCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

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
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; }
        .s2n { min-height: 100vh; background: #0e0e12; font-family: 'Sora', sans-serif; position: relative; overflow: hidden; }
        .blob1 { position: fixed; top: -15%; right: -8%; width: 650px; height: 650px; background: radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 65%); pointer-events: none; z-index: 0; }
        .blob2 { position: fixed; bottom: -10%; left: -5%; width: 520px; height: 520px; background: radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 65%); pointer-events: none; z-index: 0; }
        .navbar { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 0 36px; height: 60px; background: rgba(14,14,18,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.055); }
        .navbar-logo { display: flex; align-items: center; gap: 10px; }
        .logo-badge { width: 34px; height: 34px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 9px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 14px rgba(99,102,241,0.45); }
        .logo-text { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; background: linear-gradient(90deg, #e8e8f0, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.02em; }
        .navbar-user-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #8080a0; transition: all 0.2s; }
        .navbar-user-btn:hover { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.1); color: #a5b4fc; }
        .subnav { position: relative; z-index: 10; display: flex; align-items: center; justify-content: flex-end; padding: 0 36px; height: 42px; background: rgba(16,16,22,0.75); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.035); }
        .subnav-item { display: flex; align-items: center; gap: 5px; padding: 0 16px; height: 42px; font-size: 12.5px; font-family: 'Sora', sans-serif; font-weight: 400; color: #52526e; cursor: pointer; border: none; background: none; transition: color 0.2s; letter-spacing: 0.025em; }
        .subnav-item:hover { color: #9090b8; }
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
        .countdown span { color: countdown <= 30 ? '#fca5a5' : '#a5b4fc'; font-weight: 500; font-variant-numeric: tabular-nums; }
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

      <div className="s2n">
        <div className="blob1" /><div className="blob2" />

        <nav className="navbar">
          <div className="navbar-logo">
            <div className="logo-badge"><SlidesIcon /></div>
            <span className="logo-text">Slide2Notes</span>
          </div>
          <button className="navbar-user-btn"><UserCircleIcon /></button>
        </nav>

        <div className="subnav">
          <button className="subnav-item">Text 1 <ChevronDown /></button>
          <button className="subnav-item">Text 2 <ChevronDown /></button>
        </div>

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
      </div>
    </>
  );
}