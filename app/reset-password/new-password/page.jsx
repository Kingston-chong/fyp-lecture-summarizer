"use client";

import "./new-password-page.css";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  CheckCircle,
} from "../../components/icons";
import AuthMarketingNav from "../../components/AuthMarketingNav";
import AuthPageChrome from "../../components/AuthPageChrome";

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
    if (!savedToken || !savedEmail) {
      router.push("/reset-password");
      return;
    }
    setToken(savedToken);
    setEmail(savedEmail);
  }, [router]);

  const rules = useMemo(
    () => ({
      length: password.length >= 8,
      symbol: /[^a-zA-Z0-9]/.test(password),
      alpha: /[a-zA-Z]/.test(password),
    }),
    [password],
  );

  const allValid = rules.length && rules.symbol && rules.alpha;
  const passwordMatch = password && confirm && password === confirm;

  async function handleReset() {
    if (!allValid) {
      setError("Password does not meet requirements.");
      return;
    }
    if (!passwordMatch) {
      setError("Passwords do not match.");
      return;
    }
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

  if (success)
    return (
      <AuthPageChrome
        blobCount={0}
        header={null}
        subnav={false}
        centerContent
        shell="dark"
      >
<div className="success-card">
          <div className="success-icon">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="success-title">Password Reset!</h1>
          <p className="success-desc">Redirecting you to login...</p>
        </div>
      </AuthPageChrome>
    );

  return (
    <>
<AuthPageChrome header={<AuthMarketingNav />} blobCount={2}>
        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <div className="icon-wrap">
              <LockIcon />
            </div>
            <h1 className="card-title">New Password</h1>
            <p className="card-desc">
              Choose a strong new password for your account.
            </p>

            <div className="field-group">
              <label className="field-label">New Password</label>
              <div className="field-wrapper">
                <input
                  className="field-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="field-toggle"
                  onClick={() => setShowPass((v) => !v)}
                >
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
                  <span className={`rule-text ${met ? "met" : "unmet"}`}>
                    {label}
                  </span>
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
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  className="field-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button
              className="btn-reset"
              onClick={handleReset}
              disabled={loading || !allValid || !passwordMatch}
            >
              {loading && <span className="spinner" />}
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
