"use client";

import "./reset-password-page.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailIcon } from "../components/icons";
import AuthMarketingNav from "../components/AuthMarketingNav";
import AuthPageChrome from "../components/AuthPageChrome";

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  async function handleSendOTP() {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
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
        if (data?.expiresAt) {
          sessionStorage.setItem("resetOtpExpiresAt", data.expiresAt);
        } else {
          sessionStorage.removeItem("resetOtpExpiresAt");
        }
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
<AuthPageChrome header={<AuthMarketingNav />} blobCount={2}>
        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <div className="icon-wrap">
              <MailIcon />
            </div>

            <h1 className="card-title">Reset Password</h1>
            <p className="card-desc">
              Enter your registered email address.
              <br />
              If the account is valid, you will receive an <span>OTP</span> that
              allows you to reset your password.
            </p>

            <label className={`field-label ${focused ? "focused" : ""}`}>
              Email Address
            </label>
            <input
              className="field-input"
              type="email"
              placeholder="enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
            />

            {error && <div className="error-msg">{error}</div>}

            <button
              className="btn-send"
              onClick={handleSendOTP}
              disabled={loading}
            >
              {loading && <span className="spinner" />}
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>

            <button className="back-link" onClick={() => router.push("/")}>
              ← Back to Login
            </button>
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
