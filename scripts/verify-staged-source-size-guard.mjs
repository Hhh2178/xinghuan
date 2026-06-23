import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

const rootDir = fileUrlPath(new URL("../", import.meta.url));
const cliArgs = parseArgs(process.argv.slice(2));
const NEW_FILE_SOFT_MAX_LINES = 800;
const EXISTING_FILE_ESCALATION_LINES = 1000;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const SOURCE_ROOT_PREFIXES = ["apps/", "packages/", "scripts/"];

const stagedEntries = cliArgs.entries.length > 0 ? cliArgs.entries : getStagedEntries();
const violations = [];

for (const entry of stagedEntries) {
  if (!isGovernedSourcePath(entry.path)) continue;
  const stagedLineCount = typeof entry.mockStagedLineCount === "number"
    ? entry.mockStagedLineCount
    : countLines(getStagedBlobText(entry.path));

  if (entry.status === "A") {
    if (stagedLineCount > NEW_FILE_SOFT_MAX_LINES) {
      violations.push({
        path: entry.path,
        status: entry.status,
        stagedLineCount,
        limit: NEW_FILE_SOFT_MAX_LINES,
        reason: "new source file is too large",
      });
    }
    continue;
  }

  const headLineCount = typeof entry.mockHeadLineCount === "number"
    ? entry.mockHeadLineCount
    : (() => {
      const headText = getHeadBlobText(entry.path);
      return headText == null ? 0 : countLines(headText);
    })();
  if (headLineCount < EXISTING_FILE_ESCALATION_LINES && stagedLineCount >= EXISTING_FILE_ESCALATION_LINES) {
    violations.push({
      path: entry.path,
      status: entry.status,
      stagedLineCount,
      headLineCount,
      limit: EXISTING_FILE_ESCALATION_LINES,
      reason: "existing source file crosses escalation threshold",
    });
  }
}

assert.ok(
  violations.length === 0,
  [
    "staged source file size guard blocked this commit",
    `new source files must stay <= ${NEW_FILE_SOFT_MAX_LINES} lines`,
    `existing source files may not newly cross ${EXISTING_FILE_ESCALATION_LINES} lines in one commit`,
    ...violations.map((item) => {
      const previous = typeof item.headLineCount === "number" ? ` (head ${item.headLineCount} -> staged ${item.stagedLineCount})` : ` (staged ${item.stagedLineCount})`;
      return `- ${item.path}: ${item.reason}${previous}`;
    }),
    "split the file into hooks/helpers/sections/services before committing",
  ].join("\n"),
);

console.log(JSON.stringify({
  ok: true,
  stagedEntryCount: stagedEntries.length,
  newFileSoftMaxLines: NEW_FILE_SOFT_MAX_LINES,
  existingFileEscalationLines: EXISTING_FILE_ESCALATION_LINES,
}, null, 2));

function getStagedEntries() {
  const result = spawnSync("git", ["diff", "--cached", "--name-status", "--diff-filter=ACMR"], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`git diff --cached --name-status failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, rawPath] = line.split(/\s+/, 2);
      return {
        status: String(status || "").trim(),
        path: normalizePath(rawPath),
      };
    })
    .filter((entry) => entry.status && entry.path);
}

function getStagedBlobText(path) {
  const result = spawnSync("git", ["show", `:${path}`], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`git show :${path} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return String(result.stdout || "");
}

function getHeadBlobText(path) {
  const result = spawnSync("git", ["show", `HEAD:${path}`], {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    return null;
  }
  return String(result.stdout || "");
}

function isGovernedSourcePath(path) {
  const normalized = normalizePath(path);
  if (!SOURCE_ROOT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return [...SOURCE_EXTENSIONS].some((extension) => normalized.endsWith(extension));
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function parseArgs(argv) {
  const entries = [];
  for (const raw of argv) {
    if (!raw.startsWith("--entries=")) continue;
    const value = raw.slice("--entries=".length);
    for (const item of value.split(",")) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const [status, ...pathParts] = trimmed.split(":");
      const path = normalizePath(pathParts.join(":"));
      if (!status || !path) continue;
      entries.push({ status: status.trim(), path });
    }
  }
  for (const raw of argv) {
    if (!raw.startsWith("--mock=")) continue;
    const value = raw.slice("--mock=".length);
    for (const item of value.split(",")) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const [status, rawPath, rawHeadLines, rawStagedLines] = trimmed.split(":");
      const path = normalizePath(rawPath);
      const mockHeadLineCount = Number(rawHeadLines);
      const mockStagedLineCount = Number(rawStagedLines);
      if (!status || !path || !Number.isFinite(mockStagedLineCount)) continue;
      entries.push({
        status: status.trim(),
        path,
        mockHeadLineCount: Number.isFinite(mockHeadLineCount) ? mockHeadLineCount : undefined,
        mockStagedLineCount,
      });
    }
  }
  return { entries };
}

function normalizePath(value) {
  return String(value || "").trim().replace(/\\/g, "/");
}

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}
