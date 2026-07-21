import { describe, expect, it } from "vitest";

import { decorateTaskObservabilitySummary, evaluateQueueConsistency, normalizeSystemHealthRange } from "./task-observability-domain.js";

describe("task observability domain", () => {
  it("does not mark a lower 24h failure rate critical because the 7d cumulative count is larger", () => {
    const summary = decorateTaskObservabilitySummary({
      total: 3_000,
      queued: 0,
      running: 0,
      succeeded: 2_500,
      failed: 300,
      cancelled: 200,
      failedLast1h: 0,
      failedLast24h: 5,
      finalizedLast24h: 100,
      failedLast7d: 70,
      finalizedLast7d: 700,
      failedLast30d: 300,
      finalizedLast30d: 3_000,
    });

    expect(summary.health.status).toBe("warning");
    expect(summary.health).toMatchObject({ sampleSize: 100, failureRatePercent: 5 });
    expect(summary.trend.failureRate7dPercent).toBe(10);
  });

  it("marks a sustained 24h failure-rate regression critical", () => {
    const summary = decorateTaskObservabilitySummary({
      total: 1_000,
      queued: 0,
      running: 0,
      succeeded: 800,
      failed: 150,
      cancelled: 50,
      failedLast1h: 2,
      failedLast24h: 30,
      finalizedLast24h: 100,
      failedLast7d: 70,
      finalizedLast7d: 700,
      failedLast30d: 300,
      finalizedLast30d: 3_000,
    });

    expect(summary.health).toMatchObject({
      status: "critical",
      reason: "failure_rate_critical",
      failureRatePercent: 30,
      baselinePercent: 10,
      thresholdPercent: 20,
    });
  });

  it("reports unknown instead of healthy or critical when the sample is too small", () => {
    const summary = decorateTaskObservabilitySummary({
      total: 3,
      queued: 0,
      running: 0,
      succeeded: 2,
      failed: 1,
      cancelled: 0,
      failedLast1h: 1,
      failedLast24h: 1,
      finalizedLast24h: 3,
      failedLast7d: 1,
      finalizedLast7d: 3,
      failedLast30d: 1,
      finalizedLast30d: 3,
    });

    expect(summary.health).toMatchObject({
      status: "unknown",
      reason: "insufficient_sample",
      sampleSize: 3,
    });
  });

  it("normalizes system health ranges to bounded aggregation windows", () => {
    expect(normalizeSystemHealthRange("7d")).toMatchObject({ key: "7d", bucket: "day", durationMs: 7 * 24 * 60 * 60 * 1000 });
    expect(normalizeSystemHealthRange("unbounded")).toMatchObject({ key: "24h", bucket: "hour" });
  });

  it("warns when database queued tasks are missing from Redis", () => {
    expect(evaluateQueueConsistency({ databaseQueued: 13, redisQueued: 0 })).toEqual({
      databaseQueued: 13,
      mismatch: 13,
      redisQueued: 0,
      status: "warning",
      summary: "数据库有 13 条 queued 任务，但 Redis 队列为空",
    });
  });
});
