import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (tests) can use its own build dir so it never clobbers the one someone is driving.
  distDir: process.env.NIMBUS_DIST_DIR || ".next",
  // native modules and the AI SDK test mocks run on the server only
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Runs write into the project folder (data/, fixtures, evals, tsconfig.tsbuildinfo from the Checker's pnpm typecheck).
  // The dev watcher must not treat those as source changes: a page that reloads itself in the middle of a run loses
  // its place (seen while recording the demo).
  webpack(config, { dev }) {
    if (dev) {
      const ignored = ["**/data/**", "**/docs/**", "**/evals/**", "**/fixtures/**", "**/video/**", "**/.next*/**", "**/*.tsbuildinfo", "**/.claude/**", "**/node_modules/**"];
      config.watchOptions = { ...config.watchOptions, ignored };
    }
    return config;
  },
};

export default nextConfig;
