import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Monorepo: allow resolving deps hoisted to repo root `node_modules`
    config.resolve = config.resolve || {};
    config.resolve.modules = config.resolve.modules || [];
    config.resolve.modules.push(path.resolve(__dirname, "../../node_modules"));
    return config;
  },
};

export default nextConfig;
