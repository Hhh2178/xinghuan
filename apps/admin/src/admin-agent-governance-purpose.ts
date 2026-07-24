export const canvasAgentPurposes = [
  { agentKey: "assistant-planner", label: "助手诊断", description: "解释节点错误并给出不修改拓扑的建议。" },
  { agentKey: "admin-assistant-planner", label: "后台助手诊断", description: "分析后台任务、Provider、模型与审计上下文。" },
  { agentKey: "supervision-planner", label: "托管链路分析", description: "分析依赖、并发入口、串行约束与执行风险。" },
  { agentKey: "generation-recovery", label: "失败恢复", description: "执行受预算约束的重试、参数修复和模型回退。" },
  { agentKey: "artifact-image-understanding", label: "图片评估", description: "按已发布质量策略评估图片候选。" },
  { agentKey: "artifact-video-understanding", label: "视频评估", description: "按已发布质量策略评估视频候选。" },
  { agentKey: "artifact-checker", label: "候选选择", description: "复核评分并为显式候选门选择下游输入。" },
] as const;

export const purposeRouteTemplates = [
  { id: "assistant", label: "助手诊断", poolKey: "assistant-diagnosis", name: "助手诊断路由", role: "planner", scenario: "assistant-chat" },
  { id: "admin-assistant", label: "后台助手诊断", poolKey: "admin-assistant-diagnosis", name: "后台助手诊断路由", role: "planner", scenario: "assistant-chat" },
  { id: "supervision", label: "托管链路分析", poolKey: "supervision-planning", name: "托管链路分析路由", role: "planner", scenario: "canvas-supervision-analysis" },
  { id: "recovery", label: "失败恢复", poolKey: "generation-recovery", name: "失败恢复路由", role: "recovery", scenario: "generation-recovery" },
  { id: "image-evaluation", label: "图片评估", poolKey: "artifact-image-evaluation", name: "图片评估路由", role: "image_understanding", scenario: "artifact-quality" },
  { id: "video-evaluation", label: "视频评估", poolKey: "artifact-video-evaluation", name: "视频评估路由", role: "video_understanding", scenario: "artifact-quality" },
  { id: "candidate-selection", label: "候选选择", poolKey: "artifact-candidate-selection", name: "候选选择路由", role: "checker", scenario: "artifact-selection" },
] as const;

export function canvasAgentPurpose(agentKey: string) {
  return canvasAgentPurposes.find((purpose) => purpose.agentKey === agentKey);
}

export function routePurpose(role: string, scenario: string, poolKey?: string) {
  return purposeRouteTemplates.find((purpose) =>
    purpose.role === role && purpose.scenario === scenario && (!poolKey || purpose.poolKey === poolKey),
  );
}
