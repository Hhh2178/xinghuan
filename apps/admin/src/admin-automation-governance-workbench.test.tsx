import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assistantSource = readFileSync(new URL("./admin-assistant-governance-workspace.tsx", import.meta.url), "utf8");
const governanceSource = readFileSync(new URL("./admin-agent-governance-workspace.tsx", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("./admin-agent-activity-workspace.tsx", import.meta.url), "utf8");

function expectAutomationTemplate(source: string) {
  expect(source).toContain('from "./admin-governance-workbench"');
  expect(source).toContain("<AdminGovernanceWorkbench");
  expect(source).toContain('mode="automation"');
  expect(source).toContain("<AdminGovernanceContext");
  expect(source).not.toContain("<h1");
}

describe("Admin automation governance workbenches", () => {
  it("gives the assistant route one automation template and keeps revision-aware surface settings", () => {
    expectAutomationTemplate(assistantSource);
    expect(assistantSource).toContain("AI 助手治理");
    expect(assistantSource).toContain("创作侧助手");
    expect(assistantSource).toContain("后台 AI 助手");
    expect(assistantSource).toContain("await onSave(draft)");
    expect(assistantSource).toContain("revision {draft.revision}");
    expect(assistantSource).toContain("保存当前助手设置");
  });

  it("gives supervision and activity one parent automation template with route-specific context", () => {
    expectAutomationTemplate(governanceSource);
    expect(governanceSource).toContain("viewTitle(activeView)");
    expect(governanceSource).toContain('supervision: "AI 托管与自动化"');
    expect(governanceSource).toContain('activity: "运行与审计"');
    expect(governanceSource).toContain("agent-metric-grid");
    expect(governanceSource).toContain("AdminAgentRoleConfigurationEditor");
    expect(governanceSource).toContain("AdminAgentPoolEditor");
    expect(governanceSource).toContain("AdminAgentQualityEditor");
    expect(governanceSource).toContain("navigation.dirty");
    expect(activitySource).not.toContain("AdminGovernanceWorkbench");
  });

  it("keeps activity queue/detail, evidence, and approval writes in the activity owner", () => {
    expect(activitySource).toContain('from "./admin-governance-workbench"');
    expect(activitySource).toContain("<AdminGovernanceLayout");
    expect(activitySource).toContain('className="agent-activity-queue"');
    expect(activitySource).toContain('className="agent-activity-detail"');
    expect(activitySource).toContain("buildActivityCases");
    expect(activitySource).toContain("证据时间线");
    expect(activitySource).toContain("决策理由");
    expect(activitySource).toContain("window.confirm");
    expect(activitySource).toContain("adminAgentGovernanceApi.decideApproval");
    expect(activitySource).toContain('decide("rejected")');
    expect(activitySource).toContain('decide("approved")');
  });
});
