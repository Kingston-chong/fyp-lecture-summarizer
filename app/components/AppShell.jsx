"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { ChevronDownIcon, LogoIcon, LogoutIcon, MenuIcon } from "./icons";

export default function AppShell({
  children,
  showBackToDashboard = false,
  showSidebar = false,
  /** When true, sidebar is only off-canvas + hamburger (no permanent column). Use on dashboard. */
  sidebarMobileOnly = false,
  hidePrevUploads = false,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      if (!mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  /** Lock scroll when mobile drawer is open (shell/body scroll was moving content under fixed layers). */
  useEffect(() => {
    if (!showSidebar || !mobileNavOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [showSidebar, mobileNavOpen]);

  return (
    <>
      <style>{`
        html, body { height: 100%; }

        .shell {
          --chrome-nav-h: 58px;
          --chrome-subnav-h: 40px;
          --chrome-h: calc(var(--chrome-nav-h) + var(--chrome-subnav-h));
          --shell-sidebar-w: 260px;
          --shell-chrome-top: calc(var(--chrome-h) + env(safe-area-inset-top, 0px));
          min-height: 100vh;
          background: var(--app-bg);
          font-family: 'Sora', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .shell-blobs { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .blob1 { position: absolute; top: -10%; right: -5%; width: 520px; height: 520px; background: var(--app-blob-1); }
        .blob2 { position: absolute; bottom: -10%; left: 10%; width: 420px; height: 420px; background: var(--app-blob-2); }

        .shell-nav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: var(--chrome-nav-h);
          background: var(--app-nav-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--app-border); }
        .shell-brand { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
        .shell-badge { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
        .shell-name { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; background: var(--app-brand-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .shell-right { display: flex; align-items: center; gap: 10px; }
        .shell-greet { font-size: 12px; color: var(--app-greet); }
        .shell-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--app-btn-border);
          background: var(--app-btn-bg); display: flex; align-items: center; gap: 6px; cursor: pointer;
          font-family: 'Sora', sans-serif; font-size: 12px; color: var(--app-btn-text); transition: all 0.2s; }
        .shell-btn:hover { border-color: var(--app-btn-hover-border); color: var(--app-btn-hover-text); }

        .shell-subnav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: flex-end; padding: 0 28px; height: var(--chrome-subnav-h);
          background: var(--app-subnav-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--app-border); }
        .shell-subitem { display: flex; align-items: center; gap: 4px; padding: 0 14px; height: var(--chrome-subnav-h);
          font-size: 12px; color: var(--app-subnav-item); cursor: pointer; border: none; background: none; font-family: 'Sora', sans-serif; transition: color 0.2s; }
        .shell-subitem:hover { color: var(--app-subnav-item-hover); }

        /* No z-index here — it created a stacking context so the fixed drawer painted *below* the scrim */
        .shell-content { position: relative; height: calc(100vh - var(--chrome-h)); display: flex; overflow: hidden; }
        .shell-main { flex: 1; min-width: 0; height: 100%; }

        .shell-nav-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .shell-menu-btn {
          display: none;
          flex-shrink: 0;
          position: relative;
          z-index: 21;
          width: 44px; height: 44px; margin: 0 -8px 0 -12px;
          padding: 0;
          align-items: center; justify-content: center;
          border: none; border-radius: 10px;
          background: transparent;
          color: var(--app-text);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .shell-menu-btn svg {
          display: block;
          flex-shrink: 0;
        }
        .shell-menu-btn:hover {
          background: var(--app-btn-bg);
          color: var(--app-text);
        }

        .shell-sidebar-wrap {
          height: 100%;
          flex-shrink: 0;
          position: relative;
        }

        /* Dashboard: drawer only, never a fixed column on wide screens */
        .shell-sidebar-wrap.sidebar-always-drawer {
          position: fixed;
          top: var(--shell-chrome-top);
          left: 0;
          bottom: 0;
          width: min(88vw, var(--shell-sidebar-w));
          max-width: 100%;
          z-index: 120;
          height: auto;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--app-drawer-shadow);
          pointer-events: auto;
          isolation: isolate;
          background: var(--app-sidebar-bg);
          overflow-x: hidden;
        }
        .shell-sidebar-wrap.sidebar-always-drawer.is-open {
          transform: translateX(0);
        }
        @media (min-width: 1024px) {
          .shell-sidebar-wrap.sidebar-always-drawer:not(.is-open) {
            visibility: hidden;
            pointer-events: none;
          }
        }

        .shell-scrim {
          display: none;
        }

        /* Narrow screens: hamburger, drawer sidebar, scroll-friendly main */
        @media (max-width: 1023px) {
          .shell-menu-btn { display: flex; }
          /* Pin nav + subnav while the page scrolls */
          .shell-chrome {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 40;
            padding-top: env(safe-area-inset-top, 0px);
            background: var(--app-shell-chrome-mobile);
          }
          .shell {
            overflow: auto;
            padding-top: var(--shell-chrome-top);
          }
          .shell.shell--menu-open {
            overflow: hidden;
            overscroll-behavior: none;
          }
          .shell-content {
            height: auto;
            min-height: calc(100vh - var(--chrome-h));
            overflow: visible;
          }
          .shell-main {
            height: auto;
          }
          .shell-sidebar-wrap:not(.sidebar-always-drawer) {
            position: fixed;
            top: var(--shell-chrome-top);
            left: 0;
            bottom: 0;
            width: min(88vw, var(--shell-sidebar-w));
            max-width: 100%;
            z-index: 120;
            transform: translateX(-100%);
            transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: var(--app-drawer-shadow);
            background: var(--app-sidebar-bg);
            isolation: isolate;
            overflow-x: hidden;
          }
          .shell-sidebar-wrap:not(.sidebar-always-drawer).is-open {
            transform: translateX(0);
          }
          /* Blur/dim sits *under* the drawer (z-index 120); menu stays sharp */
          .shell-scrim.is-visible {
            display: block;
            position: fixed;
            left: 0; right: 0;
            top: var(--shell-chrome-top);
            bottom: 0;
            z-index: 110;
            background: var(--app-scrim);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: none;
            padding: 0;
            margin: 0;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }
        }

        @media (min-width: 1024px) {
          .shell-menu-btn { display: none !important; }
        }
      `}</style>

      <div
        className={`shell${showSidebar && mobileNavOpen ? " shell--menu-open" : ""}`}
      >
        <div className="shell-blobs">
          <div className="blob1" />
          <div className="blob2" />
        </div>

        <div className="shell-chrome">
          <nav className="shell-nav">
            <div className="shell-nav-left">
              {showSidebar && (
                <button
                  type="button"
                  className="shell-menu-btn"
                  aria-label="Open history and uploads menu"
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen((v) => !v)}
                >
                  <MenuIcon />
                </button>
              )}
              <div className="shell-brand" onClick={() => router.push("/dashboard")}>
                <div className="shell-badge">
                  <LogoIcon />
                </div>
                <span className="shell-name">Slide2Notes</span>
              </div>
            </div>

            <div className="shell-right">
              <ThemeToggle />
              {session?.user?.name && (
                <span className="shell-greet">Hi, {session.user.name.split(" ")[0]}</span>
              )}
              {showBackToDashboard && (
                <button className="shell-btn" onClick={() => router.push("/dashboard")}>
                  ← Dashboard
                </button>
              )}
              <button className="shell-btn" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogoutIcon /> Sign out
              </button>
            </div>
          </nav>

          <div className="shell-subnav">
            <button className="shell-subitem" type="button">
              Text 1 <ChevronDownIcon />
            </button>
            <button className="shell-subitem" type="button">
              Text 2 <ChevronDownIcon />
            </button>
          </div>
        </div>

        <div className="shell-content">
          {showSidebar && (
            <div
              className={`shell-sidebar-wrap ${mobileNavOpen ? "is-open" : ""}${
                sidebarMobileOnly ? " sidebar-always-drawer" : ""
              }`}
            >
              <AppSidebar hidePrevUploads={hidePrevUploads} />
            </div>
          )}
          <div className="shell-main">{children}</div>
        </div>

        {showSidebar && (
          <button
            type="button"
            className={`shell-scrim ${mobileNavOpen ? "is-visible" : ""}`}
            aria-label="Close menu"
            tabIndex={mobileNavOpen ? 0 : -1}
            onClick={() => setMobileNavOpen(false)}
          />
        )}
      </div>
    </>
  );
}

