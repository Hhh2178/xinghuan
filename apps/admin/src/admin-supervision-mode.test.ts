import { describe, expect, it } from "vitest";

import { applySupervisionPreset, deriveSupervisionMode } from "./admin-supervision-mode.js";

const base = {
  environment: "gray" as const,
  agentEnabled: true,
  canvasRunsEnabled: true,
  automaticRecoveryEnabled: false,
  qualityEvaluationEnabled: false,
  revision: 7,
  updatedAt: 1785120000000,
};

describe("effective supervision modes", () => {
  it("derives observation mode when recovery and quality evaluation are off", () => {
    expect(deriveSupervisionMode(base)).toEqual({
      mode: "observe",
      label: "仅观察",
      summary: "生成计划与诊断，不执行自动恢复或质量选择。",
      customReasons: [],
    });
  });

  it("derives controlled mode when quality evaluation is enabled without automatic recovery", () => {
    expect(deriveSupervisionMode({ ...base, qualityEvaluationEnabled: true })).toMatchObject({
      mode: "controlled",
      label: "受控托管",
      customReasons: [],
    });
  });

  it("derives automatic mode only when all required controls are enabled", () => {
    expect(deriveSupervisionMode({
      ...base,
      automaticRecoveryEnabled: true,
      qualityEvaluationEnabled: true,
    })).toMatchObject({ mode: "automatic", label: "自动恢复" });

    expect(deriveSupervisionMode({
      ...base,
      agentEnabled: false,
      automaticRecoveryEnabled: true,
      qualityEvaluationEnabled: true,
    })).toMatchObject({
      mode: "custom",
      customReasons: ["自动恢复依赖 Agent 运行"],
    });
  });

  it("reports disabled execution combinations as custom instead of pretending supervision works", () => {
    expect(deriveSupervisionMode({ ...base, canvasRunsEnabled: false })).toEqual({
      mode: "custom",
      label: "自定义托管",
      summary: "当前底层开关不匹配安全预设，请检查依赖关系。",
      customReasons: ["Workflow Run 未启用"],
    });
  });

  it.each([
    ["observe", { agentEnabled: true, canvasRunsEnabled: true, automaticRecoveryEnabled: false, qualityEvaluationEnabled: false }],
    ["controlled", { agentEnabled: true, canvasRunsEnabled: true, automaticRecoveryEnabled: false, qualityEvaluationEnabled: true }],
    ["automatic", { agentEnabled: true, canvasRunsEnabled: true, automaticRecoveryEnabled: true, qualityEvaluationEnabled: true }],
  ] as const)("applies the %s preset without changing environment or revision", (mode, expected) => {
    expect(applySupervisionPreset({ ...base, agentEnabled: false, canvasRunsEnabled: false }, mode)).toEqual({
      ...base,
      ...expected,
    });
  });
});
