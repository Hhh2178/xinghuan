import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const comfyApps = await readFile(new URL("../apps/web/src/utils/comfyuiApps.ts", import.meta.url), "utf8");
assert.match(comfyApps, /inputSchema/, "catalog workflow builder must consume inputSchema");
assert.match(comfyApps, /mode (===|!==) 'param'|mode (===|!==) \"param\"/, "catalog workflow builder must filter param rows");
assert.match(comfyApps, /mode (===|!==) 'upstream'|mode (===|!==) \"upstream\"/, "catalog workflow builder must derive upstream requirements from schema");
assert.match(comfyApps, /displayTier/, "catalog workflow builder should preserve parameter display tiers");

const nodeSource = await readFile(new URL("../apps/web/src/components/nodes/ComfyUIApplicationNode.tsx", import.meta.url), "utf8");
assert.match(nodeSource, /\boutputs\b/, "canvas node must consume named outputs");
assert.match(nodeSource, /comfyuiWorkflowId/, "canvas node must persist the canonical comfyui workflow id field");
assert.match(nodeSource, /sharedWorkflowId/, "canvas node must persist the canonical shared workflow id field");
assert.match(nodeSource, /comfyuiInstanceId/, "canvas node must persist the selected machine id");
assert.match(nodeSource, /运行 comfyui/, "canvas node UI must present the unified comfyui run action");

const canvasTypes = await readFile(new URL("../apps/web/src/types/canvas.ts", import.meta.url), "utf8");
assert.match(canvasTypes, /instanceBindings/, "canvas comfyui catalog types must include machine bindings");
assert.match(canvasTypes, /displayTier\?: 'primary' \| 'secondary' \| 'advanced'/, "canvas comfyui input schema types must include display tiers");

console.log("comfyui canvas schema contract: ok");
