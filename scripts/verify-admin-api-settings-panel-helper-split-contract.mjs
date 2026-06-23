import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const panelSource = await readFile(
  new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url),
  "utf8",
);
const helperSource = await readFile(
  new URL("../apps/admin/src/admin-api-settings-panel-helpers.ts", import.meta.url),
  "utf8",
);

assert.match(
  panelSource,
  /from ['"]\.\/admin-api-settings-panel-helpers['"]/,
  "ApiSettingsPanel should import extracted helpers from admin-api-settings-panel-helpers",
);

for (const symbol of [
  "providerDraft",
  "inferProviderProtocol",
  "buildProviderAssistantAttachments",
  "buildAssistantIntegrationPlan",
  "formatAssistantRawOutput",
  "defaultInputProfileForCapability",
  "defaultInputCapabilitiesForCapability",
  "safeAssistantSchemaText",
  "parseAssistantDocUrls",
]) {
  assert.match(
    helperSource,
    new RegExp(`export\\s+(?:function|const)\\s+${symbol}\\b`),
    `helper file should export ${symbol}`,
  );
}

assert.doesNotMatch(panelSource, /function providerDraft\(/);
assert.doesNotMatch(panelSource, /function inferProviderProtocol\(/);
assert.doesNotMatch(panelSource, /function buildProviderAssistantAttachments\(/);
assert.doesNotMatch(panelSource, /function buildAssistantIntegrationPlan\(/);
assert.doesNotMatch(panelSource, /function formatAssistantRawOutput\(/);
assert.doesNotMatch(panelSource, /function defaultInputProfileForCapability\(/);
assert.doesNotMatch(panelSource, /function defaultInputCapabilitiesForCapability\(/);
assert.doesNotMatch(panelSource, /function safeAssistantSchemaText\(/);
assert.doesNotMatch(panelSource, /function parseAssistantDocUrls\(/);

console.log("PASS admin api settings panel helper split contract");
