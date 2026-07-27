import { describe, expect, it } from "vitest";

import { createRunningHubClient } from "./worker-runninghub-client.js";

describe("RunningHub catalog client polling", () => {
  it("keeps one submission and recovers a transient query failure", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const heartbeats: Array<Record<string, unknown>> = [];
    let queryCount = 0;
    const fetcher = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, body: String(init?.body || "") });
      if (url.includes("/run/ai-app/")) {
        return new Response(JSON.stringify({ code: 0, data: { taskId: "upstream-1" } }), { status: 200 });
      }
      queryCount += 1;
      if (queryCount === 1) return new Response("gateway unavailable", { status: 503 });
      return new Response(JSON.stringify({ code: 0, status: "SUCCESS", results: [{ url: "https://cdn.example/result.png" }] }), { status: 200 });
    }) as typeof fetch;

    const result = await createRunningHubClient({
      apiKey: "test-key",
      baseUrl: "https://api.runninghub.example",
      fetcher,
      wait: async () => undefined,
    }).runTask({
      targetType: "app",
      runTargetId: "app-1",
      nodeInfoList: [],
      pollIntervalMs: 0,
      onHeartbeat: async (patch) => { heartbeats.push(patch); },
    });

    expect(result.imageUrls).toEqual(["https://cdn.example/result.png"]);
    expect(requests.filter((request) => request.url.includes("/run/ai-app/")).length).toBe(1);
    expect(requests.filter((request) => request.url.endsWith("/openapi/v2/query")).length).toBe(2);
    expect(heartbeats).toEqual(expect.arrayContaining([
      expect.objectContaining({ pollRetryCount: 1, lastPollHttpStatus: 503, runtimeStage: "polling" }),
      expect.objectContaining({ pollRetryRecoveredAt: expect.any(String), providerState: "SUCCESS" }),
    ]));
  });
});
