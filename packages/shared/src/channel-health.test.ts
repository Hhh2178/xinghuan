import { describe, expect, it } from "vitest";
import {
  buildChannelHealthBucketRange,
  classifyChannelHealth,
  classifyProviderHealth,
  successRate,
} from "./channel-health.js";

describe("channel health contract", () => {
  it("builds 36 even Beijing-hour buckets", () => {
    const now = Date.parse("2026-07-24T07:31:00.000Z");
    const range = buildChannelHealthBucketRange(now);

    expect(range.buckets).toHaveLength(36);
    expect(new Date(range.buckets.at(-1)!.startAt).toISOString()).toBe("2026-07-24T06:00:00.000Z");
    expect(range.buckets.at(-1)!.endAt - range.buckets.at(-1)!.startAt).toBe(7_200_000);
  });

  it("uses the approved sample and rate thresholds", () => {
    expect(classifyChannelHealth(0, 0)).toBe("no_recent_requests");
    expect(classifyChannelHealth(2, 0)).toBe("insufficient_sample");
    expect(classifyChannelHealth(19, 1)).toBe("healthy");
    expect(classifyChannelHealth(8, 2)).toBe("degraded");
    expect(classifyChannelHealth(2, 1)).toBe("unhealthy");
    expect(successRate(1, 3)).toBe(0.25);
  });

  it("gives unhealthy provider state precedence", () => {
    expect(classifyProviderHealth(["healthy", "unhealthy"])).toBe("unhealthy");
    expect(classifyProviderHealth(["insufficient_sample", "no_recent_requests"])).toBe("insufficient_sample");
  });
});
