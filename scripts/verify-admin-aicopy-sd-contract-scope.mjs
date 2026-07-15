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
const videoReferenceSource = await readFile(
  new URL("../apps/admin/src/admin-model-editor-video-reference.ts", import.meta.url),
  "utf8",
);

assert.match(apiSettingsSource, /providerProtocol=\{draft\.protocol\}/);
assert.match(modelEditorSource, /providerProtocol:\s*ProviderProtocol/);
assert.match(modelEditorSource, /providerProtocol=\{providerProtocol\}/);
assert.match(modelEditorSource, /providerProtocol === "aicopy"\s*&&\s*draft\.capability === "video"/);
assert.match(modelEditorSource, /resolveAicopyRequestContractEnabled/);
assert.match(modelEditorSource, /resolveAicopySdRequestContractEnabled/);
assert.match(modelEditorSource, /isAicopySdContractModelId/);
assert.match(modelEditorSource, /mergeAicopySdRequestContractDefaults/);
assert.match(modelEditorSource, /aicopyRequestContractEnabled/);
assert.match(modelEditorSource, /启用 SD 补充请求契约/);
assert.match(modelEditorSource, /isAicopySdVideoModel\s*&&\s*aicopyRequestContractEnabled/);
assert.match(modelEditorSource, /advancedConfig\s*=\s*mergeAicopySdRequestContractDefaults\(advancedConfig\)/);
assert.match(modelEditorSource, /capability === "audio" \|\| capability === "video"/);
assert.match(modelEditorSource, /"参考图模式"/);
assert.match(modelEditorSource, /最大参考图数量/);
assert.match(modelEditorSource, /参考图传输方式/);
assert.match(modelEditorSource, /Data URL/);
assert.match(modelEditorSource, /syncVideoReferenceImageTransport/);
assert.match(modelEditorSource, /referenceImages/);
assert.match(modelEditorSource, /readVideoReferenceImageMax/);
assert.match(videoReferenceSource, /Math\.min\(MAX_REFERENCE_IMAGES/);
assert.doesNotMatch(modelEditorSource, /inputCapabilities\.imageReference \|\| capability === "image" \|\| capability === "video"/);
const multiImageStart = modelEditorSource.indexOf('key: "multiImage"');
const multiImageEnd = modelEditorSource.indexOf('key: "firstFrame"', multiImageStart);
assert.ok(multiImageStart >= 0 && multiImageEnd > multiImageStart);
const multiImageBlock = modelEditorSource.slice(multiImageStart, multiImageEnd);
assert.match(multiImageBlock, /visible: capability === "image"/);
assert.doesNotMatch(multiImageBlock, /capability === "video"/);

console.log(JSON.stringify({ ok: true }, null, 2));
