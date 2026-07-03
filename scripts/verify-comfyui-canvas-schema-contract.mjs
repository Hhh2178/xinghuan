import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const comfyApps = await readFile(new URL("../apps/web/src/utils/comfyuiApps.ts", import.meta.url), "utf8");
assert.match(comfyApps, /inputSchema/, "catalog workflow builder must consume inputSchema");
assert.match(comfyApps, /mode (===|!==) 'param'|mode (===|!==) \"param\"/, "catalog workflow builder must filter param rows");
assert.match(comfyApps, /mode (===|!==) 'upstream'|mode (===|!==) \"upstream\"/, "catalog workflow builder must derive upstream requirements from schema");

const nodeSource = await readFile(new URL("../apps/web/src/components/nodes/ComfyUIApplicationNode.tsx", import.meta.url), "utf8");
assert.match(nodeSource, /\boutputs\b/, "canvas node must consume named outputs");

console.log("comfyui canvas schema contract: ok");
