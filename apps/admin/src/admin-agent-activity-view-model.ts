import type {
  AgentApproval,
  AgentAuditRecord,
  AgentRunSummary,
  AgentRunsData,
  RecoveryDecision,
} from "./admin-agent-governance-api";

export type ActivityCaseKind = "approval" | "failed" | "degraded" | "recovered";

export interface ActivityTimelineItem {
  id: string;
  type: "run" | "recovery" | "audit" | "approval";
  title: string;
  detail: string;
  createdAt: number;
}

export interface ActivityCase {
  id: string;
  kind: ActivityCaseKind;
  status: string;
  title: string;
  summary: string;
  ownerEmail: string;
  canvasRunId: string;
  runStepId?: string;
  createdAt: number;
  currentModelName?: string;
  targetModelName?: string;
  impact: string;
  approval?: AgentApproval;
  recovery?: RecoveryDecision;
  timeline: ActivityTimelineItem[];
}

interface ActivityModelIdentity {
  id: string;
  displayName: string;
  providerId: string;
}

export interface BuildActivityCasesInput {
  runs: AgentRunsData;
  approvals: AgentApproval[];
  recovery: RecoveryDecision[];
  audit: AgentAuditRecord[];
  models: ActivityModelIdentity[];
}

export function buildActivityCases(input: BuildActivityCasesInput): ActivityCase[] {
  const modelNames = new Map(input.models.map((model) => [model.id, model.displayName]));
  const canvasRuns = new Map(input.runs.canvasRuns.map((run) => [run.id, run]));
  const agentRunsByCanvas = groupBy(input.runs.agentRuns.filter((run) => run.canvasRunId), (run) => run.canvasRunId || "");
  const auditByAgent = groupBy(input.audit, (record) => record.agentRunId);
  const recoveryByApproval = new Map(input.recovery.filter((item) => item.approvalId).map((item) => [item.approvalId as string, item]));
  const cases: Array<ActivityCase & { priority: number }> = [];

  for (const approval of input.approvals) {
    if (approval.status !== "pending") continue;
    const recovery = recoveryByApproval.get(approval.id);
    const run = canvasRuns.get(approval.canvasRunId);
    cases.push({
      id: `approval:${approval.id}`,
      kind: "approval",
      priority: 0,
      status: approval.status,
      title: approvalTitle(approval.actionType),
      summary: recovery?.reason || "该动作超出当前自动执行边界，需要管理员决定。",
      ownerEmail: approval.ownerEmail,
      canvasRunId: approval.canvasRunId,
      runStepId: approval.runStepId,
      createdAt: approval.createdAt,
      currentModelName: modelName(recovery?.currentModelId, modelNames),
      targetModelName: modelName(recovery?.targetModelId, modelNames),
      impact: approvalImpact(approval.actionType),
      approval,
      recovery,
      timeline: buildTimeline(run, recovery, approval, agentRunsByCanvas, auditByAgent),
    });
  }

  const pendingRunIds = new Set(cases.map((item) => item.canvasRunId));
  for (const run of input.runs.canvasRuns) {
    if (pendingRunIds.has(run.id) || (run.status !== "failed" && run.status !== "degraded")) continue;
    cases.push({
      id: `run:${run.id}`,
      kind: run.status === "failed" ? "failed" : "degraded",
      priority: run.status === "failed" ? 1 : 2,
      status: run.status,
      title: run.status === "failed" ? "Workflow Run 执行失败" : "Workflow Run 已降级",
      summary: safeErrorSummary(run.error),
      ownerEmail: run.ownerEmail,
      canvasRunId: run.id,
      createdAt: run.updatedAt,
      impact: run.status === "failed" ? "运行已停止；检查失败步骤后从最新工作流创建新 Run。" : "运行保留现有结果，并已记录降级原因。",
      timeline: buildTimeline(run, undefined, undefined, agentRunsByCanvas, auditByAgent),
    });
  }

  const linkedRecoveryIds = new Set([...recoveryByApproval.values()].map((item) => item.id));
  for (const recovery of input.recovery) {
    if (linkedRecoveryIds.has(recovery.id)) continue;
    const recovered = ["approved", "applied", "succeeded", "completed"].includes(recovery.status);
    cases.push({
      id: `recovery:${recovery.id}`,
      kind: recovered ? "recovered" : "degraded",
      priority: recovered ? 3 : 2,
      status: recovery.status,
      title: recovered ? "恢复动作已完成" : "恢复动作需要关注",
      summary: recovery.reason,
      ownerEmail: recovery.ownerEmail,
      canvasRunId: recovery.canvasRunId,
      runStepId: recovery.runStepId,
      createdAt: recovery.createdAt,
      currentModelName: modelName(recovery.currentModelId, modelNames),
      targetModelName: modelName(recovery.targetModelId, modelNames),
      impact: recovered ? "恢复只应用于对应 Run 的冻结执行上下文。" : "查看失败分类和审批边界后决定下一步。",
      recovery,
      timeline: buildTimeline(canvasRuns.get(recovery.canvasRunId), recovery, undefined, agentRunsByCanvas, auditByAgent),
    });
  }

  return cases
    .sort((left, right) => left.priority - right.priority || right.createdAt - left.createdAt)
    .map(({ priority: _priority, ...item }) => item);
}

