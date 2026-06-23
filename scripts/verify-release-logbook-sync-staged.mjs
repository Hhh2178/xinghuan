import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

const rootDir = fileUrlPath(new URL("../", import.meta.url));
const cliArgs = parseArgs(process.argv.slice(2));

const stagedFiles = cliArgs.staged.length > 0 ? cliArgs.staged : getStagedFiles();
const grayReleaseDocs = stagedFiles.filter((file) =>
  /^docs\/logbooks\/releases\/gray\/.+\.md$/i.test(file) && !/\/README\.md$/i.test(file),
);
const productionReleaseDocs = stagedFiles.filter((file) =>
  /^docs\/logbooks\/releases\/production\/.+\.md$/i.test(file) && !/\/README\.md$/i.test(file),
);

if (grayReleaseDocs.length === 0 && productionReleaseDocs.length === 0) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "no gray/production release logbook files staged",
  }, null, 2));
  process.exit(0);
}

const requiredFiles = new Set([
  "docs/logbooks/releases/current-release-index.md",
  "ops/README.md",
]);
if (grayReleaseDocs.length > 0) {
  requiredFiles.add("ops/current/gray.md");
}
if (productionReleaseDocs.length > 0) {
  requiredFiles.add("ops/current/production.md");
}

const missingFiles = [...requiredFiles].filter((file) => !stagedFiles.includes(file));

assert.equal(
  missingFiles.length,
  0,
  [
    "release logbook files are staged, but release entry docs are not fully synced in the same commit",
    grayReleaseDocs.length > 0 ? `staged gray release docs: ${grayReleaseDocs.join(", ")}` : null,
    productionReleaseDocs.length > 0 ? `staged production release docs: ${productionReleaseDocs.join(", ")}` : null,
    "missing staged files:",
    ...missingFiles.map((file) => `- ${file}`),
  ].filter(Boolean).join("\n"),
);

console.log(JSON.stringify({
  ok: true,
  grayReleaseDocs,
  productionReleaseDocs,
  requiredFiles: [...requiredFiles],
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

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}
