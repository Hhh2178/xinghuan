import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

const rootDir = fileUrlPath(new URL("../", import.meta.url));
const cliArgs = parseArgs(process.argv.slice(2));
const stagedFiles = cliArgs.staged.length > 0 ? cliArgs.staged : getStagedFiles();

const rootBlockedPrefixes = [
  "runtime/",
  "logs/",
  "tmp/",
  ".tmp/",
  ".codex-temp/",
  "output/",
  "releases/",
  "dist-release/",
  ".codegraph/",
  ".playwright-cli/",
  "apps/api/data/",
  "node_modules/",
  ".next/",
];

const blockedPathSegments = new Set(["dist", "build", "node_modules"]);
const violations = stagedFiles.filter((file) => isRuntimeArtifactPath(file));

assert.ok(
  violations.length === 0,
  [
    "runtime/build/cache artifacts are staged and must not be committed",
    ...violations.map((file) => `- ${file}`),
    "move long-term evidence into docs/ or ops/ instead of staging runtime artifacts",
  ].join("\n"),
);

console.log(JSON.stringify({
  ok: true,
  stagedCount: stagedFiles.length,
  checkedBlockedPrefixes: rootBlockedPrefixes,
  checkedBlockedSegments: [...blockedPathSegments],
}, null, 2));

function isRuntimeArtifactPath(file) {
  const normalized = normalizePath(file);
  if (rootBlockedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  const segments = normalized.split("/");
  return segments.some((segment) => blockedPathSegments.has(segment));
}

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`git diff --cached failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => normalizePath(line))
    .filter(Boolean);
}

function parseArgs(argv) {
  const staged = [];
  for (const raw of argv) {
    if (!raw.startsWith("--staged=")) continue;
    const value = raw.slice("--staged=".length);
    staged.push(
      ...value
        .split(",")
        .map((item) => normalizePath(item))
        .filter(Boolean),
    );
  }
  return { staged };
}

function normalizePath(value) {
  return String(value || "").trim().replace(/\\/g, "/");
}

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}
