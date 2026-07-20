import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  mergeAicopySdModelConfig,
  summarizeAicopySdModelChange,
} from "./configure-aicopy-sd-model-capabilities.mjs";

const selected = {
  id: "model-sd",
  provider_id: "provider-aicopy",
  model_id: "sd2-720p-fast",
  capability: "video",
  input_profile: "prompt",
  input_capabilities: { prompt: true },
  parameter_schema: {
    aspectRatio: { type: "select", options: ["16:9", "9:16"], default: "9:16" },
  },
  advanced_config: {
    apiKeyCipher: "must-not-be-printed",
    requestContract: {
      bindings: [{ path: "custom.trace", value: true, type: "boolean" }],
      resultPaths: ["custom.output"],
    },
  },
};
const untouched = structuredClone({ ...selected, id: "model-grok", model_id: "grok-imagine-video-1.5-preview" });

const merged = mergeAicopySdModelConfig(selected);
assert.equal(merged.inputCapabilities.firstFrame, true);
assert.equal(merged.inputCapabilities.lastFrame, true);
assert.equal(merged.inputCapabilities.audioReference, true);
assert.equal(merged.parameterSchema.referenceImages.max, 9);
assert.equal(merged.parameterSchema.referenceAudio.max, 3);
assert.equal(merged.parameterSchema.duration.default, 15);
assert.equal(merged.advancedConfig.aicopyRequestContractEnabled, true);
assert.equal(merged.advancedConfig.requestContract.bindings.find((item) => item.path === "metadata.enableSound")?.value, "on");
assert.equal(merged.advancedConfig.requestContract.bindings.some((item) => item.path === "custom.trace"), true);
assert.equal(merged.advancedConfig.requestContract.resultPaths.includes("custom.output"), true);
assert.deepEqual(untouched, { ...selected, id: "model-grok", model_id: "grok-imagine-video-1.5-preview" });

const second = mergeAicopySdModelConfig({
  ...selected,
  input_profile: merged.inputProfile,
  input_capabilities: merged.inputCapabilities,
  parameter_schema: merged.parameterSchema,
  advanced_config: merged.advancedConfig,
});
assert.deepEqual(second, merged);

const perRequest = mergeAicopySdModelConfig({
  ...selected,
  model_id: "sd-720-fast-渠道9:16（按次）",
}, { profile: "sd2-per-request" });
assert.equal(perRequest.inputCapabilities.videoReference, true);
assert.equal(perRequest.parameterSchema.referenceVideos.max, 3);
assert.deepEqual(
  perRequest.advancedConfig.requestContract.bindings.map((item) => item.path),
  ["input.prompt", "input.media", "seconds", "size", "custom.trace"],
);
assert.equal(perRequest.advancedConfig.requestContract.bindings.find((item) => item.path === "size")?.value, "720x1280");

const channel431 = mergeAicopySdModelConfig({
  ...selected,
  model_id: "sd-720-fast-渠道2（按秒）",
}, { profile: "sd-channel-431" });
assert.deepEqual(
  channel431.advancedConfig.requestContract.bindings.map((item) => item.path),
  [
    "duration",
    "video_config.aspect_ratio",
    "video_config.resolution_name",
    "video_config.reference_mode",
    "reference_images",
    "input.prompt",
    "input.media",
    "custom.trace",
  ],
);

const summary = JSON.stringify(summarizeAicopySdModelChange(selected, merged));
assert.doesNotMatch(summary, /must-not-be-printed|apiKey|cipher/i);

const configuratorSource = await readFile(new URL("./configure-aicopy-sd-model-capabilities.mjs", import.meta.url), "utf8");
assert.match(configuratorSource, /XINGHUAN_CONFIG_BACKUP_DIR/);
assert.match(configuratorSource, /mode:\s*0o600/);
assert.match(configuratorSource, /backupPath/);

console.log(JSON.stringify({ ok: true }, null, 2));
