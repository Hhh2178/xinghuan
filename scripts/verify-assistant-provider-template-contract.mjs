import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps/api/src/server.ts"), "utf8");

const requiredSnippets = [
  'chainTemplate":"sync_inline_result|async_task_poll_result|async_task_poll_then_final_lookup|adapter_manual_model_catalog"',
  'chainTemplate = "async_task_poll_then_final_lookup";',
  'const platoDetected = /柏拉图|apilio|api\\.apilio\\.ai|gpt-best\\.apifox\\.cn|grok-1\\.5-video-(6s|10s|15s)|grok-imagine-video-1\\.5-preview|\\/v2\\/videos\\/generations/i.test(signals);',
  'const platoGrok15Detected = /grok-1\\.5-video-(6s|10s|15s)/i.test(modelId);',
  'advancedConfig.submitPath = platoGrok15Detected',
  'preferredProviderEndpoint(baseUrl, "/v1/videos")',
  'advancedConfig.pollPathTemplate = preferredProviderEndpoint(baseUrl, "/v2/videos/generations/{task_id}");',
  'advancedConfig.resultVideoPath = "data.output";',
  'advancedConfig.requestBodyMode = "multipart_form_data";',
  'advancedConfig.requestContentType = "multipart/form-data";',
  'advancedConfig.requestFileFields = ["images"];',
  'advancedConfig.requestValueTemplates = { size: "{video_size}" };',
  'advancedConfig.finalResultPathTemplate = "../agnesapi?video_id={task_id}";',
  'chainTemplate = "async_task_poll_result";',
  "classifyUpstreamModel(modelId)",
  'videoDetected',
  "safeText((hermes as any).chainTemplate) || fallback.chainTemplate",
  "safeText((hermes as any).chainTemplateVersion) || fallback.chainTemplateVersion",
];

const missing = requiredSnippets.filter((snippet) => !serverSource.includes(snippet));

if (missing.length) {
  console.error("assistant provider template contract failed:");
  for (const snippet of missing) {
    console.error(`- missing: ${snippet}`);
  }
  process.exit(1);
}

console.log("assistant provider template contract ok");
