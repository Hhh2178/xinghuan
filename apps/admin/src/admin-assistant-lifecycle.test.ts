import { describe, expect, it } from "vitest";

import { deriveAssistantLifecycle, formatAssistantVerificationDetail } from "./admin-assistant-lifecycle.js";

const approvedDefinition = {
  enabled: true,
  versions: [{ id: "agent-v2", version: 2, status: "approved" as const }],
  publications: [
    { environment: "gray" as const, configurationVersionId: "agent-v2" },
    { environment: "production" as const, configurationVersionId: "agent-v2" },
  ],
};

const approvedPool = {
  enabled: true,
  versions: [{
    id: "route-v3",
    version: 3,
    status: "approved" as const,
    entries: [{ enabled: true }],
    publications: [
      { environment: "gray" as const },
      { environment: "production" as const },
    ],
  }],
};

describe("assistant lifecycle readiness", () => {
  it("summarizes verification from runtime evidence instead of model prose", () => {
    expect(formatAssistantVerificationDetail({
      environment: "gray",
      agentVersionLabel: "Agent v3",
      routeVersionLabel: "路由 v1",
    })).toBe("Agent 模式 · Gray · Agent v3 · 路由 v1 · 真实请求已完成");
  });

  it("stops at assistant capability when the surface is disabled", () => {
    const result = deriveAssistantLifecycle({
      enabled: false,
      environment: "production",
      definition: approvedDefinition,
      pools: [approvedPool],
      lastVerification: null,
    });

    expect(result.currentStep).toBe("capability");
    expect(result.conclusion).toBe("助手尚未启用");
    expect(result.issues.map((issue) => issue.code)).toEqual(["surface_disabled"]);
  });

  it("requires both an approved Agent version and an enabled route candidate", () => {
    const result = deriveAssistantLifecycle({
      enabled: true,
      environment: "production",
      definition: {
        ...approvedDefinition,
        versions: [{ id: "agent-v2", version: 2, status: "review" as const }],
      },
      pools: [{
        ...approvedPool,
        versions: [{ ...approvedPool.versions[0], entries: [{ enabled: false }] }],
      }],
      lastVerification: null,
    });

    expect(result.currentStep).toBe("routing");
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "agent_not_approved",
      "route_has_no_candidate",
    ]);
  });

  it("does not treat a Gray-only route publication as Production-ready", () => {
    const result = deriveAssistantLifecycle({
      enabled: true,
      environment: "production",
      definition: approvedDefinition,
      pools: [{
        ...approvedPool,
        versions: [{
          ...approvedPool.versions[0],
          publications: [{ environment: "gray" as const }],
        }],
      }],
      lastVerification: null,
    });

    expect(result.currentStep).toBe("publication");
    expect(result.conclusion).toBe("Production 路由未发布");
    expect(result.issues.map((issue) => issue.code)).toEqual(["route_not_published"]);
  });

  it("requires a successful real verification after publication", () => {
    const pending = deriveAssistantLifecycle({
      enabled: true,
      environment: "production",
      definition: approvedDefinition,
      pools: [approvedPool],
      lastVerification: null,
    });
    const verified = deriveAssistantLifecycle({
      enabled: true,
      environment: "production",
      definition: approvedDefinition,
      pools: [approvedPool],
      lastVerification: { status: "succeeded", verifiedAt: 1785120000000 },
    });

    expect(pending.currentStep).toBe("verification");
    expect(pending.conclusion).toBe("已发布，等待真实验证");
    expect(pending.issues.map((issue) => issue.code)).toEqual(["verification_required"]);
    expect(verified.currentStep).toBe("verification");
    expect(verified.complete).toBe(true);
    expect(verified.conclusion).toBe("Production 已生效");
    expect(verified.issues).toEqual([]);
  });

  it("reports a missing fixed Agent definition before publication", () => {
    const result = deriveAssistantLifecycle({
      enabled: true,
      environment: "gray",
      definition: undefined,
      pools: [approvedPool],
      lastVerification: null,
    });

    expect(result.currentStep).toBe("capability");
    expect(result.conclusion).toBe("缺少助手 Agent 定义");
    expect(result.issues.map((issue) => issue.code)).toEqual(["definition_missing"]);
  });
});
