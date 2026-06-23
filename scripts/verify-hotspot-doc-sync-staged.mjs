import { readFile, readdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { extname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = fileUrlPath(new URL("../", import.meta.url));
const HARD_BUDGET_FILES = new Set([
  "apps/api/src/server.ts",
  "apps/worker/src/worker.ts",
  "apps/web/src/components/nodes/RunningHubNode.tsx",
  "apps/admin/src/admin-runninghub-workspace.tsx",
]);
const WATCHLIST_MIN_LINES = 1200;
const SOURCE_ROOTS = ["apps", "packages", "scripts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const IGNORE_SEGMENTS = new Set(["dist", "node_modules", ".codegraph"]);
const cliArgs = parseArgs(process.argv.slice(2));

const stagedFiles = cliArgs.staged.length > 0 ? cliArgs.staged : getStagedFiles();
const governedFiles = new Set([
  ...HARD_BUDGET_FILES,
  ...(await collectOversizedFiles()),
]);
const stagedGovernedFiles = stagedFiles.filter((file) => governedFiles.has(file));

if (stagedGovernedFiles.length === 0) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "no governed hotspot files staged",
  }, null, 2));
  process.exit(0);
}

const allowedDocPaths = [
  "docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md",
  "docs/logbooks/daily/",
  "docs/logbooks/releases/",
  "docs/logbooks/validations/",
  "docs/superpowers/plans/",
  "docs/superpowers/specs/",
];

const stagedDocFiles = stagedFiles.filter((file) =>
  allowedDocPaths.some((allowed) => file === allowed || file.startsWith(allowed)),
);

assert.ok(
  stagedDocFiles.length > 0,
  [
    "governed hotspot files are staged, but no matching doc/ledger evidence is staged",
    `staged governed files: ${stagedGovernedFiles.join(", ")}`,
    "expected at least one staged file under:",
    ...allowedDocPaths.map((path) => `- ${path}`),
  ].join("\n"),
);

console.log(JSON.stringify({
  ok: true,
  stagedGovernedFiles,
  stagedDocFiles,
}, null, 2));

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
    .map((line) => line.trim().replace(/\\/g, "/"))
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
        .map((item) => item.trim().replace(/\\/g, "/"))
        .filter(Boolean),
    );
  }
  return { staged };
}

async function collectOversizedFiles() {
  const files = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    await walk(join(rootDir, sourceRoot), files);
  }
  return files;
}

async function walk(currentDir, filesRef) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if ([...IGNORE_SEGMENTS].some((segment) => fullPath.includes(`\\${segment}\\`) || fullPath.endsWith(`\\${segment}`))) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(fullPath, filesRef);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    const text = await readFile(fullPath, "utf8");
    if (countLines(text) < WATCHLIST_MIN_LINES) continue;
    filesRef.push(relative(rootDir, fullPath).replace(/\\/g, "/"));
  }
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}
