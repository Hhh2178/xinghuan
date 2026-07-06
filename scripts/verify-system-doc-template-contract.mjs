import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const template = await read("docs/systems/interface-documentation-template.md");
const systemsReadme = await read("docs/systems/README.md");

for (const section of [
  "## Responsibility",
  "## Public Interfaces",
  "## Data Model",
  "## Runtime Flow",
  "## Permissions And Roles",
  "## Verification",
  "## Agent Verified",
  "## User Acceptance Required",
]) {
  assertIncludes(template, section, `template must include ${section}`);
}

assertIncludes(systemsReadme, "docs/systems/interface-documentation-template.md", "systems README must link interface template");

console.log("system doc template contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(source.includes(needle), true, message);
}
