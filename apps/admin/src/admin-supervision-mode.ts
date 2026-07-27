import type { AgentRuntimeControl } from "./admin-agent-governance-api";

export type SupervisionMode = "observe" | "controlled" | "automatic" | "custom";
export type SupervisionPreset = Exclude<SupervisionMode, "custom">;

export interface SupervisionModeSummary {
  mode: SupervisionMode;
  label: string;
  summary: string;
  customReasons: string[];
}

const presets: Record<SupervisionPreset, Pick<AgentRuntimeControl,
  "agentEnabled" | "canvasRunsEnabled" | "automaticRecoveryEnabled" | "qualityEvaluationEnabled"
>> = {
  observe: {
    agentEnabled: true,
    canvasRunsEnabled: true,
    automaticRecoveryEnabled: false,
    qualityEvaluationEnabled: false,
  },
  controlled: {
    agentEnabled: true,
    canvasRunsEnabled: true,
    automaticRecoveryEnabled: false,
    qualityEvaluationEnabled: true,
  },
  automatic: {
    agentEnabled: true,
    canvasRunsEnabled: true,
    automaticRecoveryEnabled: true,
    qualityEvaluationEnabled: true,
  },
};

export function deriveSupervisionMode(control: AgentRuntimeControl): SupervisionModeSummary {
  const customReasons = dependencyProblems(control);
  if (customReasons.length) {
    return {
      mode: "custom",
      label: "自定义托管",
      summary: "当前底层开关不匹配安全预设，请检查依赖关系。",
      customReasons,
    };
  }

  if (control.automaticRecoveryEnabled) {
    return {
      mode: "automatic",
      label: "自动恢复",
      summary: "在冻结预算、候选和已发布策略内执行允许的恢复动作。",
      customReasons: [],
    };
  }
  if (control.qualityEvaluationEnabled) {
    return {
      mode: "controlled",
      label: "受控托管",
      summary: "执行确定性运行与质量选择；高风险恢复仍进入人工审批。",
      customReasons: [],
    };
  }
  return {
    mode: "observe",
    label: "仅观察",
    summary: "生成计划与诊断，不执行自动恢复或质量选择。",
    customReasons: [],
  };
}

export function applySupervisionPreset(control: AgentRuntimeControl, mode: SupervisionPreset): AgentRuntimeControl {
  return { ...control, ...presets[mode] };
}

function dependencyProblems(control: AgentRuntimeControl) {
  const reasons: string[] = [];
  if (!control.canvasRunsEnabled) reasons.push("Workflow Run 未启用");
  if (!control.agentEnabled) {
    reasons.push(control.automaticRecoveryEnabled ? "自动恢复依赖 Agent 运行" : "Agent 运行未启用");
  }
  if (control.automaticRecoveryEnabled && !control.qualityEvaluationEnabled) {
    reasons.push("自动恢复预设需要质量评估");
  }
  return reasons;
}
