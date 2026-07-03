import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sharedSource = await readFile(new URL("../packages/shared/src/comfyui-workflow.ts", import.meta.url), "utf8");
const normalizer = await readFile(new URL("../apps/api/src/comfyui-workflow-normalizer.ts", import.meta.url), "utf8").catch(() => "");

assert.match(sharedSource, /export interface ComfyuiWorkflowAnalysisResult/);
assert.match(sharedSource, /export interface ComfyuiWorkflowInputSchemaItem/);
assert.match(sharedSource, /export interface ComfyuiWorkflowOutputSchemaItem/);
assert.match(sharedSource, /export interface ComfyuiWorkflowInstanceBinding/);
assert.match(sharedSource, /export function analyzeComfyuiWorkflow/);
assert.match(sharedSource, /export function buildDefaultComfyuiInputSchema/);
assert.match(sharedSource, /export function migrateLegacyComfyuiWorkflowSchema/);
assert.ok(
  /displayTier\?: "primary" \| "secondary" \| "advanced"/.test(sharedSource)
  || /displayTier\?: ComfyuiWorkflowDisplayTier/.test(sharedSource),
  "shared comfyui workflow schema must expose displayTier on input schema items",
);
assert.match(sharedSource, /executionMode\?: ComfyuiWorkflowExecutionMode/);
assert.match(normalizer, /instanceBindings/);
assert.match(normalizer, /displayTier/);

if (!sharedSource.includes("ComfyuiWorkflowInputSchemaItem")) {
  throw new Error("shared schema types must stay exported");
}

if (!normalizer) {
  throw new Error("normalizer file missing");
}

console.log("comfyui workflow parser contract: ok");
