import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const adrDir = new URL("../docs/adr/", import.meta.url);

const files = {
  agents: await read("AGENTS.md"),
  context: await read("CONTEXT.md"),
  docsIndex: await read("docs/INDEX.md"),
  governance: await read("docs/governance/domain-context-and-adr-standard.md"),
  matrix: await read("docs/governance/root-entry-responsibility-matrix.md"),
  adrIndex: await read("docs/adr/README.md"),
  template: await read("docs/adr/0000-template.md"),
  packageJson: JSON.parse(await read("package.json")),
};

for (const [sourceName, source] of Object.entries({
  "AGENTS.md": files.agents,
  "docs/INDEX.md": files.docsIndex,
})) {
  assertIncludes(source, "CONTEXT.md", `${sourceName} must route to CONTEXT.md`);
  assertIncludes(source, "docs/adr/", `${sourceName} must route to docs/adr/`);
}

for (const term of [
  "Generation Artifact",
  "Generation Library",
  "Resource Asset",
  "Promotion",
  "Artifact Binary",
  "Canvas Output Reference",
]) {
  assertIncludes(files.context, term, `CONTEXT.md must define ${term}`);
}

for (const invariant of ["GET 读取保持只读", "并发安全和幂等", "Proposed ADR 不代表已经上线"]) {
  assertIncludes(files.context, invariant, `CONTEXT.md must preserve invariant: ${invariant}`);
}

for (const status of ["Proposed", "Accepted", "Superseded", "Rejected"]) {
  assertIncludes(files.governance, `\`${status}\``, `governance standard must define ${status}`);
  assertIncludes(files.adrIndex, `\`${status}\``, `ADR index must define ${status}`);
}

for (const source of [files.governance, files.matrix]) {
  assertIncludes(source, "CONTEXT.md", "governance sources must register CONTEXT.md");
  assertIncludes(source, "docs/adr/", "governance sources must register docs/adr/");
}

assert.equal(
  files.packageJson.scripts?.["verify:domain-context-and-adr-contract"],
  "node scripts/verify-domain-context-and-adr-contract.mjs",
  "package.json must expose the domain context and ADR contract",
);
assertIncludes(
  files.packageJson.scripts?.["harness:verify:project"],
  "verify:domain-context-and-adr-contract",
  "project harness must include the domain context and ADR contract",
);

validateAdrShape("0000-template.md", files.template, { template: true });

const adrFiles = (await readdir(adrDir))
  .filter((name) => /^\d{4}-.+\.md$/.test(name) && name !== "0000-template.md")
  .sort();

assert.ok(adrFiles.length > 0, "docs/adr must contain at least one decision record");

for (const fileName of adrFiles) {
  const source = await read(`docs/adr/${fileName}`);
  validateAdrShape(fileName, source);
  assertIncludes(files.adrIndex, fileName, `ADR index must register ${fileName}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      contract: "domain-context-and-adr",
      adrCount: adrFiles.length,
      adrFiles,
    },
    null,
    2,
  ),
);

function validateAdrShape(fileName, source, options = {}) {
  for (const heading of [
    "## Context",
    "## Decision",
    "## Alternatives",
    "## Consequences",
    "## Verification",
    "## Migration And Rollback",
  ]) {
    assertIncludes(source, heading, `${fileName} must contain ${heading}`);
  }

  for (const metadata of ["Status", "Date", "Owners", "Decision Scope", "Supersedes"]) {
    assert.match(source, new RegExp(`> \\*\\*${metadata}:\\*\\*\\s+\\S+`), `${fileName} must define ${metadata}`);
  }

  if (!options.template) {
    assert.match(
      source,
      /> \*\*Status:\*\* (Proposed|Accepted|Superseded|Rejected)\s/m,
      `${fileName} must use an allowed ADR status`,
    );
  }
}

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}

