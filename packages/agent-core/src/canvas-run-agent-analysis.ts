import type { CanvasRunPlan } from "./workflow-compiler.js";

export const CANVAS_RUN_AGENT_ANALYSIS_VERSION = "canvas-run-agent-analysis/v1" as const;

export interface CanvasRunAgentAnalysis {
  version: typeof CANVAS_RUN_AGENT_ANALYSIS_VERSION;
  status: "completed" | "degraded";
  summary: string;
  concurrencyGroups: Array<{ stepIds: string[]; reason: string }>;
  serialConstraints: Array<{ beforeStepId: string; afterStepId: string; reason: string }>;
  risks: string[];
  recommendedMaximumParallelism: number;
  estimatedRequestCount: number;
  deterministicLayerCount: number;
  degradationReason?: string;
}

export function validateCanvasRunAgentAnalysis(input: {
  plan: CanvasRunPlan;
  maximumParallelism: number;
  response: unknown;
}): CanvasRunAgentAnalysis {
  const maximumParallelism = boundedInteger(input.maximumParallelism, 1, 64, 1);
  const fallback = degraded(input.plan, maximumParallelism, "MALFORMED_RESPONSE");
  if (!isRecord(input.response)) return fallback;
  const response = input.response;
  const stepsById = new Map(input.plan.steps.map((step) => [step.id, step]));
  const stepIdByNodeId = new Map(input.plan.steps.map((step) => [step.nodeId, step.id]));
  const layerByStepId = new Map(input.plan.steps.map((step) => [step.id, step.executionLayer]));
  const groups = Array.isArray(response.concurrencyGroups) ? response.concurrencyGroups : [];
  const normalizedGroups: CanvasRunAgentAnalysis["concurrencyGroups"] = [];

  for (const rawGroup of groups) {
    if (!isRecord(rawGroup) || !Array.isArray(rawGroup.stepIds)) return degraded(input.plan, maximumParallelism, "MALFORMED_RESPONSE");
    const stepIds = uniqueStrings(rawGroup.stepIds);
    if (stepIds.some((stepId) => !stepsById.has(stepId))) return degraded(input.plan, maximumParallelism, "UNKNOWN_STEP");
    const layers = new Set(stepIds.map((stepId) => layerByStepId.get(stepId)));
    if (layers.size > 1 || hasDependencyConflict(stepIds, stepsById, stepIdByNodeId)) {
      return degraded(input.plan, maximumParallelism, "DEPENDENCY_CONFLICT");
    }
    normalizedGroups.push({ stepIds, reason: boundedText(rawGroup.reason, 500) });
  }

  const constraints = Array.isArray(response.serialConstraints) ? response.serialConstraints : [];
  const normalizedConstraints: CanvasRunAgentAnalysis["serialConstraints"] = [];
  for (const rawConstraint of constraints) {
    if (!isRecord(rawConstraint)) return degraded(input.plan, maximumParallelism, "MALFORMED_RESPONSE");
    const beforeStepId = boundedText(rawConstraint.beforeStepId, 160);
    const afterStepId = boundedText(rawConstraint.afterStepId, 160);
    if (!stepsById.has(beforeStepId) || !stepsById.has(afterStepId)) return degraded(input.plan, maximumParallelism, "UNKNOWN_STEP");
    normalizedConstraints.push({ beforeStepId, afterStepId, reason: boundedText(rawConstraint.reason, 500) });
  }

  const recommended = boundedInteger(response.recommendedMaximumParallelism, 1, 64, maximumParallelism);
  if (Number(response.recommendedMaximumParallelism) > maximumParallelism) {
    return degraded(input.plan, maximumParallelism, "MAXIMUM_PARALLELISM_EXCEEDED");
  }
  return {
    version: CANVAS_RUN_AGENT_ANALYSIS_VERSION,
    status: "completed",
    summary: boundedText(response.summary, 2_000) || deterministicSummary(input.plan),
    concurrencyGroups: normalizedGroups,
    serialConstraints: normalizedConstraints,
    risks: uniqueStrings(response.risks).slice(0, 20).map((risk) => risk.slice(0, 500)),
    recommendedMaximumParallelism: recommended,
    estimatedRequestCount: deterministicRequestCount(input.plan),
    deterministicLayerCount: executionLayers(input.plan).length,
  };
}

