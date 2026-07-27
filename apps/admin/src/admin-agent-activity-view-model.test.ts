import { describe, expect, it } from "vitest";

import { buildActivityCases } from "./admin-agent-activity-view-model.js";
import type {
  AgentApproval,
  AgentAuditRecord,
  AgentRunsData,
  RecoveryDecision,
} from "./admin-agent-governance-api.js";

const runs: AgentRunsData = {
  agentRuns: [{
    id: "agent-1", ownerId: "owner-1", ownerEmail: "owner@example.com", canvasRunId: "run-approval",
    role: "recovery", scenario: "prompt-review-rewrite", status: "succeeded", createdAt: 90, updatedAt: 100,
  }],
  canvasRuns: [
    { id: "run-failed", ownerId: "owner-2", ownerEmail: "failed@example.com", canvasId: "canvas-2", status: "failed", createdAt: 180, updatedAt: 200, error: { code: "PROVIDER_TIMEOUT" } },
    { id: "run-approval", ownerId: "owner-1", ownerEmail: "owner@example.com", canvasId: "canvas-1", status: "awaiting_approval", createdAt: 80, updatedAt: 110 },
  ],
};

const approval: AgentApproval = {
  id: "approval-1", ownerEmail: "owner@example.com", canvasRunId: "run-approval", runStepId: "step-video",
  actionType: "prompt_rewrite", action: { currentModelId: "model-a", targetModelId: "model-b" }, status: "pending",
  requestedBy: "agent-1", createdAt: 105,
};

const recovery: RecoveryDecision = {
  id: "recovery-1", ownerEmail: "owner@example.com", canvasRunId: "run-approval", runStepId: "step-video",
  failureClass: "content_policy", decision: "rewrite_prompt", currentModelId: "model-a", targetModelId: "model-b",
  reason: "移除受限词组", status: "awaiting_approval", approvalId: "approval-1", createdAt: 104,
};

const audit: AgentAuditRecord = {
  id: "audit-1", ownerId: "owner-1", agentRunId: "agent-1", sequence: 1, actionType: "proposal_created",
  status: "succeeded", error: {}, createdAt: 103,
};

describe("Admin Agent activity correlation", () => {
  it("prioritizes pending approval cases ahead of newer failed Runs", () => {
    const cases = buildActivityCases({
      runs,
      approvals: [approval],
      recovery: [recovery],
      audit: [audit],
      models: [
        { id: "model-a", displayName: "Grok Video", providerId: "provider-a" },
        { id: "model-b", displayName: "Qwen Video", providerId: "provider-b" },
      ],
    });

    expect(cases.map((item) => item.id)).toEqual(["approval:approval-1", "run:run-failed"]);
    expect(cases[0]).toMatchObject({
      kind: "approval",
      status: "pending",
      title: "提示词改写等待批准",
      currentModelName: "Grok Video",
      targetModelName: "Qwen Video",
      impact: "批准后仅对本次 Run 的下一次尝试应用，不修改画布或节点配置。",
    });
    expect(cases[0]?.timeline.map((item) => item.type)).toEqual(["run", "recovery", "audit", "approval"]);
  });

  it("projects failed Runs with a safe diagnostic summary", () => {
    const cases = buildActivityCases({ runs, approvals: [], recovery: [], audit: [], models: [] });

    expect(cases[0]).toMatchObject({
      id: "run:run-failed",
      kind: "failed",
      status: "failed",
      title: "Workflow Run 执行失败",
      summary: "PROVIDER_TIMEOUT",
      ownerEmail: "failed@example.com",
    });
  });

  it("uses raw model IDs only when historical catalog names are unavailable", () => {
    const cases = buildActivityCases({
      runs: { agentRuns: [], canvasRuns: [] },
      approvals: [],
      recovery: [{ ...recovery, approvalId: undefined, status: "succeeded", currentModelId: "removed-model", targetModelId: "model-b" }],
      audit: [],
      models: [{ id: "model-b", displayName: "Qwen Video", providerId: "provider-b" }],
    });

    expect(cases[0]).toMatchObject({
      id: "recovery:recovery-1",
      kind: "recovered",
      currentModelName: "removed-model",
      targetModelName: "Qwen Video",
    });
  });

  it("does not reorder or mutate API response arrays", () => {
    const approvals = [{ ...approval }, { ...approval, id: "approval-2", canvasRunId: "run-other", createdAt: 300 }];
    const before = JSON.stringify({ runs, approvals, recovery: [recovery], audit: [audit] });

    buildActivityCases({ runs, approvals, recovery: [recovery], audit: [audit], models: [] });

    expect(JSON.stringify({ runs, approvals, recovery: [recovery], audit: [audit] })).toBe(before);
  });
});
