"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import AppSidebar from "./AppSidebar";
import { ChevronDownIcon, LogoIcon, LogoutIcon } from "./icons";

export default function AppShell({
  children,
  showBackToDashboard = false,
  showSidebar = false,
  hidePrevUploads = false,
}) {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <>
      <style>{`
        :root{
          --chrome-nav-h: 58px;
          --chrome-subnav-h: 40px;
          --chrome-h: calc(var(--chrome-nav-h) + var(--chrome-subnav-h));
        }
        html, body { height: 100%; }
        body { background: #0e0e12; }

        .shell { min-height: 100vh; background: #0e0e12; font-family: 'Sora', sans-serif; position: relative; overflow: hidden; }
        .shell-blobs { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .blob1 { position: absolute; top: -10%; right: -5%; width: 520px; height: 520px; background: radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 65%); }
        .blob2 { position: absolute; bottom: -10%; left: 10%; width: 420px; height: 420px; background: radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 65%); }

        .shell-nav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: var(--chrome-nav-h);
          background: rgba(14,14,18,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.055); }
        .shell-brand { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
        .shell-badge { width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
        .shell-name { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; background: linear-gradient(90deg, #e8e8f0, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .shell-right { display: flex; align-items: center; gap: 10px; }
        .shell-greet { font-size: 12px; color: rgba(255,255,255,0.35); }
        .shell-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04); display: flex; align-items: center; gap: 6px; cursor: pointer;
          font-family: 'Sora', sans-serif; font-size: 12px; color: rgba(255,255,255,0.4); transition: all 0.2s; }
        .shell-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }

        .shell-subnav { position: relative; z-index: 20; display: flex; align-items: center; justify-content: flex-end; padding: 0 28px; height: var(--chrome-subnav-h);
          background: rgba(16,16,22,0.8); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.035); }
        .shell-subitem { display: flex; align-items: center; gap: 4px; padding: 0 14px; height: var(--chrome-subnav-h);
          font-size: 12px; color: #52526e; cursor: pointer; border: none; background: none; font-family: 'Sora', sans-serif; transition: color 0.2s; }
        .shell-subitem:hover { color: #9090b8; }

        .shell-content { position: relative; z-index: 5; height: calc(100vh - var(--chrome-h)); display: flex; overflow: hidden; }
        .shell-main { flex: 1; min-width: 0; height: 100%; }

        /* Mobile: allow full-page scrolling for dashboard-style layouts */
        @media (max-width: 900px) {
          .shell {
            overflow: auto;
          }
          .shell-content {
            height: auto;
            min-height: calc(100vh - var(--chrome-h));
            overflow: visible;
          }
          .shell-main {
            height: auto;
          }
        }
      `}</style>

      <div className="shell">
        <div className="shell-blobs">
          <div className="blob1" />
          <div className="blob2" />
        </div>

        <nav className="shell-nav">
          <div className="shell-brand" onClick={() => router.push("/dashboard")}>
            <div className="shell-badge">
              <LogoIcon />
            </div>
            <span className="shell-name">Slide2Notes</span>
          </div>

          <div className="shell-right">
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

        <div className="shell-content">
          {showSidebar && <AppSidebar hidePrevUploads={hidePrevUploads} />}
          <div className="shell-main">{children}</div>
        </div>
      </div>
    </>
  );
}

