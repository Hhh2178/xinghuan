import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const nodeRegistry = await readFile(
  new URL("../apps/web/src/config/nodeRegistry.ts", import.meta.url),
  "utf8",
);
const canvasSource = await readFile(
  new URL("../apps/web/src/components/Canvas.tsx", import.meta.url),
  "utf8",
);
const portTypes = await readFile(
  new URL("../apps/web/src/config/portTypes.ts", import.meta.url),
  "utf8",
);
const comfyNode = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUINode.tsx", import.meta.url),
  "utf8",
);
const comfyNodeShell = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUIApplicationNode.tsx", import.meta.url),
  "utf8",
);
const comfySelectorSection = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUINodeSelectorSection.tsx", import.meta.url),
  "utf8",
);
const comfyParamSection = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUINodeParamSection.tsx", import.meta.url),
  "utf8",
);
const comfyRunSection = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUINodeRunSection.tsx", import.meta.url),
  "utf8",
);
const comfyOutputSummarySection = await readFile(
  new URL("../apps/web/src/components/nodes/ComfyUINodeOutputSummarySection.tsx", import.meta.url),
  "utf8",
);

assert.match(
  nodeRegistry,
  /type: 'comfyui', label: 'comfyui'/,
  "node registry must expose exactly one visible comfyui entry",
);
assert.match(
  nodeRegistry,
  /type: 'comfyui-app'.*hidden: true/s,
  "legacy comfyui-app entry must stay hidden",
);
assert.match(
  nodeRegistry,
  /type: 'comfyui-store'.*hidden: true/s,
  "legacy comfyui-store entry must stay hidden",
);
assert.match(
  nodeRegistry,
  /type: 'comfyui-app-maker'.*hidden: true/s,
  "legacy comfyui-app-maker entry must stay hidden",
);
assert.match(
  canvasSource,
  /comfyui: ComfyUINode/,
  "canvas must register the unified comfyui node",
);
assert.match(
  canvasSource,
  /comfyui: \{/,
  "canvas must define default data for the unified comfyui node",
);
assert.match(
  portTypes,
  /comfyui: \{ inputs: \['text', 'image', 'video', 'audio'\], outputs: \['text', 'image', 'video', 'audio'\] \}/,
  "port registry must expose unified comfyui IO",
);
assert.match(
  comfyNode,
  /ComfyUIApplicationNode/,
  "unified comfyui node file must resolve to the shared runtime implementation",
);
assert.match(
  comfyNodeShell,
  /ComfyUINodeSelectorSection/,
  "unified comfyui shell must compose the selector section",
);
assert.match(
  comfyNodeShell,
  /ComfyUINodeParamSection/,
  "unified comfyui shell must compose the parameter section",
);
assert.match(
  comfyNodeShell,
  /ComfyUINodeRunSection/,
  "unified comfyui shell must compose the runtime section",
);
assert.match(
  comfyNodeShell,
  /ComfyUINodeOutputSummarySection/,
  "unified comfyui shell must compose the output summary section",
);
assert.match(
  comfySelectorSection,
  /机器/,
  "selector section must expose the machine label",
);
assert.match(
  comfySelectorSection,
  /工作流/,
  "selector section must expose the workflow label",
);
assert.ok(
  comfySelectorSection.indexOf("机器") < comfySelectorSection.indexOf("工作流"),
  "selector section must render machine selection before workflow selection",
);
assert.doesNotMatch(
  comfyNodeShell,
  /overflow-auto/,
  "unified comfyui shell must not use an internal scroll container",
);
assert.doesNotMatch(
  comfyNodeShell,
  /height:\s*size\.h/,
  "unified comfyui shell must not hard-lock node height to a stored size",
);
assert.match(
  comfyNodeShell,
  /selectedMachineId[\s\S]*selectedWorkflowId/,
  "unified comfyui shell must derive workflow selection under the selected machine context",
);
assert.doesNotMatch(
  comfyNodeShell,
  /ArrowLeft/,
  "unified comfyui shell must not keep return-to-list behavior",
);
assert.match(
  comfyParamSection,
  /核心参数/,
  "parameter section must expose the primary parameter group",
);
assert.match(
  comfyRunSection,
  /运行 comfyui/,
  "runtime section must expose the comfyui run action",
);
assert.match(
  comfyOutputSummarySection,
  /输出摘要/,
  "output summary section must expose a lightweight result summary",
);

console.log("comfyui unified node contract: ok");
