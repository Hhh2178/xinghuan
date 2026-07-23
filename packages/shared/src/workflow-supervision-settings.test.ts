import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
  resolveWorkflowSupervisionSettings,
} from "./workflow-supervision-settings.js";

describe("workflow supervision settings", () => {
  it("resolves workflow, remembered, and apply-once layers while recording field sources", () => {
    const resolved = resolveWorkflowSupervisionSettings({
      limits: DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
      workflowDefaults: {
        defaultRetryCount: 2,
        retryExhaustionPolicy: "compatible_fallback",
        maxFallbackCount: 2,
        stageConcurrency: 2,
      },
      remembered: {
        defaultRetryCount: 4,
        candidateSelectionMode: "ai",
        candidateSelectionCount: 3,
      },
      runOverride: {
        defaultRetryCount: 6,
        candidateMinimumConfidence: 74,
      },
    });

    expect(resolved.settings).toMatchObject({
      defaultRetryCount: 6,
      retryExhaustionPolicy: "compatible_fallback",
      maxFallbackCount: 2,
      stageConcurrency: 2,
      candidateSelectionMode: "ai",
      candidateSelectionCount: 3,
      candidateMinimumConfidence: 74,
    });
    expect(resolved.sources).toMatchObject({
      defaultRetryCount: "run_override",
      retryExhaustionPolicy: "workflow_default",
      candidateSelectionMode: "remembered",
      candidateMinimumConfidence: "run_override",
    });
    expect(resolved.overriddenFields).toEqual(expect.arrayContaining([
      "defaultRetryCount",
      "candidateMinimumConfidence",
    ]));
  });

  it("clamps all user-controlled limits and keeps node retry overrides stable by node id", () => {
    const resolved = resolveWorkflowSupervisionSettings({
      limits: {
        ...DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
        maxRetryCount: 5,
        maxFallbackCount: 3,
        maxStageConcurrency: 4,
        maxDurationSeconds: 7_200,
        maxCost: "20.5",
      },
      remembered: {
        defaultRetryCount: 10,
        maxFallbackCount: 9,
        stageConcurrency: 99,
        maxDurationSeconds: 99_999,
        maxCost: "500",
        nodeRetryOverrides: { "node-video": 8, "node-image": 2, "": 4 },
      },
    });

    expect(resolved.settings).toMatchObject({
      defaultRetryCount: 5,
      maxFallbackCount: 3,
      stageConcurrency: 4,
      maxDurationSeconds: 7_200,
      maxCost: "20.5",
      nodeRetryOverrides: { "node-image": 2, "node-video": 5 },
    });
    expect(resolved.clampedFields).toEqual(expect.arrayContaining([
      "defaultRetryCount",
      "maxFallbackCount",
      "stageConcurrency",
      "maxDurationSeconds",
      "maxCost",
      "nodeRetryOverrides.node-video",
    ]));
  });
});
