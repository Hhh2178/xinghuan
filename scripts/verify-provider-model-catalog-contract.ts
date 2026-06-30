import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyUpstreamModel,
  normalizeProviderProtocol,
  parseUpstreamModels,
  providerModelHeaders,
  providerModelsUrl,
} from "../apps/api/src/provider-model-catalog.js";

const root = process.cwd();
const modulePath = join(root, "apps", "api", "src", "provider-model-catalog.ts");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");

const mixedRaw = {
  data: [
    { id: "gpt-4.1-mini" },
    { id: "gpt-image-2" },
    { id: "seedance-pro-i2v" },
    { name: "Tongyi-MAI/Z-Image-Turbo" },
    { model: "veo3-fast" },
    "qwen-image-edit",
    "gpt-4.1-mini",
    "",
  ],
};

const geminiRaw = {
  models: [
    { name: "models/gemini-2.5-flash" },
    { name: "models/imagen-4.0-generate-preview" },
    { name: "models/veo-3.0-generate-preview" },
  ],
};

const mixed = parseUpstreamModels(mixedRaw, "openai");
const gemini = parseUpstreamModels(geminiRaw, "gemini");

const checks = [
  {
    name: "provider model catalog helper module exists",
    pass: existsSync(modulePath),
  },
  {
    name: "server imports provider model catalog helpers",
    pass: serverSource.includes('from "./provider-model-catalog.js"'),
  },
  {
    name: "server does not inline upstream model parser",
    pass: !/function\s+parseUpstreamModels\s*\(/.test(serverSource) && !/function\s+classifyUpstreamModel\s*\(/.test(serverSource),
  },
  {
    name: "normalizes provider protocols",
    pass:
      normalizeProviderProtocol("llm") === "openai" &&
      normalizeProviderProtocol("gemini") === "gemini" &&
      normalizeProviderProtocol("grsai_draw") === "grsai_draw" &&
      normalizeProviderProtocol("aicopy") === "aicopy",
  },
  {
    name: "builds protocol-specific model URLs",
    pass:
      providerModelsUrl("https://api.example.com", "openai") === "https://api.example.com/v1/models" &&
      providerModelsUrl("https://api.example.com/v1", "openai") === "https://api.example.com/v1/models" &&
      providerModelsUrl("https://generativelanguage.googleapis.com", "gemini") === "https://generativelanguage.googleapis.com/v1beta/models" &&
      providerModelsUrl("https://volc.example.com", "volcengine") === "https://volc.example.com/api/v3/models" &&
      providerModelsUrl("https://runninghub.example.com", "runninghub") === "https://runninghub.example.com/openapi/v2/models" &&
      providerModelsUrl("https://api.grsai.com", "grsai_draw") === "",
  },
  {
    name: "builds protocol-specific auth headers",
    pass:
      providerModelHeaders("abc", "openai").authorization === "Bearer abc" &&
      providerModelHeaders("Bearer abc", "openai").authorization === "Bearer abc" &&
      providerModelHeaders("abc", "gemini")["x-goog-api-key"] === "abc" &&
      providerModelHeaders("Bearer rh-key", "runninghub").authorization === "rh-key",
  },
  {
    name: "classifies upstream model ids",
    pass:
      classifyUpstreamModel("gpt-4.1-mini") === "chat" &&
      classifyUpstreamModel("gpt-image-2") === "image" &&
      classifyUpstreamModel("Tongyi-MAI/Z-Image-Turbo") === "image" &&
      classifyUpstreamModel("seedance-pro-i2v") === "video" &&
      classifyUpstreamModel("veo3-fast") === "video",
  },
  {
    name: "parses and groups OpenAI-compatible model lists",
    pass:
      mixed.total === 6 &&
      mixed.all.join("|") === "Tongyi-MAI/Z-Image-Turbo|gpt-4.1-mini|gpt-image-2|qwen-image-edit|seedance-pro-i2v|veo3-fast" &&
      mixed.chatModels.includes("gpt-4.1-mini") &&
      mixed.imageModels.includes("gpt-image-2") &&
      mixed.imageModels.includes("Tongyi-MAI/Z-Image-Turbo") &&
      mixed.videoModels.includes("seedance-pro-i2v") &&
      mixed.videoModels.includes("veo3-fast"),
  },
  {
    name: "parses Gemini model names without models prefix",
    pass:
      gemini.all.includes("gemini-2.5-flash") &&
      gemini.imageModels.includes("imagen-4.0-generate-preview") &&
      gemini.videoModels.includes("veo-3.0-generate-preview") &&
      gemini.all.every((modelId) => !modelId.startsWith("models/")),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Provider model catalog contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
