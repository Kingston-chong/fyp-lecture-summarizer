"use client";


import "./AuthPageChrome.module.css";
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
    subnav === false
      ? null
      : subnav === undefined
        ? <AuthSubnavPlaceholder variant={themed ? "themed" : "dark"} />
        : subnav;

  return (
    <>
      
      <div className="auth-chrome-root">
        {blobCount >= 1 ? <div className="auth-chrome-blob1" aria-hidden /> : null}
        {blobCount >= 2 ? <div className="auth-chrome-blob2" aria-hidden /> : null}
        {blobCount >= 3 ? <div className="auth-chrome-blob3" aria-hidden /> : null}
        {header}
        {showSubnav ? subnavNode : null}
        {children}
      </div>
    </>
  );
}
