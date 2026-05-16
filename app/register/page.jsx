"use client";

import { useState, useMemo } from "react";
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
      <style>{`
        .main { position: relative; z-index: 5; display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 102px); padding: 48px 24px; }

        /* CARD */
        .card {
          width: 100%; max-width: 760px; position: relative;
          background: rgba(20,20,28,0.9);
          border: 1px solid rgba(255,255,255,0.075);
          border-radius: 22px;
          padding: 40px 44px 40px;
          backdrop-filter: blur(24px);
          box-shadow: 0 0 0 1px rgba(99,102,241,0.08), 0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardIn 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .card-glow { position: absolute; top: 0; left: 15%; right: 15%; height: 1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.55), rgba(99,102,241,0.55), transparent); border-radius: 999px; }

        /* HEADER */
        .card-eyebrow { font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #7c7cf8; margin-bottom: 4px; }
        .card-title { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; color: #eeeef8; letter-spacing: -0.025em; line-height: 1.2; margin-bottom: 6px; }
        .card-title em { font-style: italic; font-weight: 300; color: #a5b4fc; }
        .card-sub { font-size: 12.5px; color: #52526e; margin-bottom: 32px; letter-spacing: 0.01em; }
        .card-sub a { color: #8080f8; text-decoration: none; font-weight: 500; }
        .card-sub a:hover { color: #b0b0ff; }

        /* GRID */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px 28px; align-items: start; }

        /* FIELD */
        .field-group { display: flex; flex-direction: column; gap: 7px; }
        .field-group.span2 { grid-column: span 2; }
        .field-label { font-size: 11.5px; font-weight: 500; color: #60607a; letter-spacing: 0.06em; text-transform: uppercase; transition: color 0.2s; }
        .field-label.focused { color: #9090d8; }
        .field-wrapper { position: relative; }
        .field-input {
          width: 100%; height: 44px; padding: 0 14px;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 300; color: #dcdcf0;
          outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .field-input.with-icon { padding-right: 44px; }
        .field-input::placeholder { color: rgba(255,255,255,0.16); }
        .field-input:focus { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.055); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .field-input.match { border-color: rgba(52,211,153,0.4); }
        .field-input.mismatch { border-color: rgba(251,113,133,0.4); }
        .field-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.18); cursor: pointer; background: none; border: none; display: flex; align-items: center; padding: 4px; border-radius: 5px; transition: color 0.2s; }
        .field-toggle:hover { color: rgba(255,255,255,0.45); }

        /* DROPDOWN */
        .dropdown-wrapper { position: relative; }
        .dropdown-btn {
          width: 100%; height: 44px; padding: 0 14px;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.035);
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 300;
          color: #dcdcf0;
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .dropdown-btn:focus, .dropdown-btn.open { border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.055); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .dropdown-btn .chev { color: rgba(255,255,255,0.25); transition: transform 0.2s; }
        .dropdown-btn.open .chev { transform: rotate(180deg); }
        .dropdown-menu {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 50;
          background: rgba(26,26,36,0.97); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 4px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          animation: menuIn 0.15s ease both;
        }
        @keyframes menuIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .dropdown-option { padding: 9px 12px; border-radius: 7px; font-size: 13px; color: #b0b0cc; cursor: pointer; transition: background 0.15s, color 0.15s; }
        .dropdown-option:hover { background: rgba(99,102,241,0.15); color: #e0e0f8; }
        .dropdown-option.selected { background: rgba(99,102,241,0.2); color: #a5b4fc; font-weight: 500; }

        /* PASSWORD RULES */
        .rules-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
        .rules-title { font-size: 11px; font-weight: 600; color: #7878a0; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
        .rule-row { display: flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 300; }
        .rule-text { transition: color 0.25s; }
        .rule-text.met { color: #a7f3d0; }
        .rule-text.unmet { color: rgba(255,255,255,0.3); }

        /* SUBMIT */
        .form-footer { margin-top: 28px; display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
        .btn-cancel { height: 44px; padding: 0 24px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: transparent; font-family: 'Sora', sans-serif; font-size: 13.5px; color: #6060808; color: rgba(255,255,255,0.3); cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em; }
        .btn-cancel:hover { border-color: rgba(255,255,255,0.16); color: rgba(255,255,255,0.6); }
        .btn-signup { height: 44px; padding: 0 36px; border-radius: 10px; border: none; background: linear-gradient(135deg, #5f60f0 0%, #8b5cf6 100%); font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; letter-spacing: 0.025em; position: relative; overflow: hidden; transition: transform 0.15s, box-shadow 0.2s; box-shadow: 0 4px 18px rgba(99,102,241,0.38); }
        .btn-signup::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%); opacity: 0; transition: opacity 0.2s; }
        .btn-signup:hover { transform: translateY(-1.5px); box-shadow: 0 8px 24px rgba(99,102,241,0.52); }
        .btn-signup:hover::after { opacity: 1; }
        .btn-signup:active { transform: translateY(0); }

        /* DIVIDER */
        .section-divider { grid-column: 1 / -1; height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0; }

        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
          .field-group.span2 { grid-column: span 1; }
          .card { padding: 28px 24px; }
        }
      `}</style>

      <AuthPageChrome header={<AuthMarketingNav />} blobCount={3}>
        <main className="main">
          <div className="card">
            <div className="card-glow" />

            <p className="card-eyebrow">Get started</p>
            <h1 className="card-title">
              Register New Account — <em>Slide2Notes</em>
            </h1>
            <p className="card-sub">
              Already have an account? <a href="#">Sign in instead</a>
            </p>

            <div className="form-grid">
              {/* Email */}
              <div className="field-group">
                <label
                  className={`field-label ${focused === "email" ? "focused" : ""}`}
                >
                  Email Address
                </label>
                <div className="field-wrapper">
                  <input
                    className="field-input"
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
              <div className="field-group">
                <label
                  className={`field-label ${focused === "password" ? "focused" : ""}`}
                >
                  Password
                </label>
                <div className="field-wrapper">
                  <input
                    className={`field-input with-icon ${form.password && allRulesMet ? "match" : ""}`}
                    type={showPass ? "text" : "password"}
                    placeholder="Enter a strong password"
                    value={form.password}
                    onChange={set("password")}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused("")}
                  />
                  <button
                    className="field-toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              {/* Rules panel */}
              <div className="rules-panel">
                <p className="rules-title">Password requirements</p>
                <div className="rule-row">
                  <CheckCircle met={rules.length} />
                  <span
                    className={`rule-text ${rules.length ? "met" : "unmet"}`}
                  >
                    More than 8 characters
                  </span>
                </div>
                <div className="rule-row">
                  <CheckCircle met={rules.symbol} />
                  <span
                    className={`rule-text ${rules.symbol ? "met" : "unmet"}`}
                  >
                    Symbol used
                  </span>
                </div>
                <div className="rule-row">
                  <CheckCircle met={rules.alpha} />
                  <span
                    className={`rule-text ${rules.alpha ? "met" : "unmet"}`}
                  >
                    Alphabets used
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="section-divider" />

              {/* Username */}
              <div className="field-group">
                <label
                  className={`field-label ${focused === "username" ? "focused" : ""}`}
                >
                  Username
                </label>
                <div className="field-wrapper">
                  <input
                    className="field-input"
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
              <div className="field-group">
                <label
                  className={`field-label ${focused === "confirm" ? "focused" : ""}`}
                >
                  Confirm Password
                </label>
                <div className="field-wrapper">
                  <input
                    className={`field-input with-icon ${form.confirm ? (passwordMatch ? "match" : "mismatch") : ""}`}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={set("confirm")}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused("")}
                  />
                  <button
                    className="field-toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="field-group" style={{ position: "relative" }}>
                <label
                  className={`field-label ${focused === "role" ? "focused" : ""}`}
                >
                  Role
                </label>
                <div className="dropdown-wrapper">
                  <button
                    className={`dropdown-btn ${dropOpen ? "open" : ""}`}
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
                    <div className="dropdown-menu">
                      {ROLES.map((r) => (
                        <div
                          key={r}
                          className={`dropdown-option ${role === r ? "selected" : ""}`}
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
            <div className="form-footer">
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
                className="btn-signup"
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
