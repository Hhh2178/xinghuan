import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const requiredFiles = [
  "docs/systems/canvas/frontend-design/README.md",
  "docs/systems/canvas/frontend-design/canvas-visual-language.md",
  "docs/systems/canvas/frontend-design/node-design-standard.md",
  "docs/systems/canvas/frontend-design/interaction-and-overlay-standard.md",
  "docs/systems/canvas/frontend-design/component-usage-policy.md",
  "docs/systems/canvas/frontend-design/verification-checklist.md",
  "docs/systems/admin/frontend-design/README.md",
  "docs/systems/admin/frontend-design/component-library-policy.md",
  "docs/systems/admin/frontend-design/layout-and-density-standard.md",
  "docs/systems/admin/frontend-design/form-table-drawer-standard.md",
  "docs/systems/admin/frontend-design/icon-text-alignment-standard.md",
  "docs/systems/admin/frontend-design/verification-checklist.md",
];

const docs = new Map();
for (const file of requiredFiles) {
  docs.set(file, await read(file));
}

assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "node-design-standard.md", "canvas README must link node design standard");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/node-design-standard.md"), "Internal scroll is not the default", "canvas node standard must ban default internal scroll");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "@xinghuan/ui", "canvas component policy must name @xinghuan/ui");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "Do not place raw Ant Design", "canvas policy must keep Ant Design out of nodes");

assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "component-library-policy.md", "admin README must link component policy");
assertIncludes(docs.get("docs/systems/admin/frontend-design/component-library-policy.md"), "Ant Design 6", "admin policy must record Ant Design 6 pilot");
assertIncludes(docs.get("docs/systems/admin/frontend-design/icon-text-alignment-standard.md"), "Icons and text", "admin icon alignment doc must define icon text rule");

const docsIndex = await read("docs/INDEX.md");
const canvasReadme = await read("docs/systems/canvas/README.md");
assertIncludes(docsIndex, "docs/systems/canvas/frontend-design/", "docs index must link canvas visual docs");
assertIncludes(canvasReadme, "docs/systems/canvas/frontend-design/", "canvas README must link visual docs");

console.log("visual design docs contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
