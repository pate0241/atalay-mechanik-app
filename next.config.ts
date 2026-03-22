import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: false, // 🔥 GANZ WICHTIG
  },
};

export default nextConfig;