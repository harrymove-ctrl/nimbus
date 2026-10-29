// One-file check of Nebius Token Factory Sandboxes with the keys in .env.local: who the key is, which Python image
// exists, and one real run (prints "ok" plus the sandbox's hostname). Usage: pnpm sandbox:probe
import { existsSync, readFileSync } from "node:fs";
// .env.local without a dependency: KEY=value lines, quotes stripped, existing environment wins
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const { whoami, listImages, sandboxRun, sandboxEnabled } = await import("../src/runtime/sandbox");

if (!process.env.NEBIUS_PROJECT_ID) {
  console.error("NEBIUS_PROJECT_ID is not set in .env.local (tokenfactory.nebius.com/project/api-keys)");
  process.exit(2);
}
console.log("enabled:", sandboxEnabled(), "(model mode must not be mock)");
const me = await whoami();
console.log("token:", me.token_uuid, "limits:", me.limits ?? {});
for (const tag of ["python", "node"]) {
  const imgs = await listImages(tag);
  console.log(`${tag} images:`, imgs.map((i) => i.tag).filter(Boolean).slice(0, 10).join(", ") || "(none)");
}
const t0 = Date.now();
const r = await sandboxRun({ language: "python", file: "probe.py", code: 'import socket, csv\nprint("ok", socket.gethostname())\nprint(open("/work/data.csv").readline().strip() if __import__("os").path.exists("/work/data.csv") else "no data.csv")\n', files: [{ path: "data.csv", content: "day,orders\n1,10\n" }], timeoutS: 60 });
console.log(`run: ${r.sandbox.status} exit ${r.exitCode} in ${((Date.now() - t0) / 1000).toFixed(1)} s (sandbox ${r.sandbox.elapsedS ?? "?"} s) op ${r.sandbox.operation}`);
console.log("stdout:", r.stdout.trim());
if (r.stderr) console.log("stderr:", r.stderr.trim());
process.exit(r.ok ? 0 : 1);
