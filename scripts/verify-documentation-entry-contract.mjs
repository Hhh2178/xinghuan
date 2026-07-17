import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const files = {
  agents: await read("AGENTS.md"),
  readme: await read("README.md"),
  context: await read("CONTEXT.md"),
  memory: await read("MEMORY.md"),
  devlog: await read("DEVLOG.md"),
  ops: await read("ops/README.md"),
  matrix: await read("docs/governance/root-entry-responsibility-matrix.md"),
};

assertIncludes(files.agents, "docs/INDEX.md", "AGENTS.md must point to docs index");
assertIncludes(files.agents, "docs/governance/", "AGENTS.md must point to governance docs");
assertIncludes(files.agents, "docs/systems/harness/", "AGENTS.md must point to harness docs");
assertIncludes(files.agents, "docs/governance/root-entry-responsibility-matrix.md", "AGENTS.md must point to root responsibility matrix");
assertIncludes(files.agents, "CONTEXT.md", "AGENTS.md must point to domain context");
assertIncludes(files.agents, "docs/adr/", "AGENTS.md must point to ADR directory");

assertIncludes(files.readme, "docs/INDEX.md", "README.md must point to docs index");
assertIncludes(files.readme, "docs/logbooks/releases/current-release-index.md", "README.md must point to current release index");
assertIncludes(files.readme, "ops/current/gray.md", "README.md must point to gray current ops entry");
assertIncludes(files.readme, "ops/current/production.md", "README.md must point to production current ops entry");
assertIncludes(files.readme, "CONTEXT.md", "README.md must point to domain context");
assertIncludes(files.readme, "docs/adr/README.md", "README.md must point to ADR index");

assertIncludes(files.context, "docs/systems/", "CONTEXT.md must route current implementation to system docs");
assertIncludes(files.context, "docs/adr/", "CONTEXT.md must route architectural decisions to ADRs");

assertIncludes(files.memory, "docs/memory/", "MEMORY.md must point to docs/memory");
assertIncludes(files.devlog, "docs/logbooks/daily/", "DEVLOG.md must point to daily logbooks");
assertIncludes(files.ops, "current/gray.md", "ops README must point to gray current entry");
assertIncludes(files.ops, "current/production.md", "ops README must point to production current entry");

assertIncludes(files.matrix, "`AGENTS.md`", "root matrix must describe AGENTS.md");
assertIncludes(files.matrix, "`README.md`", "root matrix must describe README.md");
assertIncludes(files.matrix, "`MEMORY.md`", "root matrix must describe MEMORY.md");
assertIncludes(files.matrix, "`DEVLOG.md`", "root matrix must describe DEVLOG.md");
assertIncludes(files.matrix, "`ops/README.md`", "root matrix must describe ops README");
assertIncludes(files.matrix, "`CONTEXT.md`", "root matrix must describe CONTEXT.md");

const readmeCurrentStateHeadings = countMatches(files.readme, /^## 当前状态摘要$/gm);
assert.equal(readmeCurrentStateHeadings, 1, "README.md must contain exactly one current-state summary heading");

for (const forbiddenHeading of ["## 当前定位", "## 2026-07-03 状态更新"]) {
  assert.equal(
    files.readme.includes(forbiddenHeading),
    false,
    `README.md should not keep duplicate heading ${forbiddenHeading}`,
  );
}

console.log("documentation entry contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(source.includes(needle), true, message);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}
