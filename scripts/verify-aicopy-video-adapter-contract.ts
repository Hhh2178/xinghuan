import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  createAicopyVideoAdapterPayload,
  extractAicopyTask,
  extractAicopyVideoResult,
  mergeAicopySdRequestContractDefaults,
  resolveAicopyRequestContractEnabled,
  shouldUseAicopyVideoAdapter,
} from "../packages/model-core/src/aicopy-video-adapter.js";
import { pollAicopyVideoTask } from "../apps/worker/src/worker-media-polling.js";

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
  requestContractEnabled: true,
});

assert.equal(sdPayload.duration, 15);
assert.deepEqual(sdPayload.metadata, {
  modeType: "image2video",
  ratio: "9:16",
  enableSound: "on",
});
assert.deepEqual(sdPayload.images, ["https://example.com/first-frame.png"]);
assert.equal("audios" in sdPayload, false);

const genericGrokPayload = createAicopyVideoAdapterPayload({
  modelId: "grok-imagine-1.0-video",
  prompt: "镜头缓慢推进，人物自然转身",
  duration: 6,
  ratio: "16:9",
  resolution: "720p",
  images: ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"],
  requestContractEnabled: true,
  requestContract: {
    bindings: [
      { path: "duration", source: "duration", type: "number" },
      { path: "video_length", source: "duration", type: "number" },
      { path: "aspect_ratio", source: "ratio", type: "string" },
      { path: "resolution", source: "resolution", type: "string" },
      { path: "video_config.video_length", source: "duration", type: "number" },
      { path: "video_config.aspect_ratio", source: "ratio", type: "string" },
      { path: "video_config.resolution", source: "resolution", type: "string" },
      { path: "video_config.preset", value: "normal", type: "string" },
      { path: "reference_images", source: "images", type: "string[]" },
    ],
  },
});
assert.deepEqual(genericGrokPayload, {
  model: "grok-imagine-1.0-video",
  prompt: "镜头缓慢推进，人物自然转身",
  duration: 6,
  video_length: 6,
  aspect_ratio: "16:9",
  resolution: "720p",
  video_config: {
    video_length: 6,
    aspect_ratio: "16:9",
    resolution: "720p",
    preset: "normal",
  },
  reference_images: ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"],
});

const sdResult = extractAicopyVideoResult({
  status: "completed",
  result_url: "https://api.aicopy.top/v1/videos/task_example/content",
  data: { metadata: { url: "http://example.com/raw.mp4" } },
}, {
  resultPaths: ["result_url", "data.metadata.url", "data.output"],
} as any);
assert.deepEqual(sdResult.videoUrls, ["https://api.aicopy.top/v1/videos/task_example/content"]);

const completedWithoutUrlServer = await startCompletedWithoutUrlServer();
try {
  const completedWithoutUrl = await pollAicopyVideoTask({
    baseUrl: `${completedWithoutUrlServer.origin}/v1`,
    apiKey: "test-key",
    taskId: "task_final_lookup",
    statusPath: "status",
    resultVideoPath: "data.output",
    pollPathTemplate: "videos/{task_id}",
    pollIntervalMs: 0,
    timeoutMs: 5_000,
  });
  assert.equal(completedWithoutUrl.status, "completed");
  assert.deepEqual(completedWithoutUrl.videoUrls, [
    `${completedWithoutUrlServer.origin}/v1/videos/task_final_lookup/content`,
  ]);
} finally {
  completedWithoutUrlServer.server.close();
}

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
  false,
);
assert.equal(
  shouldUseAicopyVideoAdapter({
    protocol: "aicopy",
    providerBaseUrl: "https://renamed.example.com",
  }),
  true,
);

const staleContract = {
  requestContract: {
    bindings: [{ path: "metadata.enableSound", value: "on", type: "string" }],
  },
};
assert.equal(resolveAicopyRequestContractEnabled(staleContract), false);
assert.equal(resolveAicopyRequestContractEnabled({ ...staleContract, aicopyRequestContractEnabled: true }), true);

const mergedSdDefaults = mergeAicopySdRequestContractDefaults({
  requestContract: {
    bindings: [
      { path: "metadata.ratio", value: "stale" },
      { path: "custom.trace", value: true, type: "boolean" },
    ],
    resultPaths: ["custom.output"],
  },
});
assert.equal(mergedSdDefaults.aicopyRequestContractEnabled, true);
assert.deepEqual(
  mergedSdDefaults.requestContract.bindings.map((binding) => binding.path),
  ["duration", "metadata.modeType", "metadata.ratio", "metadata.enableSound", "images", "audios", "custom.trace"],
);
assert.equal(
  mergedSdDefaults.requestContract.bindings.find((binding) => binding.path === "metadata.ratio")?.source,
  "ratio",
);
assert.deepEqual(
  mergedSdDefaults.requestContract.resultPaths,
  ["result_url", "data.metadata.url", "data.output", "custom.output"],
);

for (const modelId of ["sd2-720p-mini", "sd2-720p-fast", "sd2-720p"]) {
  const matrixPayload = createAicopyVideoAdapterPayload({
    modelId,
    prompt: "她跳桑巴舞",
    duration: 6,
    ratio: "9:16",
    modeType: "image2video",
    images: ["https://example.com/first-frame.png"],
    requestContractEnabled: true,
    requestContract: mergedSdDefaults.requestContract,
  });
  assert.equal(matrixPayload.duration, 6, `${modelId} duration mismatch`);
  assert.deepEqual(matrixPayload.metadata, {
    modeType: "image2video",
    ratio: "9:16",
    enableSound: "on",
  }, `${modelId} metadata mismatch`);
  assert.deepEqual(matrixPayload.images, ["https://example.com/first-frame.png"], `${modelId} images mismatch`);
}

const disabledContractPayload = createAicopyVideoAdapterPayload({
  modelId: "grok-imagine-video-1.5-preview",
  prompt: "test",
  duration: 6,
  requestContractEnabled: false,
  requestContract: staleContract.requestContract,
});
assert.equal("metadata" in disabledContractPayload, false);

const workerSource = await readFile(new URL("../apps/worker/src/worker.ts", import.meta.url), "utf8");
const workerPollingSource = await readFile(new URL("../apps/worker/src/worker-media-polling.ts", import.meta.url), "utf8");
const modelEditorSource = await readFile(new URL("../apps/admin/src/admin-model-editor.tsx", import.meta.url), "utf8");
assert.match(workerSource, /pollAicopyVideoTask\(/);
assert.match(workerSource, /resolveAicopyRequestContractEnabled/);
assert.match(workerSource, /requestContractEnabled/);
assert.match(workerSource, /task\.payload\.modeType/);
assert.match(workerSource, /\["text2video", "image2video", "frames2video"\]/);
assert.match(workerSource, /requestContractEnabled\s*\?[^:]+resultPaths/s);
assert.match(workerPollingSource, /export async function pollAicopyVideoTask\(/);
assert.match(modelEditorSource, /validateAicopyRequestContract/);
assert.match(modelEditorSource, /AIFork 视频请求契约/);
assert.match(workerSource, /async function executeVideoTask[\s\S]*?\["openai", "apimart", "aicopy", "modelscope", "custom"\]/);

console.log(JSON.stringify({ ok: true }, null, 2));

function startCompletedWithoutUrlServer() {
  return new Promise<{ server: import("node:http").Server; origin: string }>((resolve) => {
    const server = createServer((request, response) => {
      if (request.url === "/v1/videos/task_final_lookup") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "task_final_lookup", status: "completed", progress: 100 }));
        return;
      }
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("AICOPY_POLL_MOCK_START_FAILED");
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}
