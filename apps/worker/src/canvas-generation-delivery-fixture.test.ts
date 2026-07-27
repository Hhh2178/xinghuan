import { beforeEach, describe, expect, it, vi } from "vitest";

const writtenFiles = vi.hoisted(() => new Map<string, Uint8Array>());

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async () => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  }),
  rename: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 1 })),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    writtenFiles.set(String(path), new Uint8Array(contents));
  }),
}));

import { createProviderGenerationTaskService } from "../../api/src/provider-generation-task-service.js";
import { projectTaskRuntimeDisplayState } from "../../api/src/task-runtime-projection.js";
import { materializeTaskOutputs } from "./output-materials.js";
import { executeWorkerTaskOperation } from "./worker-task-operation.js";
import type { TaskRow } from "./worker-task-store.js";

const pngDataUrl = "data:image/png;base64,aW1hZ2UtMQ==";

function createFixture() {
  const records: any[] = [];
  let enqueued = 0;
  const service = createProviderGenerationTaskService({
    normalizeProviderProtocol: () => "openai",
    providerPlainApiKey: () => "fixture-key",
    findEnabledProviderModel: async (_capability, providerId, modelId) => ({
      provider: { id: providerId || "fixture-provider", name: "Fixture Provider", baseUrl: "https://fixture.invalid", protocol: "openai", enabled: true },
      model: {
        id: "fixture-model-record",
        providerId: providerId || "fixture-provider",
        modelId: modelId || "fixture-image-model",
        displayName: "Fixture Image Model",
        capability: "image",
        enabled: true,
        parameterSchema: "{}",
      },
    }),
    normalizeProviderReferenceUrls: (values) => values,
    normalizeProviderReferenceUrl: (value) => value,
    findTaskByOwnerIdempotencyKey: async (ownerId, idempotencyKey) => records.find((record) => record.ownerId === ownerId && record.payload.idempotencyKey === idempotencyKey) || null,
    readTaskRecord: async (taskId) => records.find((record) => record.id === taskId) || null,
    insertTaskRecord: async (record) => { records.push(record); },
    writeTaskRecord: async (record) => {
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) records[index] = record;
    },
    appendTaskLog: async () => undefined,
    enqueueTask: async () => {
      enqueued += 1;
      return { queued: true, reason: "queued", queueName: "fixture" };
    },
    safeText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safeLongText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safePromptText: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    safeSlug: (value, fallback = "") => typeof value === "string" ? value.trim() : fallback,
    plainObject: (value) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {},
    taskIdFactory: () => `task-canvas-${records.length + 1}`,
    now: () => 1,
  });
  return { enqueued: () => enqueued, records, service };
}

function workerTask(record: any, overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    ownerId: record.ownerId,
    providerId: record.providerId,
    providerName: "Fixture Provider",
    providerBaseUrl: "https://fixture.invalid",
    providerProtocol: "openai",
    providerEnabled: true,
    apiKeyCipher: "",
    rhKeyPool: [],
    modelRecordId: record.modelId,
    providerModelId: "fixture-image-model",
    modelDisplayName: "Fixture Image Model",
    capability: "image",
    modelEnabled: true,
    payload: record.payload,
    result: record.result,
    logs: record.logs,
    ...overrides,
  };
}

