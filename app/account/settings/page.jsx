"use client";

import "./AccountSettings.css";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

/* ── Tiny helpers ────────────────────────────────────────────────── */

function SectionCard({ title, description, children }) {
  return (
    <div className="as-card">
      <div className="as-card-header">
        <h2 className="as-card-title">{title}</h2>
        {description && <p className="as-card-desc">{description}</p>}
      </div>
      <div className="as-card-body">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="as-field">
      <label className="as-field-label">{label}</label>
      {hint && <p className="as-field-hint">{hint}</p>}
      {children}
    </div>
  );
}

function SaveBtn({ loading, saved, onClick, disabled }) {
  return (
    <button
      className={`as-btn as-btn--primary${saved ? " as-btn--saved" : ""}`}
      onClick={onClick}
      disabled={loading || disabled}
      type="button"
    >
      {loading ? (
        <>
          <span className="as-spinner" />
          Saving…
        </>
      ) : saved ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          Saved
        </>
      ) : (
        "Save changes"
      )}
    </button>
  );
}

function LoadingBlock() {
  return (
    <div className="as-loading">
      <span className="as-spinner" />
      Loading…
    </div>
  );
}

function formatMemberSince(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatRole(role) {
  if (!role) return "—";
  if (role === "RatherNotSay") return "Rather not say";
  return role;
}

function useAccountProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/profile");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load profile.");
      }
      setProfile(data.profile ?? null);
    } catch (err) {
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, loading, error, reload, setProfile };
}

/* ── Sections ────────────────────────────────────────────────────── */

function ProfileSection({ profile, profileLoading, profileError, onProfileChange }) {
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile?.username) {
      setUsername(profile.username);
      setSavedUsername(profile.username);
    }
  }, [profile?.username]);

  const handleSave = async () => {
    setError("");
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Username cannot be empty.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 32) {
      setError("Username must be 32 characters or fewer.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save.");
      }
      if (data.profile) {
        onProfileChange(data.profile);
        setSavedUsername(data.profile.username);
        setUsername(data.profile.username);
      }
      await update({ name: trimmed, username: trimmed });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) return <LoadingBlock />;
  if (profileError && !profile) {
    return <p className="as-error">{profileError}</p>;
  }

  const unchanged = username.trim() === savedUsername;

  return (
    <SectionCard
      title="Profile"
      description="Your username is shown in the app header and across Slide2Notes."
    >
      <Field
        label="Username"
        hint="Letters, numbers, dots, underscores, and hyphens only (2–32 characters)."
      >
        <input
          className="as-input"
          type="text"
          value={username}
          maxLength={32}
          onChange={(e) => {
            setUsername(e.target.value);
            setSaved(false);
          }}
          placeholder="Your username"
        />
      </Field>
      <Field
        label="Email address"
        hint="Your email cannot be changed here. Contact support if you need to update it."
      >
        <input
          className="as-input as-input--disabled"
          type="email"
          value={profile?.email ?? ""}
          readOnly
          disabled
        />
      </Field>
      <Field label="Role">
        <input
          className="as-input as-input--disabled"
          type="text"
          value={formatRole(profile?.role)}
          readOnly
          disabled
        />
      </Field>
      <Field label="Member since">
        <input
          className="as-input as-input--disabled"
          type="text"
          value={formatMemberSince(profile?.createdAt)}
          readOnly
          disabled
        />
      </Field>
      <Field label="Sign-in method">
        <input
          className="as-input as-input--disabled"
          type="text"
          value={
            profile?.authProvider === "google"
              ? "Google"
              : "Email and password"
          }
          readOnly
          disabled
        />
      </Field>
      {error && <p className="as-error">{error}</p>}
      <div className="as-actions">
        <SaveBtn
          loading={loading}
          saved={saved}
          disabled={unchanged}
          onClick={handleSave}
        />
      </div>
    </SectionCard>
  );
}

