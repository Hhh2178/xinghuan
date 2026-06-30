import { strict as assert } from "node:assert";
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

console.log(JSON.stringify({ ok: true }, null, 2));
