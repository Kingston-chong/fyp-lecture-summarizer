"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./GuestSidebarPrompt.css";

/**
 * ChatGPT-style sidebar prompt for unsigned users.
 */
export default function GuestSidebarPrompt({ className = "" }) {
  const pathname = usePathname();
  const callbackUrl = encodeURIComponent(pathname || "/dashboard");

  return (
    <div className={`guest-sidebar-prompt ${className}`.trim()}>
      <p className="guest-sidebar-prompt-text">
        Sign in to start saving your summaries. Once you&apos;re signed in, you
        can access your recent summaries here.
      </p>
      <Link
        href={`/login?callbackUrl=${callbackUrl}`}
        className="guest-sidebar-prompt-link"
      >
        Sign in
      </Link>
    </div>
  );
}
