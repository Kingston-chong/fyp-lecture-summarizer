"use client";

import { SlidesIcon, UserCircleIcon } from "./icons";

/**
 * Marketing-style top bar (gradient badge + SlidesIcon) used on register / reset-password flows.
 */
export default function AuthMarketingNav({ right }) {
  const defaultRight = (
    <button type="button" className="auth-mkt-nav-user" aria-label="Account">
      <UserCircleIcon />
    </button>
  );

  return (
    <>
      <style>{`
        .auth-mkt-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 36px;
          height: 60px;
          background: rgba(14, 14, 18, 0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.055);
        }
        .auth-mkt-nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth-mkt-nav-badge {
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
        }
        .auth-mkt-nav-title {
          font-family: "Fraunces", serif;
          font-size: 17px;
          font-weight: 600;
          background: linear-gradient(90deg, #e8e8f0, #a5b4fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }
        .auth-mkt-nav-user {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #8080a0;
          transition: all 0.2s;
        }
        .auth-mkt-nav-user:hover {
          border-color: rgba(99, 102, 241, 0.45);
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
        }
      `}</style>
      <nav className="auth-mkt-nav" aria-label="Top navigation">
        <div className="auth-mkt-nav-brand">
          <div className="auth-mkt-nav-badge">
            <SlidesIcon />
          </div>
          <span className="auth-mkt-nav-title">Slide2Notes</span>
        </div>
        <div>{right ?? defaultRight}</div>
      </nav>
    </>
  );
}
