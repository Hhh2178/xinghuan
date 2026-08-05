import { describe, expect, it, vi } from "vitest";

import {
  createRequestPerformanceObservability,
  normalizeRouteId,
  responseByteLength,
} from "./request-performance-observability.js";

describe("request performance observability", () => {
  it("closes a timing sample once and keeps bounded route aggregates", () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(145);
    const metrics = createRequestPerformanceObservability({ maxSamples: 100 });
    const tracker = metrics.start("/api/admin/users/123");
    expect(tracker.finish({ statusCode: 200, responseBytes: 42 })).toMatchObject({
      routeId: "/api/admin/users/:id",
      durationMs: 45,
      responseBytes: 42,
    });
    expect(tracker.finish({ statusCode: 500 })).toMatchObject({ durationMs: 45 });
    expect(metrics.snapshot()).toMatchObject({ sampleCount: 1, routes: {
      "/api/admin/users/:id": { count: 1, p95Ms: 45, responseBytesP95: 42, errorRate: 0 },
    } });
    vi.restoreAllMocks();
  });

  it("normalizes high-cardinality route labels and counts failures", () => {
    const metrics = createRequestPerformanceObservability();
    metrics.start("/api/tasks/task-123/logs").finish({ statusCode: 503, dbQueryCount: 2, dbDurationMs: 8 });
    expect(metrics.snapshot().routes["/api/tasks/:id/logs"]?.errorRate).toBe(1);
    expect(normalizeRouteId("/api/users/123/sessions/456")).toBe("/api/users/:id/sessions/:id");
  });

  it("measures serialized bytes without retaining payloads", () => {
    const payload = { user: { id: "u-1" }, secret: "never-retained" };
    expect(responseByteLength(payload)).toBe(Buffer.byteLength(JSON.stringify(payload)));
  });
});
