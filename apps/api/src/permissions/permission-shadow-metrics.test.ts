import { describe, expect, it } from "vitest";
import { createPermissionShadowMetrics } from "./permission-shadow-metrics.js";

describe("permission shadow metrics", () => {
  it("aggregates by domain without retaining protected subject keys", () => {
    let now = 100;
    const metrics = createPermissionShadowMetrics(() => now++);
    const input = {
      subjectKey: "provider.model/secret-model-id",
      action: "view" as const,
      legacyAllowed: true,
      unified: { allowed: false, reason: "subject-not-published" as const },
    };

    metrics.record(input);
    metrics.record(input);

    expect(metrics.snapshot()).toEqual([expect.objectContaining({
      domain: "provider",
      action: "view",
      count: 2,
      firstSeenAt: 100,
      lastSeenAt: 101,
    })]);
    expect(JSON.stringify(metrics.snapshot())).not.toContain("secret-model-id");
  });
});
