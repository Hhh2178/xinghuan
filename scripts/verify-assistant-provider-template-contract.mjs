import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps/api/src/server.ts"), "utf8");

const requiredSnippets = [
  'chainTemplate":"sync_inline_result|async_task_poll_result|async_task_poll_then_final_lookup|adapter_manual_model_catalog"',
  'chainTemplate = "async_task_poll_then_final_lookup";',
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
