import { describe, expect, it } from "vitest";
import { createProviderGenerationTaskService } from "./provider-generation-task-service.js";

function createService(options: {
  protocol?: string;
  modelId?: string;
  advancedConfig?: Record<string, unknown>;
} = {}) {
  const insertedTasks: any[] = [];
  let enqueuedCount = 0;
  const service = createProviderGenerationTaskService({
    normalizeProviderProtocol: () => options.protocol || "openai",
    providerPlainApiKey: () => "test-key",
    findEnabledProviderModel: async (capability, providerId, modelId) => ({
      provider: {
        id: providerId || "provider-1",
        name: "Test provider",
        baseUrl: "https://example.test",
        protocol: "openai",
        enabled: true,
      },
      model: {
        id: `${capability}-model-record`,
        providerId: providerId || "provider-1",
        modelId: options.modelId || modelId || `${capability}-model`,
        displayName: "Test model",
        capability,
        enabled: true,
        parameterSchema: "{}",
        advancedConfig: options.advancedConfig,
      },
    }),
    normalizeProviderReferenceUrls: (values) => values,
    normalizeProviderReferenceUrl: (value) => value,
    findTaskByOwnerIdempotencyKey: async (ownerId, idempotencyKey) => insertedTasks.find((task) => task.ownerId === ownerId && task.payload?.idempotencyKey === idempotencyKey) || null,
    readTaskRecord: async () => null,
    insertTaskRecord: async (task) => { insertedTasks.push(task); },
    writeTaskRecord: async () => undefined,
    appendTaskLog: async () => undefined,
    enqueueTask: async () => {
      enqueuedCount += 1;
      return { queued: true, reason: "queued", queueName: "test" };
    },
    safeText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safeLongText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safePromptText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safeSlug: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    plainObject: (value) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {},
    taskIdFactory: () => `task-${insertedTasks.length + 1}`,
    now: () => 1,
  });
  return { insertedTasks, enqueuedCount: () => enqueuedCount, service };
}

describe("provider generation task payload", () => {
  it("persists the image generationCount instead of legacy n", async () => {
    const { insertedTasks, service } = createService();

    await service.submitProviderGenerationTask({
      capability: "image",
      rawBody: { providerId: "provider-1", model: "image-model", prompt: "three images", n: 1, generationCount: 3 },
      user: { id: "user-1", role: "admin" },
      publicOrigin: "https://canvas.test",
    });

    expect(insertedTasks[0]?.payload).toMatchObject({ n: 3, generationCount: 3 });
  });

  it("returns the original task and does not enqueue again for the same owner idempotency key", async () => {
    const { insertedTasks, enqueuedCount, service } = createService();
    const input = {
      capability: "image" as const,
      rawBody: { providerId: "provider-1", model: "image-model", prompt: "idempotent image", idempotencyKey: "canvas-node-1:run-1" },
      user: { id: "user-1", role: "admin" as const },
      publicOrigin: "https://canvas.test",
    };

    const first = await service.submitProviderGenerationTask(input);
    const second = await service.submitProviderGenerationTask(input);

    expect(second.taskId).toBe(first.taskId);
    expect(insertedTasks).toHaveLength(1);
    expect(enqueuedCount()).toBe(1);
    expect(insertedTasks[0]?.payload).toMatchObject({ idempotencyKey: "canvas-node-1:run-1" });
  });

  it("persists the video generationCount and clamps it to four", async () => {
    const { insertedTasks, service } = createService();

    await service.submitProviderGenerationTask({
      capability: "video",
      rawBody: { providerId: "provider-1", model: "video-model", prompt: "five videos", n: 1, generationCount: 5 },
      user: { id: "user-1", role: "admin" },
      publicOrigin: "https://canvas.test",
    });

    expect(insertedTasks[0]?.payload).toMatchObject({ n: 4, generationCount: 4 });
  });

  it("freezes RunningHub generic image models as standard model execution", async () => {
    const { insertedTasks, service } = createService({
      protocol: "runninghub",
      modelId: "rhart-image-n-g31-flash/text-to-image",
    });

    await service.submitProviderGenerationTask({
      capability: "image",
      rawBody: { providerId: "provider-rh", model: "rhart-image-n-g31-flash/text-to-image", prompt: "city rain" },
      user: { id: "user-1", role: "admin" },
      publicOrigin: "https://canvas.test",
    });

    expect(insertedTasks[0]?.payload).toMatchObject({
      runningHubExecutionMode: "standard_model",
      runningHubModelPath: "rhart-image-n-g31-flash/text-to-image",
    });
  });

  it("preserves explicit RunningHub catalog targets instead of reclassifying them as standard models", async () => {
    const { insertedTasks, service } = createService({
      protocol: "runninghub",
      advancedConfig: {
        targetType: "app",
        runTargetId: "app-1",
        webappId: "app-1",
        nodeInfoList: [{ nodeId: "1", fieldName: "prompt", fieldValue: "city rain" }],
      },
    });

    await service.submitProviderGenerationTask({
      capability: "video",
      rawBody: { providerId: "provider-rh", model: "video-model", prompt: "city rain" },
      user: { id: "user-1", role: "admin" },
      publicOrigin: "https://canvas.test",
    });

    expect(insertedTasks[0]?.payload).toMatchObject({
      runningHubExecutionMode: "catalog_target",
      runTargetId: "app-1",
      webappId: "app-1",
    });
  });

  it("preserves explicit standard-video parameters when the RunningHub model schema is empty", async () => {
    const { insertedTasks, service } = createService({
      protocol: "runninghub",
      modelId: "/rhart-video-g/image-to-video",
    });

    await service.submitProviderGenerationTask({
      capability: "video",
      rawBody: {
        providerId: "provider-rh",
        model: "/rhart-video-g/image-to-video",
        prompt: "slow camera push",
        aspect_ratio: "16:9",
        resolution: "720p",
        duration: 6,
      },
      user: { id: "user-1", role: "admin" },
      publicOrigin: "https://canvas.test",
    });

    expect(insertedTasks[0]?.payload).toMatchObject({
      runningHubExecutionMode: "standard_model",
      aspect_ratio: "16:9",
      ratio: "16:9",
      resolution: "720p",
      duration: 6,
    });
  });
});
