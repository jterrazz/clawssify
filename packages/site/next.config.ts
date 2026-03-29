import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.TAURI_BUILD ? "export" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  transpilePackages: ["@clawssify/shared"],
};

export default nextConfig;
