"use client";

import Image from "next/image";

export const APP_LOGO_SRC = "/icon.png";

/**
 * App mark used in headers and marketing nav (icon.png).
 */
export default function AppLogo({
  src = APP_LOGO_SRC,
  alt = "Slide2Notes logo",
  size = 34,
  className = "",
  priority = false,
}) {
  return (
    <Image
      className={className}
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
    />
  );
}