function buildTimeline(
  run: AgentRunSummary | undefined,
  recovery: RecoveryDecision | undefined,
  approval: AgentApproval | undefined,
  agentRunsByCanvas: Map<string, AgentRunSummary[]>,
  auditByAgent: Map<string, AgentAuditRecord[]>,
): ActivityTimelineItem[] {
  const items: ActivityTimelineItem[] = [];
  if (run) items.push({ id: `run:${run.id}`, type: "run", title: "Workflow Run 状态", detail: run.status, createdAt: run.updatedAt });
  if (recovery) items.push({ id: `recovery:${recovery.id}`, type: "recovery", title: recovery.decision, detail: recovery.reason, createdAt: recovery.createdAt });
  for (const agentRun of agentRunsByCanvas.get(run?.id || approval?.canvasRunId || recovery?.canvasRunId || "") || []) {
    for (const record of (auditByAgent.get(agentRun.id) || []).slice().sort((left, right) => left.sequence - right.sequence)) {
      items.push({ id: `audit:${record.id}`, type: "audit", title: record.actionType, detail: record.toolName || record.status, createdAt: record.createdAt });
    }
  }
  if (approval) items.push({ id: `approval:${approval.id}`, type: "approval", title: "等待管理员决定", detail: approval.actionType, createdAt: approval.createdAt });
  return items;
}

function approvalTitle(actionType: string) {
  if (actionType.includes("prompt") || actionType.includes("rewrite")) return "提示词改写等待批准";
  if (actionType.includes("model") || actionType.includes("fallback")) return "模型切换等待批准";
  return "恢复动作等待批准";
}

function approvalImpact(actionType: string) {
  if (actionType.includes("prompt") || actionType.includes("rewrite")) {
    return "批准后仅对本次 Run 的下一次尝试应用，不修改画布或节点配置。";
  }
  if (actionType.includes("model") || actionType.includes("fallback")) {
    return "批准后仅在本次 Run 的冻结候选范围内切换模型，不改变目录或其他 Run。";
  }
  return "批准后只执行该审批记录声明的动作，并写入不可变审计。";
}

function modelName(modelId: string | undefined, names: Map<string, string>) {
  return modelId ? names.get(modelId) || modelId : undefined;
}

function safeErrorSummary(error: Record<string, unknown> | undefined) {
  const value = error?.title || error?.code || error?.message;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : "运行失败，未提供可读诊断。";
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const itemKey = key(value);
    grouped.set(itemKey, [...(grouped.get(itemKey) || []), value]);
  }
  return grouped;
}
