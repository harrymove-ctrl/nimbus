import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (tests) can use its own build dir so it never clobbers the one someone is driving.
  distDir: process.env.NIMBUS_DIST_DIR || ".next",
  // native modules and the AI SDK test mocks run on the server only
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
