import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const canvasVisual = await read("docs/systems/canvas/frontend-design/visual-component-registry.md");
const canvasFunctional = await read("docs/systems/canvas/frontend-design/functional-component-registry.md");
const nodePatterns = await read("docs/systems/canvas/frontend-design/node-composition-patterns.md");
const dedupeMap = await read("docs/systems/canvas/frontend-design/rh-comfyui-deduplication-map.md");
const adminVisual = await read("docs/systems/admin/frontend-design/visual-component-registry.md");
const adminFunctional = await read("docs/systems/admin/frontend-design/functional-component-registry.md");
const antPilotMap = await read("docs/systems/admin/frontend-design/ant-design-pilot-component-map.md");
const canvasReadme = await read("docs/systems/canvas/frontend-design/README.md");
const adminReadme = await read("docs/systems/admin/frontend-design/README.md");

for (const item of ["CanvasNodeShell", "CanvasParamRow", "CanvasRuntimeCard"]) {
  assertIncludes(canvasVisual, item, `canvas visual registry must include ${item}`);
}

for (const item of ["MachineWorkflowSelector", "ExposedParameterEditor", "GeneratedOutputSummary"]) {
  assertIncludes(canvasFunctional, item, `canvas functional registry must include ${item}`);
}

assertIncludes(nodePatterns, "Provider Workflow Node", "node composition patterns must include Provider Workflow Node");
assertIncludes(dedupeMap, "RunningHubNodeParamSection.tsx", "dedupe map must mention RH param section");
assertIncludes(dedupeMap, "ComfyUINodeParamSection.tsx", "dedupe map must mention ComfyUI param section");
assertIncludes(dedupeMap, "does not resume ComfyUI development", "dedupe map must keep ComfyUI feature work frozen");

for (const item of ["AdminTable", "AdminFormPanel", "AdminConfirmDialog"]) {
  assertIncludes(adminVisual, item, `admin visual registry must include ${item}`);
}

for (const item of ["WorkflowInputOutputMapper", "PermissionMatrixEditor", "ResourceUploadDropzone"]) {
  assertIncludes(adminFunctional, item, `admin functional registry must include ${item}`);
}

assertIncludes(antPilotMap, "does not install Ant Design", "Ant Design pilot map must avoid dependency installation");

for (const link of [
  "visual-component-registry.md",
  "functional-component-registry.md",
  "node-composition-patterns.md",
  "rh-comfyui-deduplication-map.md",
]) {
  assertIncludes(canvasReadme, link, `canvas README must link ${link}`);
}

for (const link of [
  "visual-component-registry.md",
  "functional-component-registry.md",
  "ant-design-pilot-component-map.md",
]) {
  assertIncludes(adminReadme, link, `admin README must link ${link}`);
}

console.log("component registry docs contract: ok");

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(source, needle, message) {
  assert.equal(String(source).includes(needle), true, message);
}
