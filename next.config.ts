import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // native modules and the AI SDK test mocks run on the server only
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
