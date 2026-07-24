import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RunningHubStandardModelError,
  executeRunningHubStandardModel,
} from "./worker-runninghub-standard-adapter.js";

describe("RunningHub standard model adapter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["image", "png", "imageUrls", "runninghub-standard-image"],
    ["video", "mp4", "videoUrls", "runninghub-standard-video"],
  ] as const)("submits and polls a %s model to a typed result", async (capability, outputType, outputKey, adapter) => {
    vi.useFakeTimers();
    const upstreamUrl = `https://temporary.example/result.${outputType}?signature=private`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ taskId: "rh-task-1", status: "RUNNING" }))
      .mockResolvedValueOnce(jsonResponse({ taskId: "rh-task-1", status: "RUNNING", results: null }))
      .mockResolvedValueOnce(jsonResponse({
        taskId: "rh-task-1",
        status: "SUCCESS",
        usage: { consumeMoney: "0.08", consumeCoins: "3", taskCostTime: "12", secretLedger: "hidden" },
        results: [{ url: upstreamUrl, outputType, nodeId: "2", text: null }],
      })) as unknown as typeof fetch;
    const heartbeats: Array<Record<string, unknown>> = [];

    const execution = executeRunningHubStandardModel({
      capability,
      baseUrl: "https://www.runninghub.cn/",
      apiKey: "secret-key",
      modelPath: "/openapi/v2/rhart-model/generate",
      body: { prompt: "city rain" },
      fetchImpl,
      onHeartbeat: async (patch) => { heartbeats.push(patch); },
    });
    await vi.runAllTimersAsync();
    const result = await execution;

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://www.runninghub.cn/openapi/v2/rhart-model/generate", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret-key" }),
    }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://www.runninghub.cn/openapi/v2/query", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ taskId: "rh-task-1" }),
    }));
    expect(result).toMatchObject({
      adapter,
      taskId: "rh-task-1",
      providerState: "SUCCESS",
      providerUsage: { consumeMoney: "0.08", consumeCoins: "3", taskCostTime: "12" },
      [outputKey]: [upstreamUrl],
    });
    expect(result.providerUsage).not.toHaveProperty("secretLedger");
    expect(JSON.stringify(heartbeats)).not.toContain("secret-key");
    expect(JSON.stringify(heartbeats)).not.toContain("signature=private");
  });

  it("returns a safe failed status without signed URLs or authorization data", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({
      taskId: "rh-task-failed",
      status: "FAILED",
      errorCode: "MODEL_REJECTED",
      errorMessage: "invalid input https://private.example/file.png?token=secret",
      Authorization: "Bearer leaked",
    })) as unknown as typeof fetch;

    const error = await executeRunningHubStandardModel({
      capability: "video",
      baseUrl: "https://www.runninghub.cn",
      apiKey: "secret-key",
      modelPath: "rhart-video/generate",
      body: { prompt: "city rain" },
      fetchImpl,
      onHeartbeat: async () => undefined,
    }).catch((value) => value);

    expect(error).toBeInstanceOf(RunningHubStandardModelError);
    expect(error).toMatchObject({ errorCode: "MODEL_REJECTED", providerState: "FAILED", taskId: "rh-task-failed" });
    expect(String(error.message)).toContain("invalid input");
    expect(String(error.message)).not.toContain("token=secret");
    expect(JSON.stringify(error)).not.toContain("Bearer leaked");
    expect(JSON.stringify(error)).not.toContain("secret-key");
  });

  it("treats HTTP 200 business errors without task ids as failed submissions", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({
      errorCode: "ACCESS_DENIED",
      errorMessage: "Standard Model API requires an Enterprise-Shared API Key",
    })) as unknown as typeof fetch;

    const error = await executeRunningHubStandardModel({
      capability: "image",
      baseUrl: "https://www.runninghub.cn",
      apiKey: "secret-key",
      modelPath: "rhart-image/generate",
      body: { prompt: "city rain" },
      fetchImpl,
      onHeartbeat: async () => undefined,
    }).catch((value) => value);

    expect(error).toMatchObject({ errorCode: "ACCESS_DENIED", providerState: "FAILED", taskId: "" });
    expect(String(error.message)).toContain("Enterprise-Shared API Key");
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}
