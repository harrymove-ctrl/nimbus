// Where the CLI finds Nimbus: NIMBUS_URL and NIMBUS_API_TOKEN from the environment, then .env.local.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** the repo this CLI ships in (bin/ and src/ live here), for .env.local and the smoke script */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** KEY=value lines, quotes and trailing comments stripped; a variable already in the environment wins */
export function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** NIMBUS_ENV_FILE names one file ("none" loads nothing); otherwise .env.local here, then the repo's own. */
export function loadEnv() {
  const named = process.env.NIMBUS_ENV_FILE;
  if (named) {
    if (named !== "none") loadEnvFile(path.resolve(named));
    return;
  }
  loadEnvFile(path.resolve(".env.local"));
  if (path.resolve(".") !== REPO_ROOT) loadEnvFile(path.join(REPO_ROOT, ".env.local"));
}

export const baseUrl = () => (process.env.NIMBUS_URL || "http://localhost:3000").replace(/\/+$/, "");
export const runLink = (runId: string) => `${baseUrl()}/?run=${runId}`;
