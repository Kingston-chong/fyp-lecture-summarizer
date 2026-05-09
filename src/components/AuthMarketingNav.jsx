"use client";


import "./AuthMarketingNav.module.css";
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
