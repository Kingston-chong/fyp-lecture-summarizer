"use client";

import { useState } from "react";
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

const MailIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  async function handleSendOTP() {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save email to sessionStorage for next steps
        sessionStorage.setItem("resetEmail", email);
        router.push("/reset-password/verify-otp");
      } else {
        setError(data.error || "Email not found. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
        .card { width: 100%; max-width: 400px; position: relative; background: rgba(20,20,28,0.9); border: 1px solid rgba(255,255,255,0.075); border-radius: 22px; padding: 40px 40px 36px; backdrop-filter: blur(24px); box-shadow: 0 0 0 1px rgba(99,102,241,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06); animation: cardIn 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .card-glow { position: absolute; top: 0; left: 20%; right: 20%; height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.55), rgba(99,102,241,0.55), transparent); border-radius: 999px; }
        .icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #a5b4fc; }
        .card-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; color: #eeeef8; text-align: center; margin-bottom: 12px; letter-spacing: -0.025em; }
        .card-desc { font-size: 13px; font-weight: 300; color: #6060808; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.7; margin-bottom: 28px; }
        .card-desc span { color: rgba(255,255,255,0.6); }
        .field-label { display: block; font-size: 11.5px; font-weight: 500; color: #60607a; margin-bottom: 7px; letter-spacing: 0.06em; text-transform: uppercase; transition: color 0.2s; }
        .field-label.focused { color: #9090d8; }
        .field-input { width: 100%; height: 46px; padding: 0 15px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.035); font-family: 'Sora', sans-serif; font-size: 13.5px; font-weight: 300; color: #dcdcf0; outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; }
        .field-input::placeholder { color: rgba(255,255,255,0.16); }
        .field-input:focus { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.055); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .error-msg { margin-top: 10px; padding: 10px 14px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); font-size: 12.5px; color: #fca5a5; text-align: center; }
        .btn-send { width: 100%; height: 46px; margin-top: 20px; border-radius: 11px; border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; letter-spacing: 0.025em; position: relative; overflow: hidden; transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s; box-shadow: 0 4px 18px rgba(99,102,241,0.38); }
        .btn-send:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 24px rgba(99,102,241,0.52); }
        .btn-send:disabled { opacity: 0.6; cursor: not-allowed; }
        .back-link { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 20px; font-size: 12.5px; color: rgba(255,255,255,0.3); background: none; border: none; cursor: pointer; font-family: 'Sora', sans-serif; transition: color 0.2s; width: 100%; }
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

            <div className="icon-wrap"><MailIcon /></div>

            <h1 className="card-title">Reset Password</h1>
            <p className="card-desc">
              Enter your registered email address.<br />
              If the account is valid, you will receive an <span>OTP</span> that allows you to reset your password.
            </p>

            <label className={`field-label ${focused ? "focused" : ""}`}>Email Address</label>
            <input
              className="field-input"
              type="email"
              placeholder="enter email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === "Enter" && handleSendOTP()}
            />

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-send" onClick={handleSendOTP} disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>

            <button className="back-link" onClick={() => router.push("/")}>
              ← Back to Login
            </button>
          </div>
        </main>
      </div>
    </>
  );
}