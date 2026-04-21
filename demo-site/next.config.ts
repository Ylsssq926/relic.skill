import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
