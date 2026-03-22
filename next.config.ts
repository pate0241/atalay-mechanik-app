import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(), // veya doğrudan proje dizinini belirtin
  },
};

export default nextConfig;