/**
 * Nebius Token Factory Sandboxes (beta): model-written code runs in an isolated, on-demand VM at Nebius instead of in
 * a temp directory on this server. REST only (the official SDK is Python): upload the inputs, spawn one disposable
 * instance from a public image with networking off, poll the operation until it ends, read stdout, stderr and the
 * exit code. Docs: https://docs.tokenfactory.nebius.com/sandboxes/overview
 *
 * On: NEBIUS_API_KEY and NEBIUS_PROJECT_ID set, NIMBUS_SANDBOX not "local", and the model mode is not mock.
 * Any failure here is reported to the caller, which falls back to the local subprocess and says so in the result.
 */
import { createHash } from "node:crypto";
import { modelMode } from "@/lib/tokenfactory";

const BASE = () => (process.env.NEBIUS_SANDBOX_BASE_URL || "https://api.tokenfactory.nebius.com/sandboxes/v1").replace(/\/$/, "");
const IMAGES: Record<"python" | "node", () => string> = {
  python: () => process.env.NIMBUS_SANDBOX_IMAGE_PYTHON || "python:3.12-slim",
  node: () => process.env.NIMBUS_SANDBOX_IMAGE_NODE || "node:22-slim",
};

export function sandboxEnabled(): boolean {
  return !!process.env.NEBIUS_API_KEY && !!process.env.NEBIUS_PROJECT_ID && process.env.NIMBUS_SANDBOX !== "local" && modelMode() !== "mock";
}

export type SandboxFile = { path: string; content: string | Buffer };
export type SandboxResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** what the person sees in Agent I/O */
  sandbox: { provider: "nebius"; operation: string; image: string; elapsedS: number | null; status: string };
};

class SandboxError extends Error {}

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`, Project: process.env.NEBIUS_PROJECT_ID ?? "", ...extra };
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(`${BASE()}${path}`, { ...init, headers: headers((init.headers as Record<string, string>) ?? {}), signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "error" in body ? JSON.stringify((body as { error: unknown }).error) : text.slice(0, 300);
    throw new SandboxError(`${init.method ?? "GET"} ${path} → ${res.status}: ${msg}`);
  }
  return { status: res.status, body: body as T, headers: res.headers };
}

/** Uploads are content-addressed on their side; we also cache by sha256 for the life of the process. */
const uploads = new Map<string, string>();
async function upload(content: string | Buffer): Promise<string> {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  const sha = createHash("sha256").update(buf).digest("hex");
  const hit = uploads.get(sha);
  if (hit) return hit;
  const { body } = await call<{ uuid: string }>("/files", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: new Uint8Array(buf) });
  uploads.set(sha, body.uuid);
  return body.uuid;
}

type Op = {
  uuid: string;
  status: "PENDING" | "ASSIGNED" | "EXECUTING" | "SUCCESS" | "FAILED" | "CANCELLED";
  error: string | null;
  duration: number | null;
  image_uuid?: string | null;
  metadata?: { result?: { state?: { exit_code?: number; timed_out?: boolean; signal?: number | null }; stdout?: Stream; stderr?: Stream; resources?: { elapsed_time?: number } } | null };
};
type Stream = { value: string; encoding?: "ascii" | "base64"; truncated?: boolean };
const text = (s?: Stream) => (!s ? "" : s.encoding === "base64" ? Buffer.from(s.value, "base64").toString("utf8") : s.value);

/** Who the key is, and the account's limits: the probe script prints this. */
export async function whoami() {
  return (await call<{ token_uuid: string; permissions: Record<string, boolean>; limits?: Record<string, number> }>("/whoami")).body;
}
export async function listImages(tag: string) {
  return (await call<{ images: { uuid: string; tag: string | null }[] }>(`/images?tag=${encodeURIComponent(tag)}&limit=20`)).body.images;
}

/**
 * Run one script in a fresh disposable sandbox. `files` are placed under /work; the script runs with cwd /work.
 * Networking is off: the crew's data is in the files it was given, and a sandbox cannot call out.
 */
export async function sandboxRun(i: { language: "python" | "node"; file: string; code: string; files?: SandboxFile[]; timeoutS?: number }): Promise<SandboxResult> {
  const image = IMAGES[i.language]();
  const timeoutS = Math.min(Math.max(i.timeoutS ?? 60, 5), Number(process.env.NIMBUS_SANDBOX_MAX_S) || 300);
  const all: SandboxFile[] = [{ path: i.file, content: i.code }, ...(i.files ?? [])];
  const files: Record<string, { uuid: string; uid: number; gid: number; mode: string }> = {};
  for (const f of all) files[`/work/${f.path.replace(/^\/+/, "")}`] = { uuid: await upload(f.content), uid: 0, gid: 0, mode: "0644" };
  const spawn = await call<{ uuid: string }>("/instances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: image.includes("-") && image.length === 36 ? image : `tag:${image}`,
      command: i.language === "python" ? "python3" : "node",
      args: [`/work/${i.file}`],
      shell: false,
      env: { PYTHONUNBUFFERED: "1", LANG: "C.UTF-8", HOME: "/work" },
      cwd: "/work",
      files,
      timeout: timeoutS,
      disposable: true,
      networking: { enabled: false },
      truncate_output_at: 262_144,
    }),
  });
  const opId = spawn.body.uuid;
  const deadline = Date.now() + (timeoutS + 90) * 1000;
  let op: Op | null = null;
  let wait = 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, wait));
    const r = await call<Op>(`/operations/${opId}`);
    op = r.body;
    if (op.status === "SUCCESS" || op.status === "FAILED" || op.status === "CANCELLED") break;
    const ra = Number(r.headers.get("retry-after"));
    wait = Math.min(5000, Math.max(700, ra > 0 ? ra * 1000 : wait + 300));
  }
  if (!op) throw new SandboxError("no operation status");
  const res = op.metadata?.result ?? null;
  const exitCode = typeof res?.state?.exit_code === "number" && res.state.exit_code >= 0 ? res.state.exit_code : null;
  const timedOut = !!res?.state?.timed_out || !(op.status === "SUCCESS" || op.status === "FAILED" || op.status === "CANCELLED");
  if (op.status === "FAILED" && !res) throw new SandboxError(`operation failed: ${op.error ?? "unknown"}`);
  return {
    ok: op.status === "SUCCESS" && exitCode === 0,
    exitCode,
    stdout: text(res?.stdout).slice(0, 8000),
    stderr: text(res?.stderr).slice(-2000),
    timedOut,
    sandbox: { provider: "nebius", operation: opId, image, elapsedS: res?.resources?.elapsed_time ?? op.duration ?? null, status: op.status },
  };
}
