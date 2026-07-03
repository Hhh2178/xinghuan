import { readFile } from "node:fs/promises";

const service = await readFile(new URL("../apps/web/src/services/comfyuiApps.ts", import.meta.url), "utf8");
const node = await readFile(new URL("../apps/web/src/components/nodes/ComfyUIApplicationNode.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../apps/api/src/comfyui-public-routes.ts", import.meta.url), "utf8");

if (!service.includes("sharedWorkflowId")) {
  throw new Error("sharedWorkflowId missing from service contract");
}

if (service.includes("app.id)}/run")) {
  throw new Error("legacy app.id run path still present");
}

if (node.includes("entry.app.id === activeWorkflowId")) {
  throw new Error("legacy app.id selection still present");
}

if (!node.includes("entry.workflow.sharedWorkflowId === activeWorkflowId")) {
  throw new Error("node must prefer sharedWorkflowId when resolving active entry");
}

if (!route.includes('item.id === workflowRef || item.sharedWorkflowId === workflowRef')) {
  throw new Error("Expected backend route to match canonical workflow ids");
}

console.log(JSON.stringify({ ok: true, stage: "green", problem: "shared-workflow-id-aligned" }, null, 2));
