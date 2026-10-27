// Renders stills of a composition with one bundle.
//   node scripts/stills.mjs out/check 0 120 600       → frames of NimbusFull into out/check
//   COMP=NimbusX node scripts/stills.mjs out/x 0 300   → frames of NimbusX
// BROWSER_EXECUTABLE: an optional Chrome to use instead of Remotion's own.
import path from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../webpack-override.ts";

const root = path.resolve(import.meta.dirname, "..");
process.chdir(root); // webpack-override resolves `@/` against the cwd

const id = process.env.COMP ?? "NimbusFull";
const [dir, ...frames] = process.argv.slice(2);
// JOBS: a JSON file of [{ props, frames, out }] rendered with one bundle (layout-callouts.py)
if (process.env.JOBS) {
  const jobs = JSON.parse(readFileSync(process.env.JOBS, "utf8"));
  const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride, rspack: false });
  const browserExecutable = process.env.BROWSER_EXECUTABLE ?? null;
  for (const job of jobs) {
    const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps: job.props });
    mkdirSync(job.out, { recursive: true });
    for (const f of job.frames) {
      const output = path.join(job.out, `${id}-${String(f).padStart(5, "0")}.png`);
      await renderStill({ serveUrl, composition, frame: f, output, imageFormat: "png", browserExecutable, inputProps: job.props });
    }
    console.log(`${job.out}: ${job.frames.length} frames`);
  }
  process.exit(0);
}
if (!dir || frames.length === 0) {
  console.error("usage: node scripts/stills.mjs <out-dir> <frame> [frame…]");
  process.exit(1);
}
const outDir = path.resolve(dir);
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), webpackOverride, rspack: false });
const browserExecutable = process.env.BROWSER_EXECUTABLE ?? null;
// PROPS: input props as JSON (e.g. {"calloutMode":"rings"} for scripts/layout-callouts.py)
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps });
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `${id}-${String(f).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame: f, output, imageFormat: "png", browserExecutable, inputProps });
  console.log(`${output}  (frame ${f}, ${(f / 30).toFixed(2)}s)`);
}
