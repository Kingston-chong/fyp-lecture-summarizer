"use client";

import "./login-page.css";
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
        const raw = String(result.error);
        const looksLikeDbOrNetwork =
          /prisma|turbopack|can't reach database|P1001|P1002|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(
            raw,
          );
        setError(
          looksLikeDbOrNetwork
            ? "We couldn't connect. Check your internet connection and try again."
            : raw,
        );
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
<main className="main">
          <div className="card">
            <div className="card-top-glow" />
            {showAuthLoading ? (
              <div className="auth-loading">
                <div className="auth-spinner" />
                <p className="auth-loading-text">
                  {status === "authenticated"
                    ? "Redirecting to dashboard..."
                    : "Checking session..."}
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
                  <label
                    className={`field-label ${emailFocused ? "focused" : ""}`}
                  >
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
                  <label
                    className={`field-label ${passFocused ? "focused" : ""}`}
                  >
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
                  onClick={() =>
                    signIn("google", { callbackUrl: "/dashboard" })
                  }
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="card-footer">
                  <Link href="/register" className="footer-link cta">
                    New? Register an account
                  </Link>
                  <button
                    className="footer-link"
                    onClick={() => router.push("/reset-password")}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
