import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native bindings + pdfjs worker; must not be bundled by Turbopack/webpack
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "2slides.com",
      },
    ],
  },
};

export default nextConfig;
