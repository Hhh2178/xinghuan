import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const audioNodeSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "AudioNode.tsx"), "utf8");
const adminEditorSource = readFileSync(join(root, "apps", "admin", "src", "admin-model-editor.tsx"), "utf8");
const publishedSelectionSource = readFileSync(join(root, "apps", "web", "src", "utils", "publishedModelSelection.ts"), "utf8");

const checks = [
  {
    name: "audio node uses mode-aware provider model filtering",
    pass:
      audioNodeSource.includes("filterAudioModelsByMode") &&
      audioNodeSource.includes("resolveCompatibleAudioProviderSelection") &&
      audioNodeSource.includes("voice_design"),
  },
  {
    name: "audio node reads preset voice options from parameter schema for tts mode",
    pass:
      audioNodeSource.includes("parameterSchema?.voice?.options") &&
      audioNodeSource.includes("parameterSchema?.voice?.default") &&
      audioNodeSource.includes("showPresetVoiceControls"),
  },
  {
    name: "admin model editor exposes preset voice fields",
    pass:
      adminEditorSource.includes("syncAudioVoicePresetSchema") &&
      adminEditorSource.includes("预设音色") &&
      adminEditorSource.includes("默认音色"),
  },
  {
    name: "published model selection utility exposes audio compatibility helpers",
    pass:
      publishedSelectionSource.includes("filterAudioModelsByMode") &&
      publishedSelectionSource.includes("resolveCompatibleAudioProviderSelection"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Audio provider model selection contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
