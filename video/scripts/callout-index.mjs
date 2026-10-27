// Prints every callout of a cut at its absolute frames, as JSON (src/shots.ts calloutIndex).
//   node scripts/callout-index.mjs full|x
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const cut = process.argv[2] ?? "full";
const out = await build({
  entryPoints: [path.join(root, "src/shots.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  alias: { "@": path.join(root, "src") },
  logLevel: "warning",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
console.log(JSON.stringify(mod.calloutIndex(cut), null, 1));
