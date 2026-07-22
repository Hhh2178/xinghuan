import { describe, expect, it } from "vitest";

import {
  TASK_QUEUE_DEFAULT_CONCURRENCY,
  TASK_QUEUE_DEFAULT_USER_CONCURRENCY,
  TASK_QUEUE_MAX_CONCURRENCY,
  buildTaskQueueRuntimeDescriptors,
  normalizeTaskQueueSettings,
  taskQueueWorkerRuntimeKey,
  taskQueueWorkerRuntimePattern,
} from "./task-queue-settings";

describe("task queue settings", () => {
  it("normalizes invalid concurrency values to stable defaults", () => {
    const settings = normalizeTaskQueueSettings({
      image: { concurrency: "invalid", userConcurrency: -5 },
      audio: { concurrency: 2000, userConcurrency: 3 },
      video: { concurrency: 2.4, userConcurrency: "invalid" },
      chat: { concurrency: 12, userConcurrency: 2 },
      runninghub: { concurrency: 0, enabled: false },
    });

    expect(settings.image.concurrency).toBe(TASK_QUEUE_DEFAULT_CONCURRENCY);
    expect(settings.image.userConcurrency).toBe(1);
    expect(settings.audio.concurrency).toBe(TASK_QUEUE_MAX_CONCURRENCY);
    expect(settings.audio.userConcurrency).toBe(3);
    expect(settings.video.concurrency).toBe(2);
    expect(settings.video.userConcurrency).toBe(TASK_QUEUE_DEFAULT_USER_CONCURRENCY);
    expect(settings.chat).toEqual({ concurrency: 12, userConcurrency: 2 });
    expect(settings.runninghub.concurrency).toBe(1);
    expect(settings.runninghub.enabled).toBe(false);
  });

  it("builds queue descriptors with the configured base queue name", () => {
    const descriptors = buildTaskQueueRuntimeDescriptors("canvas:jobs", normalizeTaskQueueSettings({}));

    expect(descriptors).toEqual([
      { capability: "image", queue: "canvas:jobs:image", concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY },
      { capability: "audio", queue: "canvas:jobs:audio", concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY },
      { capability: "video", queue: "canvas:jobs:video", concurrency: TASK_QUEUE_DEFAULT_CONCURRENCY },
      { capability: "chat", queue: "canvas:jobs:chat", concurrency: 20 },
    ]);
  });

  it("namespaces worker runtime keys by environment", () => {
    expect(taskQueueWorkerRuntimeKey("gray", "worker-1")).toBe("xinghuan:worker-runtime:gray:worker-1");
    expect(taskQueueWorkerRuntimePattern("production")).toBe("xinghuan:worker-runtime:production:*");
  });
});
