export type CanvasRunStatus =
  | "draft" | "planning" | "awaiting_approval" | "queued" | "running" | "paused"
  | "succeeded" | "failed" | "cancelled";

export type CanvasRunStepStatus =
  | "blocked" | "ready" | "queued" | "running" | "evaluating" | "selecting"
  | "awaiting_approval" | "retry_wait" | "paused" | "succeeded" | "failed" | "cancelled" | "skipped";

export type TaskAttemptStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type AgentApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";
export type AgentRunStatus = "queued" | "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled";

const RUN_TRANSITIONS: Record<CanvasRunStatus, readonly CanvasRunStatus[]> = {
  draft: ["planning", "cancelled"],
  planning: ["awaiting_approval", "queued", "failed", "cancelled"],
  awaiting_approval: ["queued", "cancelled"],
  queued: ["running", "paused", "failed", "cancelled"],
  running: ["paused", "succeeded", "failed", "cancelled"],
  paused: ["queued", "running", "failed", "cancelled"],
  succeeded: [],
  failed: ["queued"],
  cancelled: [],
};

const STEP_TRANSITIONS: Record<CanvasRunStepStatus, readonly CanvasRunStepStatus[]> = {
  blocked: ["ready", "paused", "cancelled", "skipped"],
  ready: ["queued", "paused", "cancelled", "skipped"],
  queued: ["running", "retry_wait", "paused", "failed", "cancelled"],
  running: ["evaluating", "selecting", "succeeded", "retry_wait", "paused", "failed", "cancelled"],
  evaluating: ["selecting", "retry_wait", "paused", "failed", "cancelled"],
  selecting: ["awaiting_approval", "succeeded", "retry_wait", "paused", "failed", "cancelled"],
  awaiting_approval: ["ready", "paused", "failed", "cancelled", "skipped"],
  retry_wait: ["ready", "queued", "paused", "failed", "cancelled"],
  paused: ["blocked", "ready", "queued", "running", "retry_wait", "cancelled"],
  succeeded: [],
  failed: ["retry_wait"],
  cancelled: [],
  skipped: [],
};

const ATTEMPT_TRANSITIONS: Record<TaskAttemptStatus, readonly TaskAttemptStatus[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

const APPROVAL_TRANSITIONS: Record<AgentApprovalStatus, readonly AgentApprovalStatus[]> = {
  pending: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

const AGENT_RUN_TRANSITIONS: Record<AgentRunStatus, readonly AgentRunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["awaiting_approval", "succeeded", "failed", "cancelled"],
  awaiting_approval: ["running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function transitionCanvasRunStatus(current: CanvasRunStatus, next: CanvasRunStatus): CanvasRunStatus {
  return transition("CANVAS_RUN_INVALID_TRANSITION", RUN_TRANSITIONS, current, next);
}

export function transitionCanvasRunStepStatus(current: CanvasRunStepStatus, next: CanvasRunStepStatus): CanvasRunStepStatus {
  return transition("CANVAS_RUN_STEP_INVALID_TRANSITION", STEP_TRANSITIONS, current, next);
}

export function transitionTaskAttemptStatus(current: TaskAttemptStatus, next: TaskAttemptStatus): TaskAttemptStatus {
  return transition("TASK_ATTEMPT_INVALID_TRANSITION", ATTEMPT_TRANSITIONS, current, next);
}

export function transitionAgentApprovalStatus(current: AgentApprovalStatus, next: AgentApprovalStatus): AgentApprovalStatus {
  return transition("AGENT_APPROVAL_INVALID_TRANSITION", APPROVAL_TRANSITIONS, current, next);
}

export function transitionAgentRunStatus(current: AgentRunStatus, next: AgentRunStatus): AgentRunStatus {
  return transition("AGENT_RUN_INVALID_TRANSITION", AGENT_RUN_TRANSITIONS, current, next);
}

function transition<T extends string>(code: string, transitions: Record<T, readonly T[]>, current: T, next: T): T {
  if (!transitions[current].includes(next)) throw new Error(`${code}:${current}->${next}`);
  return next;
}
