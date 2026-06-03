"use client";

import "./login-page.css";
import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EyeIcon, EyeOffIcon, GoogleIcon } from "@/app/components/icons";
import AuthMarketingNav from "@/app/components/AuthMarketingNav";
import AuthPageChrome from "@/app/components/AuthPageChrome";

export default function Slide2NotesLogin() {
  const router = useRouter();
  const { status } = useSession();
  const showRedirecting = status === "authenticated";
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
      <AuthPageChrome header={<AuthMarketingNav />} blobCount={3}>
        <main className="auth-login-page">
          <div className="auth-login-card">
            <div className="auth-login-card-glow" />
            {showRedirecting ? (
              <div className="auth-login-loading">
                <div className="auth-login-spinner" />
                <p className="auth-login-loading-text">Redirecting to dashboard...</p>
              </div>
            ) : (
              <>
                <p className="auth-login-eyebrow">Welcome back</p>
                <h1 className="auth-login-title">
                  Login to <em>Slide2Notes</em>
                </h1>

                {/* Email */}
                <div className="auth-login-field">
                  <label
                    className={`auth-login-label ${emailFocused ? "focused" : ""}`}
                  >
                    Email address
                  </label>
                  <div className="auth-login-field-wrap">
                    <input
                      className="auth-login-input"
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
                <div className="auth-login-field">
                  <label
                    className={`auth-login-label ${passFocused ? "focused" : ""}`}
                  >
                    Password
                  </label>
                  <div className="auth-login-field-wrap">
                    <input
                      className="auth-login-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                    />
                    <button
                      className="auth-login-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                  </div>
                </div>

                <button
                  className="auth-login-submit"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                {error && <p className="auth-login-error">{error}</p>}

                <div className="auth-login-or">
                  <div className="auth-login-or-line" />
                  <span className="auth-login-or-text">or</span>
                  <div className="auth-login-or-line" />
                </div>

                <button
                  className="auth-login-google"
                  onClick={() =>
                    signIn("google", { callbackUrl: "/dashboard" })
                  }
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="auth-login-footer">
                  <Link href="/register" className="auth-login-footer-link cta">
                    New? Register an account
                  </Link>
                  <button
                    className="auth-login-footer-link"
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
