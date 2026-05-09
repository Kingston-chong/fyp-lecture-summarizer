"use client";


import "./AppHeader.css";
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

