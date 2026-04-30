"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  UserCircleIcon,
} from "@/app/components/icons";
import ThemeToggle from "@/app/components/ThemeToggle";
import AppHeader from "@/app/components/AppHeader";
import AuthPageChrome from "@/app/components/AuthPageChrome";

export default function Slide2NotesLogin() {
  const router = useRouter();
  const { status } = useSession();
  const showAuthLoading = status !== "unauthenticated";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated, never stay on the login page
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  async function handleSignIn() {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      // Force consistent post-login landing page.
      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
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
          background: var(--login-card-bg);
          border: 1px solid var(--login-card-border);
          border-radius: 22px;
          padding: 40px 40px 36px;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.08),
            0 32px 64px rgba(0,0,0,0.15),
            0 8px 24px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        html[data-theme="light"] .card {
          box-shadow:
            0 0 0 1px rgba(99,102,241,0.12),
            0 24px 48px rgba(15,23,42,0.08),
            0 8px 20px rgba(15,23,42,0.06);
        }

        /* Light theme: inputs + OR separator need explicit contrast */
        html[data-theme="light"] .field-label {
          color: rgba(0,0,0,0.55);
        }
        html[data-theme="light"] .field-label.focused {
          color: rgba(79,70,229,0.85);
        }

        html[data-theme="light"] .field-input {
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.03);
          color: #111827;
        }
        html[data-theme="light"] .field-input::placeholder {
          color: rgba(0,0,0,0.35);
        }
        html[data-theme="light"] .field-input:focus {
          border-color: rgba(99,102,241,0.45);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.10), 0 2px 10px rgba(0,0,0,0.08);
        }

        html[data-theme="light"] .field-toggle {
          color: rgba(0,0,0,0.35);
        }
        html[data-theme="light"] .field-toggle:hover {
          color: rgba(0,0,0,0.60);
        }

        html[data-theme="light"] .or-line {
          background: rgba(0,0,0,0.10);
        }
        html[data-theme="light"] .or-text {
          color: rgba(0,0,0,0.50);
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
          color: var(--login-card-title);
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

        .error-text {
          margin-top: 10px;
          font-size: 12px;
          color: #f87171;
          text-align: center;
        }

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
          border: 1px solid rgba(255,255,255,0.16);
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

        /* Make Google button border clearly visible in light mode */
        html[data-theme="light"] .btn-google {
          border-color: rgba(15,23,42,0.22);
          background: rgba(255,255,255,0.9);
          color: #111827;
        }
        html[data-theme="light"] .btn-google:hover {
          border-color: rgba(15,23,42,0.32);
          background: rgba(248,250,252,1);
          color: #020617;
        }

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

        .auth-loading {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .auth-spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid rgba(99,102,241,0.22);
          border-top-color: #6366f1;
          animation: authSpin 0.9s linear infinite;
        }
        .auth-loading-text {
          font-size: 13px;
          font-weight: 500;
          color: var(--app-muted);
          letter-spacing: 0.02em;
        }
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <AuthPageChrome
        shell="themed"
        blobCount={3}
        header={
          <AppHeader
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ThemeToggle />
                <button type="button" className="login-user-ico">
                  <UserCircleIcon />
                </button>
              </div>
            }
          />
        }
      >
        <style>{`
          .login-user-ico {
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
          .login-user-ico:hover {
            border-color: rgba(99,102,241,0.45);
            background: rgba(99,102,241,0.1);
            color: #a5b4fc;
          }
        `}</style>

        <main className="main">
          <div className="card">
            <div className="card-top-glow" />
            {showAuthLoading ? (
              <div className="auth-loading">
                <div className="auth-spinner" />
                <p className="auth-loading-text">
                  {status === "authenticated" ? "Redirecting to dashboard..." : "Checking session..."}
                </p>
              </div>
            ) : (
              <>
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

                <button
                  className="btn-signin"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                {error && <p className="error-text">{error}</p>}

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
                  <button className="footer-link" onClick={() => router.push("/reset-password")}>Forgot password?</button>
                </div>
              </>
            )}
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