function PasswordSection({ profile, profileLoading }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const strength = (() => {
    if (!next) return 0;
    let s = 0;
    if (next.length >= 8) s++;
    if (/[a-z]/.test(next) && /[A-Z]/.test(next)) s++;
    if (/\d/.test(next)) s++;
    if (/[^a-zA-Z0-9]/.test(next)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthClass = [
    "",
    "as-strength--weak",
    "as-strength--fair",
    "as-strength--good",
    "as-strength--strong",
  ][strength];

  const handleSave = async () => {
    setError("");
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(next)) {
      setError("Password must include at least one letter.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(next)) {
      setError("Password must include at least one special character.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to change password.");
      }
      setSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) return <LoadingBlock />;

  if (profile?.authProvider === "google") {
    return (
      <SectionCard
        title="Password"
        description="Accounts created with Google do not use a Slide2Notes password."
      >
        <p className="as-info-box">
          You sign in with <strong>Google</strong>. To add a password for email
          sign-in, use{" "}
          <Link href="/reset-password" className="as-link">
            Forgot password
          </Link>{" "}
          with the same email address as your Google account.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Password"
      description="Use a strong password with letters, numbers, and special characters."
    >
      <p className="as-field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        <Link href="/reset-password" className="as-link">
          Forgot your password?
        </Link>
      </p>
      <Field label="Current password">
        <div className="as-input-wrap">
          <input
            className="as-input"
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setSaved(false);
            }}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <button
            type="button"
            className="as-input-eye"
            aria-label={showCurrent ? "Hide password" : "Show password"}
            onClick={() => setShowCurrent((v) => !v)}
          >
            {showCurrent ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </Field>
      <Field label="New password">
        <div className="as-input-wrap">
          <input
            className="as-input"
            type={showNew ? "text" : "password"}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setSaved(false);
            }}
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <button
            type="button"
            className="as-input-eye"
            aria-label={showNew ? "Hide password" : "Show password"}
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        {next && (
          <div className="as-strength-wrap">
            <div className={`as-strength-bar ${strengthClass}`}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`as-strength-seg${strength >= i ? " filled" : ""}`}
                />
              ))}
            </div>
            <span className={`as-strength-label ${strengthClass}`}>
              {strengthLabel}
            </span>
          </div>
        )}
      </Field>
      <Field label="Confirm new password">
        <input
          className={`as-input${confirm && confirm !== next ? " as-input--error" : ""}`}
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setSaved(false);
          }}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        {confirm && confirm !== next && (
          <p className="as-field-error">Passwords do not match.</p>
        )}
      </Field>
      {error && <p className="as-error">{error}</p>}
      <div className="as-actions">
        <SaveBtn loading={loading} saved={saved} onClick={handleSave} />
      </div>
    </SectionCard>
  );
}

function DangerSection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const CONFIRM_PHRASE = "delete my account";

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== CONFIRM_PHRASE) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete account.");
      }
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Danger zone">
      <div className="as-danger-row">
        <div>
          <p className="as-danger-label">Delete account</p>
          <p className="as-danger-desc">
            Permanently removes your account, all documents, summaries, quizzes,
            and flashcards. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          className="as-btn as-btn--danger-outline"
          onClick={() => setDeleteOpen(true)}
          disabled={loading}
        >
          Delete account
        </button>
      </div>

      {deleteOpen && (
        <div
          className="as-delete-modal-backdrop"
          onClick={() => !loading && setDeleteOpen(false)}
        >
          <div className="as-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="as-delete-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            <h3 className="as-delete-modal-title">Delete your account?</h3>
            <p className="as-delete-modal-body">
              All your data — documents, summaries, quizzes, and flashcards —
              will be <strong>permanently deleted</strong> and cannot be recovered.
            </p>
            <p className="as-delete-modal-body">
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm.
            </p>
            <input
              className={`as-input${confirmText && confirmText.toLowerCase() !== CONFIRM_PHRASE ? " as-input--error" : ""}`}
              type="text"
              placeholder={CONFIRM_PHRASE}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={loading}
            />
            {error && <p className="as-error">{error}</p>}
            <div className="as-delete-modal-actions">
              <button
                type="button"
                className="as-btn as-btn--ghost"
                onClick={() => {
                  setDeleteOpen(false);
                  setConfirmText("");
                  setError("");
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="as-btn as-btn--danger"
                onClick={handleDelete}
                disabled={
                  loading || confirmText.toLowerCase() !== CONFIRM_PHRASE
                }
              >
                {loading ? (
                  <>
                    <span className="as-spinner" /> Deleting…
                  </>
                ) : (
                  "Permanently delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { profile, loading, error, setProfile } = useAccountProfile();

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "danger", label: "Danger zone" },
  ];

  return (
    <div className="as-page">
      <div className="as-page-inner">
        <div className="as-page-head">
          <h1 className="as-page-title">Account settings</h1>
          <p className="as-page-subtitle">
            Manage your profile and security.
          </p>
        </div>

        <div className="as-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`as-tab${activeTab === t.id ? " as-tab--active" : ""}${t.id === "danger" ? " as-tab--danger" : ""}`}
              onClick={() => setActiveTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="as-content">
          {activeTab === "profile" && (
            <ProfileSection
              profile={profile}
              profileLoading={loading}
              profileError={error}
              onProfileChange={setProfile}
            />
          )}
          {activeTab === "security" && (
            <PasswordSection profile={profile} profileLoading={loading} />
          )}
          {activeTab === "danger" && <DangerSection />}
        </div>
      </div>
    </div>
  );
}
