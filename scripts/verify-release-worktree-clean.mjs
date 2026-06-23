import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";

const args = parseArgs(process.argv.slice(2));
const allowStaged = flagEnabled(args["allow-staged"]);
const allowUntracked = flagEnabled(args["allow-untracked"]);

const output = await runGitStatus();
const rows = output
  .split(/\r?\n/)
  .map((line) => line.trimEnd())
  .filter(Boolean);

const disallowed = rows.filter((line) => {
  const indexStatus = line.slice(0, 1);
  const worktreeStatus = line.slice(1, 2);
  if (line.startsWith("??")) return !allowUntracked;
  if (!allowStaged && indexStatus !== " " && indexStatus !== "?") return true;
  return worktreeStatus !== " ";
});

assert.equal(
  disallowed.length,
  0,
  `working tree is not clean enough for release:\n${disallowed.join("\n")}`,
);

console.log(JSON.stringify({
  ok: true,
  allowStaged,
  allowUntracked,
  entriesChecked: rows.length,
}, null, 2));

function parseArgs(argv) {
  const result = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const body = raw.slice(2);
    const eqIndex = body.indexOf("=");
    const key = eqIndex >= 0 ? body.slice(0, eqIndex) : body;
    const value = eqIndex >= 0 ? body.slice(eqIndex + 1) : "true";
    result[key] = value;
  }
  return result;
}

function flagEnabled(value) {
  if (value === undefined) return false;
  return !["false", "0", "no", "off"].includes(String(value).trim().toLowerCase());
}

async function runGitStatus() {
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("git", ["status", "--short"], {
      cwd: new URL("..", import.meta.url),
      shell: false,
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`git status --short exited with code ${code}: ${stderr.trim()}`));
    });
  });
}
