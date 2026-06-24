import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const apiSettingsSource = await readFile(
  new URL("../apps/web/src/components/ApiSettings.tsx", import.meta.url),
  "utf8",
);
const advancedProviderDetailSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsAdvancedProviderDetailPanel.tsx", import.meta.url),
  "utf8",
);
const comfyPanelSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsComfyWorkflowPanel.tsx", import.meta.url),
  "utf8",
);
const modelscopePanelSource = await readFile(
  new URL("../apps/web/src/components/ApiSettingsModelscopeLoraPanel.tsx", import.meta.url),
  "utf8",
);

assert.match(
  apiSettingsSource,
  /from ['"]\.\/ApiSettingsAdvancedProviderDetailPanel['"]/,
  "ApiSettings should import the extracted advanced provider detail panel",
);
assert.match(
  apiSettingsSource,
  /const renderAdvancedProviderForm = \(provider: AdvancedProviderConfig\) => \{\s*return \(\s*<ApiSettingsAdvancedProviderDetailPanel/,
  "ApiSettings should delegate advanced provider detail rendering to the extracted panel",
);
assert.doesNotMatch(
  apiSettingsSource,
  /function AdvancedProviderFormBlock\(/,
  "ApiSettings should no longer keep a local advanced provider form block shell",
);
assert.match(
  advancedProviderDetailSource,
  /from ['"]\.\/ApiSettingsComfyWorkflowPanel['"]/,
  "advanced provider detail panel should reuse the extracted ComfyUI panel",
);
assert.match(
  advancedProviderDetailSource,
  /from ['"]\.\/ApiSettingsModelscopeLoraPanel['"]/,
  "advanced provider detail panel should reuse the extracted ModelScope LoRA panel",
);
assert.match(
  advancedProviderDetailSource,
  /from ['"]\.\/ApiSettingsFormBlock['"]/,
  "advanced provider detail panel should reuse the shared form block shell",
);
assert.match(
  comfyPanelSource,
  /export default function ApiSettingsComfyWorkflowPanel\(/,
  "Comfy workflow panel should export the extracted section component",
);
assert.match(
  modelscopePanelSource,
  /export default function ApiSettingsModelscopeLoraPanel\(/,
  "ModelScope LoRA panel should export the extracted section component",
);

console.log("PASS api settings advanced provider panel split contract");
