import { strict as assert } from "node:assert";
import {
  createApimartVideoAdapterPayload,
  extractApimartTask,
  extractApimartVideoResult,
  shouldUseApimartVideoAdapter,
} from "../apps/api/src/apimart-video-adapter.js";

const payload = createApimartVideoAdapterPayload({
  modelId: "grok-imagine-1.5-video-apimart",
  prompt: "让静态画面缓慢推进",
  ratio: "16:9",
  duration: 6,
  resolution: "720p",
  images: ["https://example.com/frame.png"],
});

assert.equal(payload.model, "grok-imagine-1.5-video-apimart");
assert.equal(payload.prompt, "让静态画面缓慢推进");
assert.equal(payload.size, "16:9");
assert.equal(payload.duration, 6);
assert.equal(payload.quality, "720p");
assert.deepEqual(payload.image_urls, ["https://example.com/frame.png"]);

const task = extractApimartTask({
  code: 200,
  data: [{ task_id: "task_123", status: "submitted" }],
});

assert.equal(task.taskId, "task_123");
assert.equal(task.status, "submitted");

const result = extractApimartVideoResult({
  code: 200,
  data: {
    status: "completed",
    result: {
      videos: ["https://example.com/result.mp4"],
    },
  },
});

assert.equal(result.status, "completed");
assert.deepEqual(result.videoUrls, ["https://example.com/result.mp4"]);

const nestedResult = extractApimartVideoResult({
  code: 200,
  data: {
    status: "completed",
    result: {
      videos: [
        {
          url: [
            "https://example.com/result-nested.mp4",
          ],
        },
      ],
    },
  },
});

assert.equal(nestedResult.status, "completed");
assert.deepEqual(nestedResult.videoUrls, ["https://example.com/result-nested.mp4"]);

assert.equal(
  shouldUseApimartVideoAdapter({
    protocol: "apimart",
    advancedMode: "",
    modelId: "plain-video-model",
    providerBaseUrl: "https://api.example.com/v1",
  }),
  true,
);
assert.equal(
  shouldUseApimartVideoAdapter({
    protocol: "openai",
    advancedMode: "apimart_async_video",
    modelId: "plain-video-model",
    providerBaseUrl: "https://api.example.com/v1",
  }),
  true,
);
assert.equal(
  shouldUseApimartVideoAdapter({
    protocol: "openai",
    advancedMode: "",
    modelId: "grok-imagine-1.5-video-apimart",
    providerBaseUrl: "https://api.example.com/v1",
  }),
  true,
);
assert.equal(
  shouldUseApimartVideoAdapter({
    protocol: "openai",
    advancedMode: "",
    modelId: "plain-video-model",
    providerBaseUrl: "https://api.apimart.ai/v1",
  }),
  true,
);
assert.equal(
  shouldUseApimartVideoAdapter({
    protocol: "openai",
    advancedMode: "",
    modelId: "plain-video-model",
    providerBaseUrl: "https://api.example.com/v1",
  }),
  false,
);

console.log(JSON.stringify({ ok: true, payload, task, result }, null, 2));
