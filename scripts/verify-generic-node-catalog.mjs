import { readFile } from "node:fs/promises";

const checks = [];
const image = await readFile(new URL("../apps/web/src/components/nodes/ImageNode.tsx", import.meta.url), "utf8");
const video = await readFile(new URL("../apps/web/src/components/nodes/VideoNode.tsx", import.meta.url), "utf8");
const llm = await readFile(new URL("../apps/web/src/components/nodes/LLMNode.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");

check("Image node consumes backend image catalog", image.includes("catalog.imageModels") && image.includes("modelRecordId"));
check("Video node consumes backend video catalog", video.includes("catalog.videoModels") && video.includes("modelRecordId"));
check("LLM node consumes backend chat catalog", llm.includes("catalog.chatModels") && llm.includes("modelRecordId"));
check("Video node uses dynamic catalog UI metadata", video.includes("backendModel.ui.durationOptions") && video.includes("backendModel.ui.resolutionOptions"));
check("Image node normalizes stale values after schema changes", image.includes("if (!backendUi.aspectRatios.includes(aspectRatio))") && image.includes("if (!backendUi.sizes.includes(sizeLevel))"));
check("Video node normalizes stale values after schema changes", video.includes("if (!backendModel.ui.aspectRatios.includes(ratio))") && video.includes("if (!backendModel.ui.durationOptions.includes(duration))") && video.includes("if (!backendModel.ui.resolutionOptions.includes(resolution))"));
check("API exposes external chat proxy", api.includes('"/api/proxy/external/llm"') && api.includes("generateExternalChatProxy"));
check("API exposes external video proxy", api.includes('"/api/proxy/external/video"') && api.includes("generateExternalVideoProxy"));
check("Admin edits model input profile and parameter schema", admin.includes("输入 Profile") && admin.includes("参数 Schema（JSON）") && admin.includes("JSON.parse(parameterSchema)"));
check("Admin can change model capability classification", admin.includes("能力分类") && admin.includes("capability: draft.capability"));

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);

function check(name, ok) {
  checks.push([name, Boolean(ok)]);
}
