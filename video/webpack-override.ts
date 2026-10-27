import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";

// Run from video/. Shared by remotion.config.ts (CLI) and scripts/stills.mjs (Node API, which ignores the config).
// snapcn imports `@/…`; Remotion's bundler does not read tsconfig paths.
export const webpackOverride: WebpackOverrideFn = (config) => {
  const c = enableTailwind(config);
  return {
    ...c,
    resolve: {
      ...c.resolve,
      alias: { ...c.resolve?.alias, "@": path.join(process.cwd(), "src") },
    },
  };
};
