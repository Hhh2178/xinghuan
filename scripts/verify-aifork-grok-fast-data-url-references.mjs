import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AIFORK_GROK_FAST_REQUEST_CONTRACT,
  isAiforkGrokFastTarget,
  mergeAiforkGrokFastDataUrlReferences,
  summarizeAiforkGrokFastDataUrlReferences,
} from "./configure-aifork-grok-fast-data-url-references.mjs";

const selected = {
  id: "model-grok-fast",
  provider_id: "provider-aifork",
  model_id: "grok-imagine-video-1.5-fast",
  capability: "video",
  input_profile: "prompt,image_reference,multi_image",
  input_capabilities: { prompt: true, imageReference: true, multiImage: true },
  parameter_schema: { referenceImages: { type: "image[]", max: 6 } },
  advanced_config: {
    mode: "async_video_task",
    requestMapping: { ratio: "size", duration: "seconds", images: "images" },
    token: "must-not-be-printed",
  },
};

assert.equal(isAiforkGrokFastTarget(
  { protocol: "aicopy", base_url: "https://api.aicopy.top/v1" },
  selected,
), true);
assert.equal(isAiforkGrokFastTarget(
  { protocol: "aicopy", base_url: "https://another-provider.example/v1" },
  selected,
), false);

const merged = mergeAiforkGrokFastDataUrlReferences(selected);
assert.equal(merged.referenceImageTransport, "data_url");
assert.deepEqual(merged.referenceImageProcessing, { format: "jpeg", maxDimension: 1024, quality: 85 });
assert.equal(merged.requestContractEnabled, true);
assert.deepEqual(merged.requestContract, AIFORK_GROK_FAST_REQUEST_CONTRACT);
assert.deepEqual(merged.requestMapping, selected.advanced_config.requestMapping);
assert.equal(selected.parameter_schema.referenceImages.max, 6);

const second = mergeAiforkGrokFastDataUrlReferences({ ...selected, advanced_config: merged });
assert.deepEqual(second, merged);

const summary = JSON.stringify(summarizeAiforkGrokFastDataUrlReferences(selected, merged));
assert.doesNotMatch(summary, /must-not-be-printed|token|secret|cipher/i);
assert.match(summary, /reference_images/);

const source = await readFile(new URL("./configure-aifork-grok-fast-data-url-references.mjs", import.meta.url), "utf8");
assert.match(source, /XINGHUAN_CONFIG_BACKUP_DIR/);
assert.match(source, /mode:\s*0o600/);
assert.match(source, /safeHost\(provider\?\.base_url\)/);

console.log(JSON.stringify({ ok: true }, null, 2));
