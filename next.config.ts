import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An isolated output lets validation builds run alongside the local dev server.
  distDir: process.env.IRM_BUILD_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
