"use client";

import Image from "next/image";

export default function AppHeader({
  left = null,
  right = null,
  onLogoClick,
  brandText = "Slide2Notes",
  logoSrc = "/icon.png",
}) {
  return (
    <>
      <style>{`
        .s2n-header {
          position: relative;
          z-index: 20;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: var(--app-nav-bg);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--app-border);
        }
        .s2n-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .s2n-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          min-width: 0;
        }
        .s2n-logo-img {
          border-radius: 9px;
          flex-shrink: 0;
        }
        .s2n-logo-text {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          font-weight: 600;
          background: var(--app-brand-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }
        .s2n-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        @media (max-width: 639px) {
          .s2n-logo-text { display: none; }
        }
      `}</style>

      <nav className="s2n-header" aria-label="Top navigation">
        <div className="s2n-header-left">
          {left}
          <div
            className="s2n-brand"
            role={onLogoClick ? "button" : undefined}
            tabIndex={onLogoClick ? 0 : undefined}
            onClick={onLogoClick}
            onKeyDown={(e) => {
              if (!onLogoClick) return;
              if (e.key === "Enter") onLogoClick();
              if (e.key === " ") {
                e.preventDefault();
                onLogoClick();
              }
            }}
          >
            <Image
              className="s2n-logo-img"
              src={logoSrc}
              alt="Slide2Notes logo"
              width={34}
              height={34}
              priority
            />
            <span className="s2n-logo-text">{brandText}</span>
          </div>
        </div>
        <div className="s2n-header-right">{right}</div>
      </nav>
    </>
  );
}
