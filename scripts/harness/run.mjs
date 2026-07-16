import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const profile = argument("profile", "quick");
const profiles = {
  quick: ["harness:verify:quick", "verify:authority-state"],
  project: ["harness:verify:project", "verify:authority-state"],
  workspace: ["harness:verify:workspace", "verify:authority-state"],
  release: ["harness:verify:release", "verify:authority-state"],
};
if (!profiles[profile]) throw new Error(`UNKNOWN_HARNESS_PROFILE:${profile}`);

const startedAt = new Date();
const results = [];
for (const script of profiles[profile]) {
  const started = Date.now();
  try {
    await runNpm(script);
    results.push({ script, ok: true, durationMs: Date.now() - started });
  } catch (error) {
    results.push({ script, ok: false, durationMs: Date.now() - started, error: String(error.message || error) });
    break;
  }
}

const payload = {
  schemaVersion: 1,
  profile,
  ok: results.every((result) => result.ok),
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || "local",
  results,
};
const evidenceDir = resolve(root, ".harness/runs");
await mkdir(evidenceDir, { recursive: true });
const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const evidencePath = resolve(evidenceDir, `${stamp}-${profile}.json`);
await writeFile(evidencePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
if (!payload.ok) process.exitCode = 1;

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function runNpm(script) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npm, ["run", script], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`${script} exited with code ${code}`)));
  });
}
