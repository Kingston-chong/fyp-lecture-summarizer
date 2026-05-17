"use client";

import Script from "next/script";

/** Optional Plausible analytics when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. */
export default function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
