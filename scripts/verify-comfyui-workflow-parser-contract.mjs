import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../packages/shared/src/comfyui-workflow.ts", import.meta.url), "utf8");

assert.match(source, /export interface ComfyuiWorkflowAnalysisResult/);
assert.match(source, /export interface ComfyuiWorkflowInputSchemaItem/);
assert.match(source, /export interface ComfyuiWorkflowOutputSchemaItem/);
assert.match(source, /export function analyzeComfyuiWorkflow/);
assert.match(source, /export function buildDefaultComfyuiInputSchema/);
assert.match(source, /export function migrateLegacyComfyuiWorkflowSchema/);

console.log("comfyui workflow parser contract: ok");
