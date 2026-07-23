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
  const activeScopes = firstIncompleteScopes(plan, steps);
  if (activeScopes.size === 0) return [];
  return steps
    .filter((step) => activeScopes.has(scopeKey(step.groupId)) && step.status === "ready")
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

function firstIncompleteScopes(plan: CanvasRunPlan, steps: CanvasRunKernelStep[]) {
  const waves: string[][] = [];
  for (const group of [...plan.groups].sort((left, right) => left.order - right.order)) {
    const scope = scopeKey(group.id);
    if (group.mode === "parallel" && waves.length > 0 && waves[waves.length - 1].every((item) => plan.groups.find((candidate) => scopeKey(candidate.id) === item)?.mode === "parallel")) {
      waves[waves.length - 1].push(scope);
    } else {
      waves.push([scope]);
    }
  }
  waves.push([scopeKey(null)]);
  for (const wave of waves) {
    const scoped = steps.filter((step) => wave.includes(scopeKey(step.groupId)));
    if (scoped.length > 0 && scoped.some((step) => !TERMINAL_STEP_STATUSES.has(step.status))) return new Set(wave);
  }
  return new Set<string>();
}

function scopeKey(groupId: string | null) {
  return groupId || "__standalone__";
}
