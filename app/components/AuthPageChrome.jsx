"use client";

import { ChevronDownIcon } from "./icons";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');`;

/**
 * Placeholder subnav row matching legacy auth pages (Text 1 / Text 2).
 * @param {"dark" | "themed"} variant — themed uses CSS variables for light/dark.
 */
export function AuthSubnavPlaceholder({ variant = "dark" }) {
  const themed = variant === "themed";
  return (
    <>
      <style>{`
        .auth-chrome-subnav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 36px;
          height: 42px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-bottom: 1px solid ${themed ? "var(--app-border)" : "rgba(255,255,255,0.035)"};
          background: ${themed ? "var(--app-subnav-bg)" : "rgba(16,16,22,0.75)"};
        }
        .auth-chrome-subnav-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 16px;
          height: 42px;
          font-size: 12.5px;
          font-family: "Sora", sans-serif;
          font-weight: 400;
          color: ${themed ? "var(--app-subnav-item)" : "#52526e"};
          cursor: pointer;
          border: none;
          background: none;
          transition: color 0.2s;
          letter-spacing: 0.025em;
        }
        .auth-chrome-subnav-item:hover {
          color: ${themed ? "var(--app-subnav-item-hover)" : "#9090b8"};
        }
      `}</style>
      <div className="auth-chrome-subnav">
        <button type="button" className="auth-chrome-subnav-item">
          Text 1 <ChevronDownIcon />
        </button>
        <button type="button" className="auth-chrome-subnav-item">
          Text 2 <ChevronDownIcon />
        </button>
      </div>
    </>
  );
}

/**
 * Shared auth shell: fonts, reset, background, decorative blobs, optional header + subnav.
 * @param {"dark" | "themed"} shell — dark uses #0e0e12; themed uses --app-bg (login).
 * @param {number} blobCount — 0 none, 1–3 blobs.
 * @param {boolean} centerContent — flex-center children (e.g. success screen).
 * @param {React.ReactNode|false|undefined} subnav — undefined: default placeholder; false: hide.
 */
export default function AuthPageChrome({
  children,
  header = null,
  subnav,
  shell = "dark",
  blobCount = 2,
  centerContent = false,
  includeFontImport = true,
}) {
  const themed = shell === "themed";
  const shellCss = themed
    ? `
    body { background: var(--app-bg); }
    .auth-chrome-root {
      min-height: 100vh;
      background: var(--app-bg);
      font-family: 'Sora', sans-serif;
      position: relative;
      overflow: hidden;
      ${centerContent ? "display: flex; align-items: center; justify-content: center;" : ""}
    }
  `
    : `
    body { background: #0e0e12; }
    .auth-chrome-root {
      min-height: 100vh;
      background: #0e0e12;
      font-family: 'Sora', sans-serif;
      position: relative;
      overflow: hidden;
      ${centerContent ? "display: flex; align-items: center; justify-content: center;" : ""}
    }
  `;

  const showSubnav = subnav !== false;
  const subnavNode =
    subnav === false ? null : subnav === undefined ? (
      <AuthSubnavPlaceholder variant={themed ? "themed" : "dark"} />
    ) : (
      subnav
    );

  return (
    <>
      <style>{`
        ${includeFontImport ? FONT_IMPORT : ""}
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ${shellCss}
        .auth-chrome-blob1 {
          position: fixed;
          top: -15%;
          right: -8%;
          width: 650px;
          height: 650px;
          background: radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
        .auth-chrome-blob2 {
          position: fixed;
          bottom: -10%;
          left: -5%;
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
        .auth-chrome-blob3 {
          position: fixed;
          top: 45%;
          left: 38%;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>
      <div className="auth-chrome-root">
        {blobCount >= 1 ? (
          <div className="auth-chrome-blob1" aria-hidden />
        ) : null}
        {blobCount >= 2 ? (
          <div className="auth-chrome-blob2" aria-hidden />
        ) : null}
        {blobCount >= 3 ? (
          <div className="auth-chrome-blob3" aria-hidden />
        ) : null}
        {header}
        {showSubnav ? subnavNode : null}
        {children}
      </div>
    </>
  );
}
