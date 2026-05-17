"use client";

import "./AppShell.css";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { ArrowLeftIcon, LogoutIcon, MenuIcon } from "./icons";
import AppHeader from "./AppHeader";

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
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    // Close only when the route changes (not when the user opens the drawer).
    if (prev !== pathname && mobileNavOpen) {
      const t = setTimeout(() => setMobileNavOpen(false), 0);
      return () => clearTimeout(t);
    }

    return undefined;
  }, [pathname, mobileNavOpen]);

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
      <div
        className={`shell${showSidebar && mobileNavOpen ? " shell--menu-open" : ""}${
          sidebarMobileOnly ? " shell--dashboard-mobile" : ""
        }`}
      >
        <div className="shell-blobs">
          <div className="blob1" />
          <div className="blob2" />
        </div>

        <div className="shell-chrome">
          <AppHeader
            left={
              showSidebar ? (
                <button
                  type="button"
                  className="shell-menu-btn"
                  aria-label="Open history and uploads menu"
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen((v) => !v)}
                >
                  <MenuIcon />
                </button>
              ) : null
            }
            right={
              <>
                <ThemeToggle />
                {session?.user?.name && (
                  <span className="shell-greet">
                    Hi, {session.user.name.split(" ")[0]}
                  </span>
                )}
                {showBackToDashboard && (
                  <button
                    className="shell-btn"
                    title="Dashboard"
                    onClick={() => router.push("/dashboard")}
                  >
                    <ArrowLeftIcon />{" "}
                    <span className="shell-btn-text">Dashboard</span>
                  </button>
                )}
                <button
                  className="shell-btn"
                  title="Sign out"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogoutIcon />{" "}
                  <span className="shell-btn-text">Sign out</span>
                </button>
              </>
            }
            onLogoClick={() => router.push("/dashboard")}
          />
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
