import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import {
  createAicopyVideoAdapterPayload,
  extractAicopyTask,
  extractAicopyVideoResult,
  shouldUseAicopyVideoAdapter,
} from "../packages/model-core/src/aicopy-video-adapter.js";

const payload = createAicopyVideoAdapterPayload({
  modelId: "grok-imagine-video-1.5-preview",
  prompt: "让静态画面缓慢推进",
  ratio: "16:9",
  duration: 6,
  resolution: "720p",
  images: ["https://example.com/frame.png"],
  requestMapping: { ratio: "size", duration: "seconds", images: "images" },
  requestValueTypes: { duration: "string" },
  requestValueTemplates: { size: "{preview_video_size}" },
});

assert.equal(payload.size, "1280x720");
assert.equal(payload.seconds, "6");
assert.deepEqual(payload.images, ["https://example.com/frame.png", "https://example.com/frame.png"]);

const task = extractAicopyTask({ task_id: "task_123", status: "queued" });
assert.equal(task.taskId, "task_123");
assert.equal(task.status, "queued");

const result = extractAicopyVideoResult({ status: "completed", data: { output: "https://example.com/result.mp4" } });
assert.equal(result.status, "completed");
assert.deepEqual(result.videoUrls, ["https://example.com/result.mp4"]);

const sdPayload = createAicopyVideoAdapterPayload({
  modelId: "sd2-720p-fast",
  prompt: "让人物自然转身并走向镜头",
  ratio: "9:16",
  duration: 15,
  images: ["https://example.com/first-frame.png"],
  requestContract: {
    bindings: [
      { path: "duration", source: "duration", type: "number" },
      { path: "metadata.modeType", source: "modeType", type: "string" },
      { path: "metadata.ratio", source: "ratio", type: "string" },
      { path: "metadata.enableSound", value: "on", type: "string" },
      { path: "images", source: "images", type: "string[]" },
      { path: "audios", source: "audios", type: "string[]", omitWhenEmpty: true },
    ],
    resultPaths: ["result_url", "data.metadata.url", "data.output"],
  },
  modeType: "image2video",
  audios: [],
} as any);

assert.equal(sdPayload.duration, 15);
assert.deepEqual(sdPayload.metadata, {
  modeType: "image2video",
  ratio: "9:16",
  enableSound: "on",
});
assert.deepEqual(sdPayload.images, ["https://example.com/first-frame.png"]);
assert.equal("audios" in sdPayload, false);

const sdResult = extractAicopyVideoResult({
  status: "completed",
  result_url: "https://api.aicopy.top/v1/videos/task_example/content",
  data: { metadata: { url: "http://example.com/raw.mp4" } },
}, {
  resultPaths: ["result_url", "data.metadata.url", "data.output"],
} as any);
assert.deepEqual(sdResult.videoUrls, ["https://api.aicopy.top/v1/videos/task_example/content"]);

assert.equal(
  shouldUseAicopyVideoAdapter({
    protocol: "aicopy",
    providerBaseUrl: "https://api.aicopy.top",
  }),
  true,
);
assert.equal(
  shouldUseAicopyVideoAdapter({
    protocol: "openai",
    providerBaseUrl: "https://api.aicopy.top",
  }),
  true,
);

const workerSource = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const workerPollingSource = await readFile(new URL("../apps/worker/src/worker-media-polling.ts", import.meta.url), "utf8");
const modelEditorSource = await readFile(new URL("../apps/admin/src/admin-model-editor.tsx", import.meta.url), "utf8");
assert.match(workerSource, /pollAicopyVideoTask\(/);
assert.match(workerPollingSource, /export async function pollAicopyVideoTask\(/);
assert.match(modelEditorSource, /validateAicopyRequestContract/);
assert.match(modelEditorSource, /AIFork 视频请求契约/);
assert.match(workerSource, /async function executeVideoTask[\s\S]*?\["openai", "apimart", "aicopy", "modelscope", "custom"\]/);

console.log(JSON.stringify({ ok: true }, null, 2));