export function degradedCanvasRunAgentAnalysis(input: {
  plan: CanvasRunPlan;
  maximumParallelism: number;
  reason: string;
}) {
  return degraded(input.plan, boundedInteger(input.maximumParallelism, 1, 64, 1), boundedText(input.reason, 160) || "AGENT_ANALYSIS_UNAVAILABLE");
}

function degraded(plan: CanvasRunPlan, maximumParallelism: number, reason: string): CanvasRunAgentAnalysis {
  return {
    version: CANVAS_RUN_AGENT_ANALYSIS_VERSION,
    status: "degraded",
    summary: deterministicSummary(plan),
    concurrencyGroups: executionLayers(plan).filter((layer) => layer.stepIds.length > 1).map((layer) => ({
      stepIds: [...layer.stepIds],
      reason: "确定性依赖图允许同层执行。",
    })),
    serialConstraints: [],
    risks: ["Agent 分析不可用，运行将继续使用确定性执行层。"],
    recommendedMaximumParallelism: maximumParallelism,
    estimatedRequestCount: deterministicRequestCount(plan),
    deterministicLayerCount: executionLayers(plan).length,
    degradationReason: reason,
  };
}

function deterministicSummary(plan: CanvasRunPlan) {
  return `确定性计划包含 ${executionLayers(plan).length} 个执行层、${executableStepCount(plan)} 个可执行步骤。`;
}

function executionLayers(plan: CanvasRunPlan) {
  if (Array.isArray(plan.executionLayers)) return plan.executionLayers;
  const stepIds = plan.steps.filter((step) => !step.skipped).map((step) => step.id);
  return stepIds.length > 0 ? [{ index: 0, stepIds }] : [];
}

function executableStepCount(plan: CanvasRunPlan) {
  return plan.steps.filter((step) => !step.skipped).length;
}

function deterministicRequestCount(plan: CanvasRunPlan) {
  return plan.steps.reduce((total, step) => {
    if (step.skipped) return total;
    const capability = String(step.configuration?.taskCapability || "").trim()
      || (step.nodeType === "llm" ? "chat" : ["image", "video", "audio"].includes(step.nodeType) ? step.nodeType : "");
    if (!capability) return total;
    const payload = step.configuration?.executionPayload;
    const requested = payload && typeof payload === "object" && !Array.isArray(payload)
      ? Number((payload as Record<string, unknown>).generationCount)
      : 1;
    return total + (Number.isInteger(requested) ? Math.max(1, Math.min(4, requested)) : 1);
  }, 0);
}

function hasDependencyConflict(
  stepIds: string[],
  stepsById: ReadonlyMap<string, CanvasRunPlan["steps"][number]>,
  stepIdByNodeId: ReadonlyMap<string, string>,
) {
  const candidates = new Set(stepIds);
  const reachesCandidate = (stepId: string, visited = new Set<string>()): boolean => {
    if (visited.has(stepId)) return false;
    visited.add(stepId);
    const step = stepsById.get(stepId);
    if (!step) return false;
    return step.dependsOn.some((nodeId) => {
      const dependencyStepId = stepIdByNodeId.get(nodeId);
      return Boolean(dependencyStepId && (candidates.has(dependencyStepId) || reachesCandidate(dependencyStepId, visited)));
    });
  };
  return stepIds.some((stepId) => reachesCandidate(stepId));
}

function uniqueStrings(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => boundedText(item, 160)).filter(Boolean))]
    : [];
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
