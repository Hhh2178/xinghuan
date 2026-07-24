import { describe, expect, it } from "vitest";

import { selectExecutableRunningHubKey } from "./worker-runninghub-dispatch.js";

function createDeps(input: {
  executionMode?: "standard_model" | "catalog_target";
  keys: Array<Record<string, unknown>>;
}) {
  return {
    redis: {
      get: async () => "0",
    },
    settings: {
      runninghub: {
        enabled: true,
        concurrency: 2,
      },
    },
    task: {
      id: "task-1",
      providerId: "provider-rh",
      providerProtocol: "runninghub",
      apiKeyCipher: "",
      rhKeyPool: input.keys,
      payload: {
        runningHubExecutionMode: input.executionMode || "catalog_target",
      },
      result: {},
    },
    touchTaskRuntime: async () => undefined,
    normalizeProtocol: (value: unknown) => String(value || "").toLowerCase(),
    safeText: (value: unknown, fallback = "") => String(value ?? fallback).trim(),
    decryptSecret: (value: string) => value,
    runningHubRedisWindowKey: (providerId: string, keyId: string) => `${providerId}:${keyId}`,
  } as unknown as Parameters<typeof selectExecutableRunningHubKey>[0];
}

function key(input: Partial<Record<string, unknown>>) {
  return {
    id: "key-personal",
    note: "个人会员",
    apiKey: "encrypted-key",
    apiKeyPreview: "****",
    maxConcurrency: 1,
    enabled: true,
    isDefault: true,
    currentInFlight: 0,
    ...input,
  };
}

describe("RunningHub standard-model key dispatch", () => {
  it("selects only a key explicitly enabled for the Standard Model API", async () => {
    const selected = await selectExecutableRunningHubKey(createDeps({
      executionMode: "standard_model",
      keys: [
        key({ id: "personal-default" }),
        key({ id: "enterprise-shared", note: "共享账号", isDefault: false, standardModelApi: true }),
      ],
    }));

    expect(selected?.id).toBe("enterprise-shared");
  });

  it("infers legacy enterprise notes only when the structured property is absent", async () => {
    const selected = await selectExecutableRunningHubKey(createDeps({
      executionMode: "standard_model",
      keys: [
        key({ id: "legacy-enterprise", note: "企业级", isDefault: false }),
        key({ id: "explicitly-disabled", note: "enterprise shared", isDefault: false, standardModelApi: false }),
      ],
    }));

    expect(selected?.id).toBe("legacy-enterprise");
  });

  it("fails directly when a standard model has no eligible enterprise-shared key", async () => {
    await expect(selectExecutableRunningHubKey(createDeps({
      executionMode: "standard_model",
      keys: [key({ standardModelApi: false })],
    }))).rejects.toMatchObject({
      message: "RunningHub 标准模型需要企业级-共享 API Key",
      resultPatch: {
        failureCategory: "model_config",
        providerDiagnostic: "RunningHub 标准模型需要企业级-共享 API Key",
      },
    });
  });

  it("keeps catalog App and Workflow tasks on the existing default key order", async () => {
    const selected = await selectExecutableRunningHubKey(createDeps({
      executionMode: "catalog_target",
      keys: [
        key({ id: "personal-default", standardModelApi: false }),
        key({ id: "enterprise-shared", isDefault: false, standardModelApi: true }),
      ],
    }));

    expect(selected?.id).toBe("personal-default");
  });
});
