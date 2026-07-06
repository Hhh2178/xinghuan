import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const canvasTokens = await read("docs/systems/canvas/frontend-design/design-tokens.md");
const adminTokens = await read("docs/systems/admin/frontend-design/design-tokens.md");
const canvasReadme = await read("docs/systems/canvas/frontend-design/README.md");
const adminReadme = await read("docs/systems/admin/frontend-design/README.md");

for (const token of [
  "--t8-accent",
  "--t8-bg-panel",
  "Node standard width",
  "Node title",
  "Hover transition",
]) {
  assertIncludes(canvasTokens, token, `canvas design tokens must include ${token}`);
}

for (const token of [
  "--starlight-bg",
  "--starlight-cyan",
  "--admin-page-gap",
  "Navigation icon",
  "Ant Design Pilot Mapping",
]) {
  assertIncludes(adminTokens, token, `admin design tokens must include ${token}`);
}

assertIncludes(canvasReadme, "design-tokens.md", "canvas frontend design README must link design tokens");
assertIncludes(adminReadme, "design-tokens.md", "admin frontend design README must link design tokens");

console.log("design token docs contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
