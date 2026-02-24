"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

const GoogleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const EyeIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SlidesIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const UserCircleIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
  </svg>
);

const ChevronDown = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function Slide2NotesLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #0e0e12; }

        .s2n {
          min-height: 100vh;
          background: #0e0e12;
          font-family: 'Sora', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .blob1 {
          position: fixed;
          top: -15%;
          right: -8%;
          width: 650px;
          height: 650px;
          background: radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
        .blob2 {
          position: fixed;
          bottom: -10%;
          left: -5%;
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
        .blob3 {
          position: fixed;
          top: 45%;
          left: 38%;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }

        /* NAVBAR */
        .navbar {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 36px;
          height: 60px;
          background: rgba(14,14,18,0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.055);
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e8e8f0;
          text-decoration: none;
        }
        .logo-badge {
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 14px rgba(99,102,241,0.45);
          flex-shrink: 0;
        }
        .logo-text {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          font-weight: 600;
          background: linear-gradient(90deg, #e8e8f0 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }
        .navbar-user-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #8080a0;
          transition: all 0.2s;
        }
        .navbar-user-btn:hover {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.1);
          color: #a5b4fc;
        }

        /* SUBNAV */
        .subnav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 36px;
          height: 42px;
          background: rgba(16,16,22,0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(255,255,255,0.035);
        }
        .subnav-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 16px;
          height: 42px;
          font-size: 12.5px;
          font-family: 'Sora', sans-serif;
          font-weight: 400;
          color: #52526e;
          cursor: pointer;
          border: none;
          background: none;
          transition: color 0.2s;
          letter-spacing: 0.025em;
        }
        .subnav-item:hover { color: #9090b8; }

        /* MAIN */
        .main {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 102px);
          padding: 48px 16px;
        }

        /* CARD */
        .card {
          width: 100%;
          max-width: 400px;
          position: relative;
          background: rgba(20,20,28,0.9);
          border: 1px solid rgba(255,255,255,0.075);
          border-radius: 22px;
          padding: 40px 40px 36px;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.08),
            0 32px 64px rgba(0,0,0,0.6),
            0 8px 24px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .card-top-glow {
          position: absolute;
          top: 0; left: 20%; right: 20%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(139,92,246,0.55), rgba(99,102,241,0.55), transparent);
          border-radius: 999px;
        }

        .card-eyebrow {
          text-align: center;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #7c7cf8;
          margin-bottom: 8px;
        }
        .card-title {
          font-family: 'Fraunces', serif;
          font-size: 27px;
          font-weight: 600;
          color: #eeeef8;
          text-align: center;
          margin-bottom: 34px;
          letter-spacing: -0.025em;
          line-height: 1.2;
        }
        .card-title em {
          font-style: italic;
          font-weight: 300;
          color: #a5b4fc;
        }

        /* FIELDS */
        .field-group { margin-bottom: 16px; }

        .field-label {
          display: block;
          font-size: 11.5px;
          font-weight: 500;
          color: #60607a;
          margin-bottom: 7px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .field-label.focused { color: #9090d8; }

        .field-wrapper { position: relative; }

        .field-input {
          width: 100%;
          height: 46px;
          padding: 0 44px 0 15px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          font-family: 'Sora', sans-serif;
          font-size: 13.5px;
          font-weight: 300;
          color: #dcdcf0;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.16); }
        .field-input:focus {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.055);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1), 0 2px 10px rgba(0,0,0,0.25);
        }

        .field-toggle {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.18);
          cursor: pointer;
          background: none;
          border: none;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 5px;
          transition: color 0.2s;
        }
        .field-toggle:hover { color: rgba(255,255,255,0.45); }

        /* SIGN IN BTN */
        .btn-signin {
          width: 100%;
          height: 46px;
          margin-top: 8px;
          border-radius: 11px;
          border: none;
          background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%);
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          letter-spacing: 0.025em;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 18px rgba(99,102,241,0.38), 0 1px 3px rgba(0,0,0,0.3);
        }
        .btn-signin::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn-signin:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.52), 0 2px 6px rgba(0,0,0,0.3);
        }
        .btn-signin:hover::after { opacity: 1; }
        .btn-signin:active { transform: translateY(0); }

        /* OR */
        .or-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        .or-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.055);
        }
        .or-text {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* GOOGLE BTN */
        .btn-google {
          width: 100%;
          height: 46px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.085);
          background: rgba(255,255,255,0.035);
          font-family: 'Sora', sans-serif;
          font-size: 13.5px;
          font-weight: 400;
          color: #b0b0cc;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.2s, border-color 0.2s, transform 0.15s, color 0.2s;
        }
        .btn-google:hover {
          background: rgba(255,255,255,0.065);
          border-color: rgba(255,255,255,0.14);
          color: #d0d0e8;
          transform: translateY(-1px);
        }
        .btn-google:active { transform: translateY(0); }

        /* FOOTER */
        .card-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .footer-link {
          font-size: 12px;
          color: rgba(255,255,255,0.26);
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          letter-spacing: 0.01em;
          transition: color 0.2s;
          padding: 0;
        }
        .footer-link:hover { color: rgba(255,255,255,0.6); }
        .footer-link.cta {
          color: #8080f8;
          font-weight: 500;
        }
        .footer-link.cta:hover { color: #b0b0ff; }
      `}</style>

      <div className="s2n">
        <div className="blob1" />
        <div className="blob2" />
        <div className="blob3" />

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="navbar-logo">
            <div className="logo-badge">
              <SlidesIcon />
            </div>
            <span className="logo-text">Slide2Notes</span>
          </div>
          <button className="navbar-user-btn">
            <UserCircleIcon />
          </button>
        </nav>

        {/* SUBNAV */}
        <div className="subnav">
          <button className="subnav-item">
            Text 1 <ChevronDown />
          </button>
          <button className="subnav-item">
            Text 2 <ChevronDown />
          </button>
        </div>

        {/* MAIN */}
        <main className="main">
          <div className="card">
            <div className="card-top-glow" />

            <p className="card-eyebrow">Welcome back</p>
            <h1 className="card-title">
              Login to <em>Slide2Notes</em>
            </h1>

            {/* Email */}
            <div className="field-group">
              <label className={`field-label ${emailFocused ? "focused" : ""}`}>
                Email address
              </label>
              <div className="field-wrapper">
                <input
                  className="field-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label className={`field-label ${passFocused ? "focused" : ""}`}>
                Password
              </label>
              <div className="field-wrapper">
                <input
                  className="field-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <button
                  className="field-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            <button className="btn-signin">Sign In</button>

            <div className="or-row">
              <div className="or-line" />
              <span className="or-text">or</span>
              <div className="or-line" />
            </div>

            <button
              className="btn-google"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="card-footer">
              <Link href="/register" className="footer-link cta">
                New? Register an account
              </Link>
              <button className="footer-link">Forgot password?</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
