import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedIndexPath = resolve(rootDir, "packages/shared/src/index.ts");
const sharedRunningHubPath = resolve(rootDir, "packages/shared/src/runninghub.ts");
const apiCatalogPath = resolve(rootDir, "apps/api/src/runninghub-catalog.ts");
const apiExecutionDescriptorPath = resolve(rootDir, "apps/api/src/runninghub-execution-descriptor.ts");
const serverPath = resolve(rootDir, "apps/api/src/server.ts");

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
  "export interface RhInputSlotDefinition",
  "export interface RhExecutionDescriptor",
  "export interface RhCatalogItem",
]);

await expectFileContains(apiCatalogPath, [
  "export function normalizeRunningHubCatalogItem",
  "export function toPublicRunningHubCatalogItem",
]);

await expectFileContains(apiExecutionDescriptorPath, [
  "export function buildRunningHubExecutionDescriptor",
]);

await expectFileContains(serverPath, [
  'url.pathname === "/api/admin/runninghub/items"',
  'url.pathname === "/api/runninghub/catalog"',
  'url.pathname.startsWith("/api/runninghub/catalog/")',
]);
