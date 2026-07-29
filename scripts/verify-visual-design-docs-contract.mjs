import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const requiredFiles = [
  "DESIGN.md",
  "docs/systems/canvas/frontend-design/README.md",
  "docs/systems/canvas/frontend-design/canvas-visual-language.md",
  "docs/systems/canvas/frontend-design/design-tokens.md",
  "docs/systems/canvas/frontend-design/visual-component-registry.md",
  "docs/systems/canvas/frontend-design/functional-component-registry.md",
  "docs/systems/canvas/frontend-design/node-design-standard.md",
  "docs/systems/canvas/frontend-design/node-composition-patterns.md",
  "docs/systems/canvas/frontend-design/interaction-and-overlay-standard.md",
  "docs/systems/canvas/frontend-design/component-usage-policy.md",
  "docs/systems/canvas/frontend-design/rh-comfyui-deduplication-map.md",
  "docs/systems/canvas/frontend-design/verification-checklist.md",
  "docs/systems/admin/frontend-design/README.md",
  "docs/systems/admin/frontend-design/visual-foundation.md",
  "docs/systems/admin/frontend-design/admin-page-visual-audit.md",
  "docs/systems/admin/frontend-design/redesign-program.md",
  "docs/systems/admin/frontend-design/design-tokens.md",
  "docs/systems/admin/frontend-design/visual-component-registry.md",
  "docs/systems/admin/frontend-design/functional-component-registry.md",
  "docs/systems/admin/frontend-design/component-library-policy.md",
  "docs/systems/admin/frontend-design/ant-design-pilot-component-map.md",
  "docs/systems/admin/frontend-design/layout-and-density-standard.md",
  "docs/systems/admin/frontend-design/form-table-drawer-standard.md",
  "docs/systems/admin/frontend-design/icon-text-alignment-standard.md",
  "docs/systems/admin/frontend-design/verification-checklist.md",
  "docs/systems/admin/frontend-design/system-health-visualization-standard.md",
];

const docs = new Map();
for (const file of requiredFiles) {
  docs.set(file, await read(file));
}

assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "node-design-standard.md", "canvas README must link node design standard");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "design-tokens.md", "canvas README must link design tokens");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "visual-component-registry.md", "canvas README must link visual component registry");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "functional-component-registry.md", "canvas README must link functional component registry");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/README.md"), "node-composition-patterns.md", "canvas README must link node composition patterns");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/node-design-standard.md"), "Internal scroll is not the default", "canvas node standard must ban default internal scroll");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "@xinghuan/ui", "canvas component policy must name @xinghuan/ui");
assertIncludes(docs.get("docs/systems/canvas/frontend-design/component-usage-policy.md"), "Do not place raw Ant Design", "canvas policy must keep Ant Design out of nodes");

assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "component-library-policy.md", "admin README must link component policy");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "visual-foundation.md", "admin README must link visual foundation");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "admin-page-visual-audit.md", "admin README must link visual audit");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "redesign-program.md", "admin README must link redesign program");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "design-tokens.md", "admin README must link design tokens");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "visual-component-registry.md", "admin README must link visual component registry");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "functional-component-registry.md", "admin README must link functional component registry");
assertIncludes(docs.get("docs/systems/admin/frontend-design/README.md"), "system-health-visualization-standard.md", "admin README must link system health visualization standard");
assertIncludes(docs.get("docs/systems/admin/frontend-design/component-library-policy.md"), "Ant Design 6", "admin policy must record Ant Design 6 pilot");
assertIncludes(docs.get("docs/systems/admin/frontend-design/icon-text-alignment-standard.md"), "Icons and text", "admin icon alignment doc must define icon text rule");
assertIncludes(docs.get("DESIGN.md"), "异常先于装饰", "root design source must define the anomaly-first principle");
assertIncludes(docs.get("DESIGN.md"), "system-health-visualization-standard.md", "root design source must route system health visualization");
assertIncludes(docs.get("docs/systems/admin/frontend-design/system-health-visualization-standard.md"), "Data Correctness Contract", "system health visualization standard must define data correctness");
assertIncludes(docs.get("docs/systems/admin/frontend-design/system-health-visualization-standard.md"), "Performance Budget", "system health visualization standard must define a performance budget");
assertIncludes(docs.get("docs/systems/admin/frontend-design/visual-foundation.md"), "渐变不得表达状态", "admin visual foundation must keep gradients out of state semantics");
assertIncludes(docs.get("docs/systems/admin/frontend-design/admin-page-visual-audit.md"), "任务与运行", "admin visual audit must cover runtime workspace");
assertIncludes(docs.get("docs/systems/admin/frontend-design/redesign-program.md"), "发布顺序", "admin redesign program must define rollout order");

const docsIndex = await read("docs/INDEX.md");
const canvasReadme = await read("docs/systems/canvas/README.md");
assertIncludes(docsIndex, "docs/systems/canvas/frontend-design/", "docs index must link canvas visual docs");
assertIncludes(docsIndex, "docs/systems/admin/frontend-design/", "docs index must link admin visual docs");
assertIncludes(canvasReadme, "docs/systems/canvas/frontend-design/", "canvas README must link visual docs");

console.log("visual design docs contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
