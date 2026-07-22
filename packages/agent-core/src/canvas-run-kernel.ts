import type { CanvasRunPlan } from "./workflow-compiler.js";
import type { CanvasRunStepStatus } from "./canvas-run-lifecycle.js";

export interface CanvasRunKernelStep {
  id: string;
  nodeId: string;
  groupId: string | null;
  sequence: number;
  status: CanvasRunStepStatus;
}

const COMPLETE_STEP_STATUSES = new Set<CanvasRunStepStatus>(["succeeded", "skipped"]);
const TERMINAL_STEP_STATUSES = new Set<CanvasRunStepStatus>(["succeeded", "failed", "cancelled", "skipped"]);

export function resolveRunnableCanvasRunSteps(plan: CanvasRunPlan, steps: CanvasRunKernelStep[]) {
  const byNodeId = new Map(steps.map((step) => [step.nodeId, step]));
  const activeScope = firstIncompleteScope(plan, steps);
  if (activeScope === null) return [];
  return steps
    .filter((step) => scopeKey(step.groupId) === activeScope && step.status === "ready")
    .filter((step) => {
      const planned = plan.steps.find((candidate) => candidate.nodeId === step.nodeId);
      return (planned?.dependsOn || []).every((nodeId) => {
        const dependency = byNodeId.get(nodeId);
        return dependency ? COMPLETE_STEP_STATUSES.has(dependency.status) : true;
      });
    })
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}

export function canvasRunKernelOutcome(steps: CanvasRunKernelStep[]): "running" | "succeeded" | "failed" | "cancelled" {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "cancelled")) return "cancelled";
  if (steps.every((step) => COMPLETE_STEP_STATUSES.has(step.status))) return "succeeded";
  return "running";
}

function firstIncompleteScope(plan: CanvasRunPlan, steps: CanvasRunKernelStep[]) {
  const orderedScopes = [...[...plan.groups].sort((left, right) => left.order - right.order).map((group) => scopeKey(group.id)), scopeKey(null)];
  for (const scope of orderedScopes) {
    const scoped = steps.filter((step) => scopeKey(step.groupId) === scope);
    if (scoped.length > 0 && scoped.some((step) => !TERMINAL_STEP_STATUSES.has(step.status))) return scope;
  }
  return null;
}

function scopeKey(groupId: string | null) {
  return groupId || "__standalone__";
}
