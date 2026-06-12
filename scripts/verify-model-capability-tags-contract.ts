import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyUpstreamModel,
  inferModelCapabilityTags,
  normalizeCapability,
  parseUpstreamModels,
} from "../apps/api/src/provider-model-catalog.js";

const root = process.cwd();
const modelCoreSource = readFileSync(join(root, "packages", "model-core", "src", "index.ts"), "utf8");
const adminTypesSource = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");
const adminEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

const upstream = parseUpstreamModels(
  {
    data: [
      { id: "Qwen/Qwen3-VL-8B-Instruct" },
      { id: "Qwen/Qwen3-VL-8B-Thinking" },
      { id: "mimo-v2.5-tts" },
      { id: "mimo-v2.5-tts-voiceclone" },
      { id: "suno-v5.5" },
    ],
  },
  "openai",
);

const qwenVlTags = inferModelCapabilityTags("Qwen/Qwen3-VL-8B-Instruct", "chat");
const qwenThinkingTags = inferModelCapabilityTags("Qwen/Qwen3-VL-8B-Thinking", "chat");
const mimoTtsTags = inferModelCapabilityTags("mimo-v2.5-tts", "audio");
const mimoCloneTags = inferModelCapabilityTags("mimo-v2.5-tts-voiceclone", "audio");
const sunoTags = inferModelCapabilityTags("suno-v5.5", "audio");

const checks = [
  {
    name: "model core exposes audio broad capability",
    pass: modelCoreSource.includes('"audio"') && adminTypesSource.includes('"audio"'),
  },
  {
    name: "model core exposes fine-grained capability tags",
    pass:
      modelCoreSource.includes("ModelCapabilityTag") &&
      modelCoreSource.includes('"image_understanding"') &&
      modelCoreSource.includes('"video_understanding"') &&
      modelCoreSource.includes('"voice_clone"'),
  },
  {
    name: "normalizes audio aliases",
    pass:
      normalizeCapability("tts") === "audio" &&
      normalizeCapability("speech") === "audio" &&
      normalizeCapability("voice") === "audio" &&
      normalizeCapability("music") === "audio",
  },
  {
    name: "classifies Qwen VL as chat and MiMo/Suno as audio",
    pass:
      classifyUpstreamModel("Qwen/Qwen3-VL-8B-Instruct") === "chat" &&
      classifyUpstreamModel("mimo-v2.5-tts") === "audio" &&
      classifyUpstreamModel("mimo-v2.5-tts-voiceclone") === "audio" &&
      classifyUpstreamModel("suno-v5.5") === "audio",
  },
  {
    name: "infers Qwen VL visual/video/reasoning tags",
    pass:
      qwenVlTags.includes("image_understanding") &&
      qwenVlTags.includes("video_understanding") &&
      qwenThinkingTags.includes("reasoning"),
  },
  {
    name: "infers MiMo and Suno audio tags",
    pass:
      mimoTtsTags.includes("tts") &&
      mimoCloneTags.includes("tts") &&
      mimoCloneTags.includes("voice_clone") &&
      sunoTags.includes("music_generation"),
  },
  {
    name: "parseUpstreamModels returns audio models and tag map",
    pass:
      upstream.audioModels.includes("mimo-v2.5-tts") &&
      upstream.audioModels.includes("mimo-v2.5-tts-voiceclone") &&
      upstream.audioModels.includes("suno-v5.5") &&
      upstream.modelTags["Qwen/Qwen3-VL-8B-Instruct"]?.includes("image_understanding") &&
      upstream.modelTags["mimo-v2.5-tts-voiceclone"]?.includes("voice_clone"),
  },
  {
    name: "server persists capability tags and test state",
    pass:
      serverSource.includes("capability_tags") &&
      serverSource.includes("test_state") &&
      serverSource.includes("normalizeModelCapabilityTags") &&
      serverSource.includes("normalizeModelTestState"),
  },
  {
    name: "public model catalog exposes capability tags to frontend nodes",
    pass:
      serverSource.includes("async function publicModelCatalog()") &&
      serverSource.includes("const capabilityTags = normalizeModelCapabilityTags(model.capabilityTags, capability, model.modelId);") &&
      serverSource.includes("capabilityTags,"),
  },
  {
    name: "admin model editor exposes manual tag editing",
    pass:
      adminEditorSource.includes("TAG_GROUPS") &&
      adminEditorSource.includes("model-tag-editor") &&
      adminEditorSource.includes("modelCapabilityTagLabel"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Model capability tags contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
