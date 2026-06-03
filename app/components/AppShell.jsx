"use client";

import "./AppShell.css";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppSidebar from "./AppSidebar";
import SidebarResizeSplitter from "./SidebarResizeSplitter";
import ThemeToggle from "./ThemeToggle";
import { useLeftSidebarResize } from "@/app/hooks/useLeftSidebarResize";
import { ArrowLeftIcon, ChevRight, LogoutIcon, MenuIcon } from "./icons";
import AppHeader from "./AppHeader";

function UserAvatar({ name, size = 32 }) {
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "?";
  return (
    <span
      className="shell-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export default function AppShell({
  children,
  showBackToDashboard = false,
  showSidebar = false,
  sidebarMobileOnly = false,
  hidePrevUploads = false,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const userMenuRef = useRef(null);
  const prevPathnameRef = useRef(pathname);

  /* ── Close user menu on outside click ─────────────────────────── */
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  /* ── Close sidebar + user menu on route change ─────────────────── */
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;
    if (prev !== pathname) {
      const t = setTimeout(() => {
        if (mobileNavOpen) setMobileNavOpen(false);
        setUserMenuOpen(false);
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pathname, mobileNavOpen]);

  useEffect(() => {
    const query = sidebarMobileOnly
      ? "(max-width: 1319px)"
      : "(max-width: 1023px)";
    const mq = window.matchMedia(query);
    const onChange = () => {
      if (!mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [sidebarMobileOnly]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

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

  const displayName = session?.user?.name ?? session?.user?.username ?? "";
  const role = session?.user?.role ?? "";
  const { sidebarWidth, onSidebarResizeStart } = useLeftSidebarResize(260);
  const sidebarResizable = showSidebar && !sidebarMobileOnly;

  return (
    <>
      <div
        className={`shell${showSidebar && mobileNavOpen ? " shell--menu-open" : ""}${
          sidebarMobileOnly ? " shell--dashboard-mobile" : ""
        }${sidebarResizable && desktopSidebarCollapsed ? " shell--sidebar-collapsed" : ""}`}
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
                {displayName && (
                  <span className="shell-greet">
                    Hi, {displayName.split(" ")[0]}
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

                {/* ── User avatar + dropdown ───────────────────── */}
                <div className="shell-user-menu" ref={userMenuRef}>
                  <button
                    className="shell-user-trigger"
                    aria-label="Open user menu"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    onClick={() => setUserMenuOpen((v) => !v)}
                  >
                    <div className="shell-user-trigger-inner">
                      <UserAvatar name={displayName} />
                      <div className="shell-user-info">
                        <span className="shell-user-name">{displayName}</span>
                        {role && (
                          <span className="shell-user-role">{role}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="shell-dropdown" role="menu">
                      <div className="shell-dropdown-header">
                        <UserAvatar name={displayName} size={36} />
                        <div>
                          <p className="shell-dropdown-name">{displayName}</p>
                          {session?.user?.email && (
                            <p className="shell-dropdown-email">
                              {session.user.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shell-dropdown-divider" />
                      <button
                        className="shell-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/account/settings");
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                        Account settings
                      </button>
                      <div className="shell-dropdown-divider" />
                      <button
                        className="shell-dropdown-item shell-dropdown-item--danger"
                        role="menuitem"
                        onClick={() => signOut({ callbackUrl: "/" })}
                      >
                        <LogoutIcon />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
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
              }${
                sidebarResizable && desktopSidebarCollapsed ? " is-collapsed" : ""
              }`}
              style={
                sidebarResizable
                  ? { "--shell-sidebar-w": `${sidebarWidth}px` }
                  : undefined
              }
            >
              <AppSidebar
                width={sidebarResizable ? sidebarWidth : 260}
                hidePrevUploads={hidePrevUploads}
                isCollapsed={sidebarResizable && desktopSidebarCollapsed}
                showSidebarToggle={sidebarResizable}
                onToggleSidebar={() =>
                  setDesktopSidebarCollapsed((v) => !v)
                }
              />
            </div>
          )}
          {sidebarResizable && !desktopSidebarCollapsed && (
            <SidebarResizeSplitter
              className="shell-sidebar-splitter"
              onMouseDown={onSidebarResizeStart}
            />
          )}
          {sidebarResizable && desktopSidebarCollapsed && (
            <button
              type="button"
              className="shell-sidebar-expand-tab"
              title="Show sidebar"
              aria-label="Show sidebar"
              onClick={() => setDesktopSidebarCollapsed(false)}
            >
              <ChevRight />
            </button>
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
