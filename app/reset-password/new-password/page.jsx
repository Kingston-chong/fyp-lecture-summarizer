"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  SlidesIcon,
  UserCircleIcon,
  CheckCircle,
} from "../../components/icons";

export default function NewPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const savedToken = sessionStorage.getItem("resetToken");
    const savedEmail = sessionStorage.getItem("resetEmail");
    if (!savedToken || !savedEmail) { router.push("/reset-password"); return; }
    setToken(savedToken);
    setEmail(savedEmail);
  }, []);

  const rules = useMemo(() => ({
    length: password.length >= 8,
    symbol: /[^a-zA-Z0-9]/.test(password),
    alpha: /[a-zA-Z]/.test(password),
  }), [password]);

  const allValid = rules.length && rules.symbol && rules.alpha;
  const passwordMatch = password && confirm && password === confirm;

  async function handleReset() {
    if (!allValid) { setError("Password does not meet requirements."); return; }
    if (!passwordMatch) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        sessionStorage.removeItem("resetEmail");
        sessionStorage.removeItem("resetToken");
        setTimeout(() => router.push("/"), 2500);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0e0e12; }
        .s2n { min-height: 100vh; background: #0e0e12; font-family: 'Sora', sans-serif; display: flex; align-items: center; justify-content: center; }
        .success-card { text-align: center; animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .success-icon { width: 80px; height: 80px; border-radius: 50%; background: rgba(52,211,153,0.12); border: 2px solid rgba(52,211,153,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; animation: pulse 1.5s ease infinite; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 0 12px rgba(52,211,153,0); } }
        .success-title { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; color: #eeeef8; margin-bottom: 10px; }
        .success-desc { font-size: 13.5px; color: rgba(255,255,255,0.4); }
      `}</style>
      <div className="s2n">
        <div className="success-card">
          <div className="success-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="success-title">Password Reset!</h1>
          <p className="success-desc">Redirecting you to login...</p>
        </div>
      </div>
    </>
  );

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
        .subnav { position: relative; z-index: 10; display: flex; align-items: center; justify-content: flex-end; padding: 0 36px; height: 42px; background: rgba(16,16,22,0.75); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.035); }
        .subnav-item { display: flex; align-items: center; gap: 5px; padding: 0 16px; height: 42px; font-size: 12.5px; font-family: 'Sora', sans-serif; color: #52526e; cursor: pointer; border: none; background: none; transition: color 0.2s; }
        .subnav-item:hover { color: #9090b8; }
        .main { position: relative; z-index: 5; display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 102px); padding: 48px 16px; }
        .card { width: 100%; max-width: 420px; position: relative; background: rgba(20,20,28,0.9); border: 1px solid rgba(255,255,255,0.075); border-radius: 22px; padding: 40px 40px 36px; backdrop-filter: blur(24px); box-shadow: 0 0 0 1px rgba(99,102,241,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06); animation: cardIn 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .card-glow { position: absolute; top: 0; left: 20%; right: 20%; height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.55), rgba(99,102,241,0.55), transparent); border-radius: 999px; }
        .icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #a5b4fc; }
        .card-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; color: #eeeef8; text-align: center; margin-bottom: 8px; letter-spacing: -0.025em; }
        .card-desc { font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.4); text-align: center; margin-bottom: 28px; }
        .field-group { margin-bottom: 16px; }
        .field-label { display: block; font-size: 11.5px; font-weight: 500; color: #60607a; margin-bottom: 7px; letter-spacing: 0.06em; text-transform: uppercase; transition: color 0.2s; }
        .field-label.focused { color: #9090d8; }
        .field-wrapper { position: relative; }
        .field-input { width: 100%; height: 46px; padding: 0 44px 0 15px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.035); font-family: 'Sora', sans-serif; font-size: 13.5px; font-weight: 300; color: #dcdcf0; outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; }
        .field-input::placeholder { color: rgba(255,255,255,0.16); }
        .field-input:focus { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.055); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .field-input.match { border-color: rgba(52,211,153,0.4); }
        .field-input.mismatch { border-color: rgba(248,113,113,0.4); }
        .field-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.18); cursor: pointer; background: none; border: none; display: flex; align-items: center; padding: 4px; border-radius: 5px; transition: color 0.2s; }
        .field-toggle:hover { color: rgba(255,255,255,0.45); }
        .rules-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .rule-row { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 300; }
        .rule-text.met { color: #a7f3d0; }
        .rule-text.unmet { color: rgba(255,255,255,0.3); }
        .error-msg { margin-top: 4px; padding: 10px 14px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); font-size: 12.5px; color: #fca5a5; text-align: center; }
        .btn-reset { width: 100%; height: 46px; margin-top: 8px; border-radius: 11px; border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; letter-spacing: 0.025em; transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s; box-shadow: 0 4px 18px rgba(99,102,241,0.38); }
        .btn-reset:hover:not(:disabled) { transform: translateY(-1.5px); box-shadow: 0 8px 24px rgba(99,102,241,0.52); }
        .btn-reset:disabled { opacity: 0.6; cursor: not-allowed; }
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
          <button className="subnav-item">Text 1 <ChevronDownIcon /></button>
          <button className="subnav-item">Text 2 <ChevronDownIcon /></button>
        </div>

        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <div className="icon-wrap"><LockIcon /></div>
            <h1 className="card-title">New Password</h1>
            <p className="card-desc">Choose a strong new password for your account.</p>

            <div className="field-group">
              <label className="field-label">New Password</label>
              <div className="field-wrapper">
                <input
                  className="field-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button className="field-toggle" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            <div className="rules-box">
              {[
                { met: rules.length, label: "At least 8 characters" },
                { met: rules.symbol, label: "Contains a symbol" },
                { met: rules.alpha, label: "Contains alphabets" },
              ].map(({ met, label }) => (
                <div className="rule-row" key={label}>
                  <CheckCircle met={met} />
                  <span className={`rule-text ${met ? "met" : "unmet"}`}>{label}</span>
                </div>
              ))}
            </div>

            <div className="field-group">
              <label className="field-label">Confirm New Password</label>
              <div className="field-wrapper">
                <input
                  className={`field-input ${confirm ? (passwordMatch ? "match" : "mismatch") : ""}`}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
                <button className="field-toggle" onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-reset" onClick={handleReset} disabled={loading || !allValid || !passwordMatch}>
              {loading && <span className="spinner" />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </main>
      </div>
    </>
  );
}