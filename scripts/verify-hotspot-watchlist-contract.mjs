import { readdir, readFile, stat } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { extname, join, relative } from "node:path";

const rootDir = new URL("../", import.meta.url);
const ledger = await readFile(
  new URL("../docs/records/architecture/2026-06-24-hotspot-superfile-decomposition-ledger.md", import.meta.url),
  "utf8",
);

const WATCHLIST_MIN_LINES = 1200;
const SOURCE_ROOTS = ["apps", "packages", "scripts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const IGNORE_SEGMENTS = new Set(["dist", "node_modules", ".codegraph"]);

const oversizedFiles = [];
for (const sourceRoot of SOURCE_ROOTS) {
  await walk(join(fileUrlPath(rootDir), sourceRoot), oversizedFiles);
}
oversizedFiles.sort((left, right) => right.lineCount - left.lineCount || left.path.localeCompare(right.path));

assert.match(
  ledger,
  /1200\+\s*source 文件 watchlist/,
  "hotspot decomposition ledger should define a 1200+ source file watchlist section",
);

for (const file of oversizedFiles) {
  assert.match(
    ledger,
    new RegExp(escapeRegExp(file.path)),
    `oversized source file must be documented in hotspot decomposition ledger: ${file.path}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  watchlistMinLines: WATCHLIST_MIN_LINES,
  oversizedCount: oversizedFiles.length,
  oversizedFiles,
}, null, 2));

async function walk(currentDir, oversizedFilesRef) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if ([...IGNORE_SEGMENTS].some((segment) => fullPath.includes(`\\${segment}\\`) || fullPath.endsWith(`\\${segment}`))) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(fullPath, oversizedFilesRef);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    const text = await readFile(fullPath, "utf8");
    const lineCount = countLines(text);
    if (lineCount < WATCHLIST_MIN_LINES) continue;
    oversizedFilesRef.push({
      path: relative(fileUrlPath(rootDir), fullPath).replace(/\\/g, "/"),
      lineCount,
    });
  }
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function fileUrlPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\//g, "\\"));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