describe("Canvas generation delivery fixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writtenFiles.clear();
  });

  it("submits one provider task, materializes a readable artifact, and projects success", async () => {
    const { enqueued, records, service } = createFixture();
    const request = {
      capability: "image" as const,
      rawBody: {
        providerId: "fixture-provider",
        model: "fixture-image-model",
        prompt: "Canvas fixture image",
        sourceCanvasId: "canvas-fixture-1",
        sourceNodeId: "image-node-fixture-1",
        idempotencyKey: "canvas-fixture-1:image-node-fixture-1:run-1",
      },
      user: { id: "fixture-owner", role: "member" as const },
      publicOrigin: "https://canvas.fixture",
    };

    const accepted = await service.submitProviderGenerationTask(request);
    const duplicate = await service.submitProviderGenerationTask(request);
    expect(duplicate.taskId).toBe(accepted.taskId);
    expect(enqueued()).toBe(1);
    expect(records).toHaveLength(1);

    const provider = vi.fn(async () => ({ upstreamTaskId: "mock-provider-1", providerState: "completed", imageUrls: [pngDataUrl] }));
    const providerResult = await executeWorkerTaskOperation({
      task: workerTask(records[0]),
      executeProvider: provider,
      executeOutputRecovery: vi.fn(),
    });
    const materialized = await materializeTaskOutputs({ dataDir: "fixture-data", task: workerTask(records[0]), result: providerResult });
    const completed = {
      ...records[0],
      status: "succeeded" as const,
      result: { ...records[0].result, ...providerResult, ...materialized.resultPatch, runtimeStage: "succeeded" },
    };

    expect(provider).toHaveBeenCalledOnce();
    expect(materialized.artifacts).toHaveLength(1);
    expect(materialized.artifacts[0]?.fileUrl).toMatch(/^\/files\/output\//);
    expect(materialized.artifacts[0]?.sourceNodeId).toBe("image-node-fixture-1");
    expect(materialized.artifacts[0]?.sourceCanvasId).toBe("canvas-fixture-1");
    expect(vi.mocked(await import("node:fs/promises")).writeFile).toHaveBeenCalled();
    const artifactFilename = materialized.artifacts[0]?.fileUrl?.split("/").at(-1) || "";
    const savedBytes = [...writtenFiles.entries()].find(([path]) => path.endsWith(artifactFilename))?.[1];
    expect(savedBytes?.byteLength).toBeGreaterThan(0);
    expect(projectTaskRuntimeDisplayState({ status: completed.status, runtimeStage: String(completed.result.runtimeStage) })).toMatchObject({
      displayTone: "success",
      runtimeStage: "succeeded",
    });
  });

  it("re-materializes a completed output without another Provider submission", async () => {
    const provider = vi.fn(async () => ({ imageUrls: [pngDataUrl] }));
    const recovery = vi.fn(async () => ({ imageUrls: [pngDataUrl], outputRecoveryMode: "output_only", materializationStatus: "retrying" }));
    const recovered = await executeWorkerTaskOperation({
      task: workerTask({
        id: "task-recovery-fixture",
        title: "recovery fixture",
        status: "failed",
        ownerId: "fixture-owner",
        providerId: "fixture-provider",
        modelId: "fixture-model-record",
        logs: [],
        payload: { taskCapability: "image", outputRecoveryMode: "output_only", sourceNodeId: "image-node-fixture-2", sourceCanvasId: "canvas-fixture-2" },
        result: { outputRecoveryMode: "output_only", remoteImageUrls: ["https://provider.fixture/output.png"] },
      }),
      executeProvider: provider,
      executeOutputRecovery: recovery,
    });
    const materialized = await materializeTaskOutputs({
      dataDir: "fixture-data",
      task: workerTask({
        id: "task-recovery-fixture",
        title: "recovery fixture",
        status: "failed",
        ownerId: "fixture-owner",
        providerId: "fixture-provider",
        modelId: "fixture-model-record",
        logs: [],
        payload: { taskCapability: "image", outputRecoveryMode: "output_only", sourceNodeId: "image-node-fixture-2", sourceCanvasId: "canvas-fixture-2" },
        result: { outputRecoveryMode: "output_only", remoteImageUrls: ["https://provider.fixture/output.png"] },
      }),
      result: recovered,
    });

    expect(provider).not.toHaveBeenCalled();
    expect(recovery).toHaveBeenCalledOnce();
    expect(materialized.resultPatch.materializedImageUrls).toHaveLength(1);
    expect(materialized.resultPatch.generationArtifactIds).toHaveLength(1);
  });
});
