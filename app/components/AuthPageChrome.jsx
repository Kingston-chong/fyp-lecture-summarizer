"use client";

import "./AuthPageChrome.css";

/**
 * Shared auth shell: fonts, reset, background, decorative blobs, optional header.
 */
export default function AuthPageChrome({
  children,
  header = null,
  subnav = false,
  shell = "dark",
  blobCount = 2,
  centerContent = false,
}) {
  const themed = shell === "themed";
  const subnavNode = subnav && subnav !== false ? subnav : null;

  const rootClass = [
    "auth-chrome-root",
    themed ? "auth-chrome-root--themed" : "",
    centerContent ? "auth-chrome-root--center" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
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
      {subnavNode}
      {children}
    </div>
  );
}
