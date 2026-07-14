import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiSettingsSource = await readFile(
  new URL("../apps/admin/src/admin-api-settings-panel.tsx", import.meta.url),
  "utf8",
);
const modelEditorSource = await readFile(
  new URL("../apps/admin/src/admin-model-editor.tsx", import.meta.url),
  "utf8",
);

assert.match(apiSettingsSource, /providerProtocol=\{draft\.protocol\}/);
assert.match(modelEditorSource, /providerProtocol:\s*ProviderProtocol/);
assert.match(modelEditorSource, /providerProtocol=\{providerProtocol\}/);
assert.match(modelEditorSource, /providerProtocol === "aicopy"\s*&&\s*draft\.capability === "video"/);
assert.match(modelEditorSource, /resolveAicopyRequestContractEnabled/);
assert.match(modelEditorSource, /aicopyRequestContractEnabled/);
assert.match(modelEditorSource, /启用 SD 补充请求契约/);
assert.match(modelEditorSource, /isAicopyVideoModel\s*&&\s*aicopyRequestContractEnabled/);
assert.match(modelEditorSource, /capability === "audio" \|\| capability === "video"/);

console.log(JSON.stringify({ ok: true }, null, 2));
