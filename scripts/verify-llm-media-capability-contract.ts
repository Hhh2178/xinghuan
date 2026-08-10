import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const llmNodeSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "LLMNode.tsx"), "utf8");
const llmConversationSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "llm-conversation-state.ts"), "utf8");
const canvasSource = readFileSync(join(root, "apps", "web", "src", "components", "Canvas.tsx"), "utf8");
const audioNodeSource = readFileSync(join(root, "apps", "web", "src", "components", "nodes", "AudioNode.tsx"), "utf8");
const nodeRegistrySource = readFileSync(join(root, "apps", "web", "src", "config", "nodeRegistry.ts"), "utf8");

const checks = [
  {
    name: "llm node derives media support from backend model capability tags",
    pass:
      llmNodeSource.includes("modelSupportsImageUnderstanding") &&
      llmNodeSource.includes("modelSupportsVideoUnderstanding") &&
      llmNodeSource.includes("backendSupportsImageInput") &&
      llmNodeSource.includes("backendSupportsVideoInput"),
  },
  {
    name: "llm node blocks unsupported images and videos with clear messaging",
    pass:
      llmNodeSource.includes("当前模型未开启图像理解标签") &&
      llmNodeSource.includes("当前模型未开启视频理解标签") &&
      llmNodeSource.includes("已自动忽略"),
  },
  {
    name: "llm requests are stateless and history is display-only",
    pass:
      llmNodeSource.includes("buildStatelessLlmMessages") &&
      llmNodeSource.includes("visibleLlmConversationTurns") &&
      llmNodeSource.includes("showHistory") &&
      !llmNodeSource.includes("history.forEach") &&
      !llmNodeSource.includes("useStream") &&
      llmConversationSource.includes("buildStatelessLlmMessages") &&
      canvasSource.includes("showHistory: false"),
  },
  {
    name: "audio node marks legacy suno as unavailable and historical only",
    pass:
      audioNodeSource.includes("LEGACY_SUNO_AVAILABLE = false") &&
      audioNodeSource.includes("音频 Suno（旧）") &&
      audioNodeSource.includes("旧版 Suno 音频链路") &&
      audioNodeSource.includes("当前后端未接入对应代理接口"),
  },
  {
    name: "node registry prioritizes provider-based speech generation label",
    pass:
      nodeRegistrySource.includes("语音生成") &&
      nodeRegistrySource.includes("基于后台发布的音频模型完成语音生成与音色克隆"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("LLM media capability contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
