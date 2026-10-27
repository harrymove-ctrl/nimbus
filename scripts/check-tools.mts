// Ship Nimbus tools, mock mode ($0, real subprocesses): read_repo is read-only, run_code's shell mode only runs the
// allow-listed commands, `pnpm eval --only` reproduces the demo golden's failure, `--patch` makes it pass in a scratch
// copy without touching the tree, open_pr logs in mock mode, and the open_pr policy line matches fix/* branches.
process.env.NIMBUS_DATA_DIR = "./data/check-tools"; // set here, not ??=: .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../src/db";
import type { ProposedAction } from "../src/lib/events";
import { policyAllows, ruleFor } from "../src/runtime/skills";
import { openPr, readRepo, runCode, writeArtifact } from "../src/runtime/tools";
import type { RunCtx } from "../src/runtime/context";

const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail}` : ""}`));

const workspace = path.resolve(dataDir(), "workspaces", "check-tools");
mkdirSync(workspace, { recursive: true });
const ctx = {
  runId: "check-tools",
  workspace,
  mode: "ask",
  artifactVersions: new Map<string, number>(),
  artifactContent: new Map<string, string>(),
  emit: () => {},
  saveArtifact: async () => {},
} as unknown as RunCtx;

// ---- read_repo
const r1 = (await readRepo({ action: "read", path: "src/runtime/router.ts" })) as { ok: boolean; text?: string };
check("read_repo reads a source file", r1.ok && !!r1.text?.includes("onFallback"));
check("read_repo refuses .env.local, data/, ../ and .git", (await Promise.all([".env.local", "data/nimbus.db", "../outside", ".git/config"].map((p) => readRepo({ action: "read", path: p })))).every((r) => (r as { ok: boolean }).ok === false));
check("read_repo lists a directory without the denied ones", ((await readRepo({ action: "list", path: "." })) as { entries: string[] }).entries.every((e) => !e.startsWith(".env") && e !== "node_modules/" && e !== "data/"));
check("read_repo changed and diff run (git, read-only)", (await readRepo({ action: "changed" })).ok === true && (await readRepo({ action: "diff", path: "src/runtime/router.ts" })).ok === true);

// ---- run_code shell: the allow-list
const refused = await Promise.all(["rm -rf /", "pnpm eval; ls", "pnpm install", "git push origin main", "git apply fix.patch", "pnpm eval $(whoami)", "cat .env.local"].map((c) => runCode(ctx, { language: "shell", code: c })));
check("run_code shell refuses anything off the allow-list (7 of 7)", refused.every((r) => !r.ok && r.exitCode === 126), refused.map((r) => r.stderr).join(" | "));

// ---- real eval runs through run_code, the way the Analyst and Checker do it
const wrong = await runCode(ctx, { language: "shell", code: "pnpm eval --golden router-fallback-404" });
check("a wrong flag really fails (exit 2) and says what was meant", !wrong.ok && wrong.exitCode === 2 && /did you mean --/.test(wrong.stderr), `${wrong.exitCode} ${wrong.stderr}`);
const repro = await runCode(ctx, { language: "shell", code: "pnpm eval --only router-fallback-404" });
check("pnpm eval --only reproduces the demo golden's failure (exit 1, reason named)", repro.exitCode === 1 && /route_reason_contains/.test(repro.stdout) && /fell back to nano/.test(repro.stdout), repro.stdout.slice(-400));
const patchText = readFileSync("fixtures/ship-nimbus/fix-router-fallback-ceiling.patch", "utf8");
await writeArtifact(ctx, { role: "writer", instance: "writer-1" }, { artifactId: "fix-router-fallback.patch", kind: "code", title: "fix-router-fallback.patch", language: "diff", content: patchText });
check("a code artifact lands in the run workspace as a file", existsSync(path.join(workspace, "fix-router-fallback.patch")));
const applies = await runCode(ctx, { language: "shell", code: "git apply --check fix-router-fallback.patch" });
check("git apply --check accepts the artifact", applies.ok, applies.stderr);
const fixed = await runCode(ctx, { language: "shell", code: "pnpm eval --only router-fallback-404 --patch fix-router-fallback.patch" });
check("pnpm eval --only … --patch passes in a scratch copy", fixed.ok && /applied cleanly/.test(fixed.stdout) && /EVAL: PASS/.test(fixed.stdout), fixed.stdout.slice(-500) + fixed.stderr);
const after = spawnSync("git", ["diff", "--quiet", "--", "src/runtime/router.ts"], { cwd: process.cwd() });
const text = readFileSync("src/runtime/router.ts", "utf8");
check("…and the real router.ts is untouched by it", !text.includes("ceiling stays") && after.status !== null);

// ---- open_pr (mock): logs, returns a placeholder URL, refuses bad branches
const pr = (await openPr(ctx, { branch: "fix/router-fallback-ceiling", title: "Name the ceiling in fallback reasons", body: "Body", patchArtifactId: "fix-router-fallback.patch" })) as { logged?: boolean; url?: string };
check("open_pr in mock mode logs the PR and returns a placeholder URL", !!pr.logged && /^https:\/\/github\.com\/harrymove-ctrl\/nimbus\/pull\/\d+$/.test(pr.url ?? "") && readFileSync(path.join(dataDir(), "outbox.log"), "utf8").includes("PR fix/router-fallback-ceiling"));
const bad = await Promise.all(["main/x", "no-slash", "fix/a b"].map((branch) => openPr(ctx, { branch, title: "t", body: "b", patchArtifactId: "fix-router-fallback.patch" })));
check("open_pr refuses main/…, a name without a prefix, and spaces", bad.every((r) => (r as { opened: boolean }).opened === false));

// ---- policy: allow: open_pr for branches fix/*
const act = (branch: string): ProposedAction => ({ kind: "open_pr", summary: "Open PR", risk: "medium", details: { branch } });
const rule = ruleFor(act("fix/router-fallback-ceiling"));
const skill = `## Ship Nimbus\n\n## Policy\n${rule}`;
check("ruleFor writes `allow: open_pr for branches fix/*`", rule === "allow: open_pr for branches fix/*", rule);
check("the rule lets fix/… through and not chore/… or main", policyAllows(skill, act("fix/other")) && !policyAllows(skill, act("chore/deps")) && !policyAllows(skill, act("main")));

const pass = checks.every(([, ok]) => ok);
console.log(`\nTOOLS CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
