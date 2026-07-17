import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const rootPackage = JSON.parse(await read("package.json"));
const harnessReadme = await read("docs/systems/harness/README.md");
const harnessMap = await read("docs/systems/harness/workspace-verify-release-map.md");
const preCommit = await read("scripts/pre-commit-governance.mjs");

const scripts = rootPackage.scripts ?? {};

for (const [name, command] of Object.entries({
  "verify:documentation-entry-contract": "node scripts/verify-documentation-entry-contract.mjs",
  "verify:domain-context-and-adr-contract": "node scripts/verify-domain-context-and-adr-contract.mjs",
  "verify:generation-artifact-framework-contract": "node scripts/verify-generation-artifact-framework-contract.mjs",
  "verify:visual-design-docs-contract": "node scripts/verify-visual-design-docs-contract.mjs",
  "verify:design-token-docs-contract": "node scripts/verify-design-token-docs-contract.mjs",
  "verify:component-registry-docs-contract": "node scripts/verify-component-registry-docs-contract.mjs",
  "verify:system-doc-template-contract": "node scripts/verify-system-doc-template-contract.mjs",
  "verify:harness-doc-sync-contract": "node scripts/verify-harness-doc-sync-contract.mjs",
})) {
  assert.equal(scripts[name], command, `${name} must be exposed in package.json`);
  assertIncludes(harnessReadme, name, `harness README must mention ${name}`);
  assertIncludes(harnessMap, name, `harness map must mention ${name}`);
}

for (const scriptFile of [
  "verify-documentation-entry-contract.mjs",
  "verify-domain-context-and-adr-contract.mjs",
  "verify-generation-artifact-framework-contract.mjs",
  "verify-visual-design-docs-contract.mjs",
  "verify-system-doc-template-contract.mjs",
]) {
  assertIncludes(preCommit, scriptFile, `pre-commit governance must run ${scriptFile}`);
}

assertIncludes(
  scripts["harness:verify:project"],
  "verify:harness-doc-sync-contract",
  "project harness chain must include harness doc sync contract",
);
assertIncludes(
  scripts["harness:verify:project"],
  "verify:design-token-docs-contract",
  "project harness chain must include design token docs contract",
);
assertIncludes(
  scripts["harness:verify:project"],
  "verify:component-registry-docs-contract",
  "project harness chain must include component registry docs contract",
);
assertIncludes(
  scripts["harness:verify:project"],
  "verify:canvas-workflow-capabilities-contract",
  "project harness chain must include canvas workflow capabilities contract",
);

console.log("harness doc sync contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
