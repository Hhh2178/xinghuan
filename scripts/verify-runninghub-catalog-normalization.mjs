import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedIndexPath = resolve(rootDir, "packages/shared/src/index.ts");
const sharedRunningHubPath = resolve(rootDir, "packages/shared/src/runninghub.ts");
const apiCatalogPath = resolve(rootDir, "apps/api/src/runninghub-catalog.ts");
const apiExecutionDescriptorPath = resolve(rootDir, "apps/api/src/runninghub-execution-descriptor.ts");
const serverPath = resolve(rootDir, "apps/api/src/server.ts");
const apiCatalogDistPath = resolve(rootDir, "apps/api/dist/runninghub-catalog.js");

async function expectFileContains(filePath, snippets) {
  const source = await readFile(filePath, "utf8");
  for (const snippet of snippets) {
    assert.ok(
      source.includes(snippet),
      `${filePath} is missing required snippet: ${snippet}`,
    );
  }
}

await expectFileContains(sharedIndexPath, [
  'export * from "./runninghub.js";',
]);

await expectFileContains(sharedRunningHubPath, [
  'export type RhSlotDataType = "text" | "image" | "video" | "audio" | "json";',
  "export interface RhInputSlotDefinition",
  "dataType: RhSlotDataType;",
  'cardinality: "single" | "multiple";',
  "supportsConnection: boolean;",
  "supportsManualInput: boolean;",
  "supportsUpload: boolean;",
  "bindingTarget:",
  "export interface RhExecutionDescriptor",
  "submit:",
  "assetHandling:",
  "polling:",
  "result:",
  "errorHandling:",
  "export interface RhCatalogItem",
  "inputSlots: RhInputSlotDefinition[];",
]);

await expectFileContains(apiCatalogPath, [
  "export function normalizeRunningHubCatalogItem",
  "export function toPublicRunningHubCatalogItem",
  "inputSlots:",
  "execution:",
  "fields:",
  'call-api/api-detail/',
]);

await expectFileContains(apiExecutionDescriptorPath, [
  "export function buildRunningHubExecutionDescriptor",
  'const appId = kind === "app"',
  'const workflowId = kind === "workflow"',
  "submit:",
  "assetHandling:",
  "polling:",
  "result:",
  "errorHandling:",
]);

await expectFileContains(serverPath, [
  'url.pathname === "/api/admin/runninghub/items"',
  'url.pathname === "/api/runninghub/catalog"',
  'url.pathname.startsWith("/api/runninghub/catalog/")',
  "function assertRunningHubTargetConsistency",
  "当前条目已识别为 AI 应用，不能继续保留 workflowId",
  "当前条目已识别为工作流，不能继续保留 appId",
]);

const { normalizeRunningHubCatalogItem, toPublicRunningHubCatalogItem } = await import(pathToFileURL(apiCatalogDistPath).href);

const sampleLegacyEntry = normalizeRunningHubCatalogItem({
  id: "/run/workflow/wf-123456",
  title: "Legacy workflow",
  enabled: true,
  workflowJson: "{\"nodes\":[]}",
  fields: [
    {
      nodeId: "node-image",
      fieldName: "image_url",
      label: "Image",
      fieldType: "image",
      valueType: "image",
      required: true,
    },
  ],
}, "workflow");

assert.ok(sampleLegacyEntry, "sample legacy RH entry should normalize");

const publicItem = toPublicRunningHubCatalogItem({
  id: "runninghub-main",
  name: "RunningHub",
  baseUrl: "https://www.runninghub.cn",
}, sampleLegacyEntry);

assert.ok(Array.isArray(publicItem.inputSlots), "public RH item should expose inputSlots");
assert.equal(publicItem.inputSlots.length, 1, "public RH item should include normalized slots");
assert.equal(publicItem.inputSlots[0].dataType, "image", "slot should infer image data type");
assert.ok(Array.isArray(publicItem.fields), "public RH item should preserve legacy fields compatibility");
assert.equal(publicItem.runTargetId, "wf-123456", "public RH item should preserve runTargetId");
assert.ok(publicItem.execution.submit, "execution descriptor should include submit");
assert.ok(publicItem.execution.assetHandling, "execution descriptor should include assetHandling");
assert.ok(publicItem.execution.polling, "execution descriptor should include polling");
assert.ok(publicItem.execution.result, "execution descriptor should include result");
assert.ok(publicItem.execution.errorHandling, "execution descriptor should include errorHandling");
