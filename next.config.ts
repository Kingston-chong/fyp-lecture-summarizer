import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
