"use client";

import "./register-page.css";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "../components/icons";
import AuthMarketingNav from "../components/AuthMarketingNav";
import AuthPageChrome from "../components/AuthPageChrome";

const CheckCircle = ({ met }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      color: met ? "#34d399" : "rgba(255,255,255,0.2)",
      transition: "color 0.25s",
      flexShrink: 0,
    }}
  >
    <circle cx="12" cy="12" r="10" />
    {met && <polyline points="9 12 11 14 15 10" />}
    {!met && <line x1="12" y1="8" x2="12" y2="12" />}
  </svg>
);

const ROLES = ["Student", "Lecturer", "Rather not say"];

export default function Slide2NotesRegister() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [focused, setFocused] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    // Show a clear message instead of silently blocking.
    if (
      !form.email ||
      !form.username ||
      !role ||
      !form.password ||
      !form.confirm
    ) {
      setError(
        "Please fill in all fields (email, password, confirm password, username, and role).",
      );
      return;
    }
    if (!allRulesMet) {
      setError(
        "Password must be at least 8 characters and include at least one letter and one symbol.",
      );
      return;
    }
    if (!passwordMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        username: form.username,
        password: form.password,
        confirm: form.confirm,
        role,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      const loginResult = await signIn("credentials", {
        redirect: false,
        email: form.email,
        password: form.password,
        callbackUrl: "/dashboard",
      });

      if (loginResult?.error) {
        setError(
          "Account created, but automatic sign in failed. Please sign in manually.",
        );
        router.push("/login");
        return;
      }

      router.replace("/dashboard");
    } else {
      setError(data.error);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const rules = useMemo(
    () => ({
      length: form.password.length >= 8,
      symbol: /[^a-zA-Z0-9]/.test(form.password),
      alpha: /[a-zA-Z]/.test(form.password),
    }),
    [form.password],
  );

  const allRulesMet = rules.length && rules.symbol && rules.alpha;
  const passwordMatch =
    form.password && form.confirm && form.password === form.confirm;
  const canSubmit =
    !loading &&
    Boolean(
      form.email && form.username && role && form.password && form.confirm,
    ) &&
    allRulesMet &&
    passwordMatch;

  return (
    <>
      <AuthPageChrome header={<AuthMarketingNav />} blobCount={3}>
        <main className="auth-reg-page">
          <div className="auth-reg-card">
            <div className="auth-reg-card-glow" />

            <p className="auth-reg-eyebrow">Get started</p>
            <h1 className="auth-reg-title">
              Register New Account — <em>Slide2Notes</em>
            </h1>
            <p className="auth-reg-sub">
              Already have an account?{" "}
              <Link href="/login">Sign in instead</Link>
            </p>

            <div className="auth-reg-grid">
              {/* Email */}
              <div className="auth-reg-field">
                <label
                  className={`auth-reg-label ${focused === "email" ? "focused" : ""}`}
                >
                  Email Address
                </label>
                <div className="auth-reg-field-wrap">
                  <input
                    className="auth-reg-input"
                    type="email"
                    placeholder="ex: example@gmail.com"
                    value={form.email}
                    onChange={set("email")}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused("")}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-reg-field">
                <label
                  className={`auth-reg-label ${focused === "password" ? "focused" : ""}`}
                >
                  Password
                </label>
                <div className="auth-reg-field-wrap">
                  <input
                    className={`auth-reg-input with-icon ${form.password && allRulesMet ? "match" : ""}`}
                    type={showPass ? "text" : "password"}
                    placeholder="Enter a strong password"
                    value={form.password}
                    onChange={set("password")}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused("")}
                  />
                  <button
                    className="auth-reg-toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              {/* Rules panel */}
              <div className="auth-reg-rules">
                <p className="auth-reg-rules-title">Password requirements</p>
                <div className="auth-reg-rule-row">
                  <CheckCircle met={rules.length} />
                  <span
                    className={`auth-reg-rule-text ${rules.length ? "met" : "unmet"}`}
                  >
                    More than 8 characters
                  </span>
                </div>
                <div className="auth-reg-rule-row">
                  <CheckCircle met={rules.symbol} />
                  <span
                    className={`auth-reg-rule-text ${rules.symbol ? "met" : "unmet"}`}
                  >
                    Symbol used
                  </span>
                </div>
                <div className="auth-reg-rule-row">
                  <CheckCircle met={rules.alpha} />
                  <span
                    className={`auth-reg-rule-text ${rules.alpha ? "met" : "unmet"}`}
                  >
                    Alphabets used
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="auth-reg-divider" />

              {/* Username */}
              <div className="auth-reg-field">
                <label
                  className={`auth-reg-label ${focused === "username" ? "focused" : ""}`}
                >
                  Username
                </label>
                <div className="auth-reg-field-wrap">
                  <input
                    className="auth-reg-input"
                    type="text"
                    placeholder="ex: james123"
                    value={form.username}
                    onChange={set("username")}
                    onFocus={() => setFocused("username")}
                    onBlur={() => setFocused("")}
                  />
                </div>
              </div>

              {/* Confirm password */}
              <div className="auth-reg-field">
                <label
                  className={`auth-reg-label ${focused === "confirm" ? "focused" : ""}`}
                >
                  Confirm Password
                </label>
                <div className="auth-reg-field-wrap">
                  <input
                    className={`auth-reg-input with-icon ${form.confirm ? (passwordMatch ? "match" : "mismatch") : ""}`}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={set("confirm")}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused("")}
                  />
                  <button
                    className="auth-reg-toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="auth-reg-field" style={{ position: "relative" }}>
                <label
                  className={`auth-reg-label ${focused === "role" ? "focused" : ""}`}
                >
                  Role
                </label>
                <div className="auth-reg-dropdown-wrap">
                  <button
                    className={`auth-reg-dropdown-btn ${dropOpen ? "open" : ""}`}
                    onClick={() => {
                      setDropOpen((v) => !v);
                      setFocused("role");
                    }}
                    onBlur={() => {
                      setTimeout(() => setDropOpen(false), 150);
                      setFocused("");
                    }}
                    style={{
                      color: role ? "#dcdcf0" : "rgba(255,255,255,0.16)",
                    }}
                  >
                    <span>{role || "Select role…"}</span>
                    <span className="chev">
                      <ChevronDownIcon />
                    </span>
                  </button>
                  {dropOpen && (
                    <div className="auth-reg-dropdown-menu">
                      {ROLES.map((r) => (
                        <div
                          key={r}
                          className={`auth-reg-dropdown-option ${role === r ? "selected" : ""}`}
                          onMouseDown={() => {
                            setRole(r);
                            setDropOpen(false);
                          }}
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="auth-reg-footer">
              {error && (
                <p
                  style={{
                    color: "#f87171",
                    fontSize: "12px",
                    textAlign: "center",
                    marginTop: "8px",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Update the button */}
              <button
                className="auth-reg-submit"
                onClick={handleSignUp}
                disabled={loading}
              >
                {loading ? "Signing up..." : "Sign Up"}
              </button>
            </div>
          </div>
        </main>
      </AuthPageChrome>
    </>
  );
}
