#!/usr/bin/env node
// `nimbus`: the CLI and stdio MCP server, a thin client of a running Nimbus's HTTP API (docs/CLI.md).
// The TypeScript in src/cli runs through tsx, which `pnpm install` puts in node_modules, so there is no build step.
// Importing "tsx" registers its ESM and CommonJS hooks, the same as `node --import tsx` in the package scripts.
await import("tsx");
await import(new URL("../src/cli/main.ts", import.meta.url).href);
