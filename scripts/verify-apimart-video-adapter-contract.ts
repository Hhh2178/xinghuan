import { strict as assert } from "node:assert";
import {
  createApimartVideoAdapterPayload,
  extractApimartFinalTaskId,
  extractApimartFailureReason,
  extractApimartTask,
  extractApimartVideoResult,
  resolveApimartVideoMultipartFieldNames,
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

const stringDurationPayload = createApimartVideoAdapterPayload({
  modelId: "grok-video-1.5-preview",
  prompt: "让静态画面缓慢推进",
  duration: 10,
  requestMapping: { duration: "seconds" },
  requestValueTypes: { duration: "string" },
});

assert.equal(stringDurationPayload.seconds, "10");

const platoMultipartPayload = createApimartVideoAdapterPayload({
  modelId: "grok-1.5-video-6s",
  prompt: "让静态画面缓慢推进",
  ratio: "16:9",
  duration: 6,
  resolution: "720p",
  images: ["https://example.com/frame.png"],
  requestMapping: { ratio: "", duration: "duration", resolution: "", images: "input_reference" },
  requestValueTemplates: { size: "{video_size}" },
});

assert.equal(platoMultipartPayload.duration, 6);
assert.equal(platoMultipartPayload.size, "1280x720");
assert.deepEqual(platoMultipartPayload.input_reference, ["https://example.com/frame.png"]);
assert.equal("quality" in platoMultipartPayload, false);
assert.equal("aspect_ratio" in platoMultipartPayload, false);

const multipartFields = resolveApimartVideoMultipartFieldNames({
  requestMapping: { images: "input_reference", firstFrame: "first_frame" },
  requestFileFields: ["images", "firstFrame"],
});

assert.deepEqual(multipartFields, ["input_reference", "first_frame"]);

const task = extractApimartTask({
  code: 200,
  data: [{ task_id: "task_123", status: "submitted" }],
});

assert.equal(task.taskId, "task_123");
assert.equal(task.status, "submitted");

const requestTask = extractApimartTask({
  request_id: "req_123",
  status: "queued",
});

assert.equal(requestTask.taskId, "req_123");
assert.equal(requestTask.status, "queued");

const idTask = extractApimartTask({
  id: "video_abc123def456",
  object: "generation.task",
  status: "queued",
});

assert.equal(idTask.taskId, "video_abc123def456");
assert.equal(idTask.status, "queued");

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

const xaiStyleResult = extractApimartVideoResult({
  status: "done",
  video: {
    url: "https://example.com/result-top-level.mp4",
  },
});

assert.equal(xaiStyleResult.status, "done");
assert.deepEqual(xaiStyleResult.videoUrls, ["https://example.com/result-top-level.mp4"]);

const toapisStyleResult = extractApimartVideoResult({
  id: "video_abc123def456",
  status: "completed",
  result: {
    data: [
      {
        url: "https://example.com/toapis-result.mp4",
        format: "mp4",
      },
    ],
  },
});

assert.equal(toapisStyleResult.status, "completed");
assert.deepEqual(toapisStyleResult.videoUrls, ["https://example.com/toapis-result.mp4"]);

const platoStyleResult = extractApimartVideoResult({
  task_id: "task_plato_123",
  status: "SUCCESS",
  data: {
    output: "https://example.com/plato-result.mp4",
  },
});

assert.equal(platoStyleResult.status, "SUCCESS");
assert.deepEqual(platoStyleResult.videoUrls, ["https://example.com/plato-result.mp4"]);

const agnesTaskId = extractApimartFinalTaskId({
  id: "task_abc",
  video_id: "video_abc",
  status: "queued",
});

assert.equal(agnesTaskId, "video_abc");

const agnesStyleResult = extractApimartVideoResult({
  status: "completed",
  remixed_from_video_id: "https://example.com/agnes-result.mp4",
});

assert.equal(agnesStyleResult.status, "completed");
assert.deepEqual(agnesStyleResult.videoUrls, ["https://example.com/agnes-result.mp4"]);

const failedReason = extractApimartFailureReason({
  code: 400,
  data: {
    status: "failed",
    error: {
      message: "Insufficient balance for video generation",
    },
  },
});

assert.equal(failedReason, "Insufficient balance for video generation");

const nestedFailedReason = extractApimartFailureReason({
  status: "error",
  result: {
    failure_reason: "Reference image is not reachable",
  },
});

assert.equal(nestedFailedReason, "Reference image is not reachable");

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
    advancedMode: "async_video_task",
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
