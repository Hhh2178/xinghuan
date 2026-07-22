import { describe, expect, it } from "vitest";

import { decorateAuditConflictSummary } from "./audit-observability-domain.js";

describe("audit observability domain", () => {
  it("uses historical daily baselines instead of marking every count above five critical", () => {
    const summary = decorateAuditConflictSummary({
      totalLast24h: 62,
      totalLast7d: 264,
      totalLast30d: 596,
      distinctTargetsLast24h: 19,
      distinctActorsLast24h: 11,
      canvasRevisionLast24h: 62,
      resourceRevisionLast24h: 0,
      adminSettingsRevisionLast24h: 0,
    });

    expect(summary.health).toMatchObject({
      status: "warning",
      reason: "above_baseline",
      baselineCount: 37.71,
      criticalThresholdCount: 75.42,
    });
  });

  it("marks a broad conflict spike above twice the recent baseline critical", () => {
    const summary = decorateAuditConflictSummary({
      totalLast24h: 90,
      totalLast7d: 264,
      totalLast30d: 596,
      distinctTargetsLast24h: 19,
      distinctActorsLast24h: 11,
      canvasRevisionLast24h: 90,
      resourceRevisionLast24h: 0,
      adminSettingsRevisionLast24h: 0,
    });

    expect(summary.health).toMatchObject({
      status: "critical",
      reason: "baseline_regression",
      criticalThresholdCount: 75.42,
    });
  });

  it("keeps zero conflicts healthy and small counts warning", () => {
    expect(decorateAuditConflictSummary({
      totalLast24h: 0,
      totalLast7d: 0,
      totalLast30d: 0,
      distinctTargetsLast24h: 0,
      distinctActorsLast24h: 0,
      canvasRevisionLast24h: 0,
      resourceRevisionLast24h: 0,
      adminSettingsRevisionLast24h: 0,
    }).health.status).toBe("healthy");

    expect(decorateAuditConflictSummary({
      totalLast24h: 4,
      totalLast7d: 7,
      totalLast30d: 30,
      distinctTargetsLast24h: 1,
      distinctActorsLast24h: 1,
      canvasRevisionLast24h: 4,
      resourceRevisionLast24h: 0,
      adminSettingsRevisionLast24h: 0,
    }).health.status).toBe("warning");
  });
});
