const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18231";
const mockBaseUrl = process.env.XINGHUAN_PHASE2_MOCK_BASE_URL ?? "http://127.0.0.1:18290";
const loginEmail = process.env.XINGHUAN_VERIFY_EMAIL ?? "admin@xinghuan.local";
const loginPassword = process.env.XINGHUAN_VERIFY_PASSWORD ?? "admin123456";
const providerId = "phase2-e2e-provider";
let cookie = "";

await fetchJson("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: loginEmail, password: loginPassword }),
});
await fetchJson("/api/admin/providers", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: providerId, name: "Phase 2 验收 Provider", baseUrl: mockBaseUrl, protocol: "openai", enabled: true, apiKey: "phase2-e2e-key" }),
}).catch(async () => {
  await fetchJson(`/api/admin/providers/${providerId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Phase 2 验收 Provider", baseUrl: mockBaseUrl, protocol: "openai", enabled: true, apiKey: "phase2-e2e-key" }),
  });
});
const imported = await fetchJson(`/api/admin/providers/${providerId}/import-models`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    models: [
      { modelId: "phase2-chat", capability: "chat", displayName: "Phase 2 Chat" },
      { modelId: "phase2-image", capability: "image", displayName: "Phase 2 Image" },
      { modelId: "phase2-video", capability: "video", displayName: "Phase 2 Video" },
    ],
  }),
});
const records = Object.fromEntries(imported.data.models.map((model) => [model.capability, model]));
await patchModel(records.image.id, {
  parameterSchema: JSON.stringify({
    prompt: { type: "string", required: true },
    aspectRatio: { type: "select", options: ["1:1", "16:9"], default: "16:9" },
    size: { type: "select", options: ["1024x1024", "1536x1024"], default: "1536x1024" },
    referenceImages: { type: "image[]", max: 3 },
  }),
});
await patchModel(records.video.id, {
  parameterSchema: JSON.stringify({
    prompt: { type: "string", required: true },
    aspectRatio: { type: "select", options: ["16:9", "9:16"], default: "9:16" },
    duration: { type: "select", options: [4, 6, 8], default: 8 },
    resolution: { type: "select", options: ["720p", "1080p"], default: "1080p" },
    referenceImages: { type: "image[]", max: 1 },
  }),
});

const canvas = await fetchJson("/api/canvas", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Phase 2 节点连通验收" }),
});
const canvasId = canvas.data.id;
const textNode = {
  id: "phase2-text",
  type: "text",
  position: { x: 0, y: 180 },
  data: { text: "科技城市夜景，青绿色光线，电影质感", nodeSerialId: 1 },
};
const imageNode = {
  id: "phase2-image-node",
  type: "image",
  position: { x: 340, y: 0 },
  data: { nodeSerialId: 2, modelSource: "backend", backendModelId: records.image.id, ratio: "16:9", aspectRatio: "16:9", sizeLevel: "1536x1024" },
};
const videoNode = {
  id: "phase2-video-node",
  type: "video",
  position: { x: 720, y: 0 },
  data: { nodeSerialId: 3, modelSource: "backend", backendModelId: records.video.id, ratio: "9:16", duration: 8, resolution: "1080p" },
};
const llmNode = {
  id: "phase2-llm-node",
  type: "llm",
  position: { x: 1080, y: 0 },
  data: { nodeSerialId: 4, modelSource: "backend", backendModelId: records.chat.id, stream: false },
};
await fetchJson(`/api/canvas/${canvasId}`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    nodes: [textNode, imageNode, videoNode, llmNode],
    edges: [
      { id: "phase2-edge-image", source: textNode.id, target: imageNode.id },
      { id: "phase2-edge-video", source: textNode.id, target: videoNode.id },
      { id: "phase2-edge-llm", source: textNode.id, target: llmNode.id },
    ],
    viewport: { x: 80, y: 120, zoom: 0.58 },
    nextNodeSerialId: 5,
  }),
});
console.log(JSON.stringify({ ok: true, canvasId, records }, null, 2));

async function patchModel(id, patch) {
  return fetchJson(`/api/admin/models/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}
async function fetchJson(pathname, options) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...(cookie ? { cookie } : {}), ...(options?.headers || {}) },
  });
  const raw = response.headers.get("set-cookie");
  if (raw) cookie = raw.split(";")[0];
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return JSON.parse(text);
}
