export const WORKFLOW_BOUNDARY_NODE_TYPES = ["workflow-input", "workflow-output"] as const;

export type WorkflowBoundaryNodeType = typeof WORKFLOW_BOUNDARY_NODE_TYPES[number];
export type WorkflowBoundaryPortType = "text" | "image" | "video" | "audio";

export interface WorkflowRegionVisual {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface WorkflowRegionLayoutEntry {
  id: string;
  memberNodeIds: readonly string[];
  region: WorkflowRegionVisual;
}

const DEFAULT_REGION_COLOR = "#2F6B5F";
const DEFAULT_REGION_WIDTH = 640;
const DEFAULT_REGION_HEIGHT = 420;
const REGION_GAP = 80;

export function normalizeWorkflowRegionVisual(input: unknown, index = 0): WorkflowRegionVisual {
  const value = isRecord(input) ? input : {};
  const color = typeof value.color === "string" ? value.color.trim().toUpperCase() : DEFAULT_REGION_COLOR;
  if (!/^#[0-9A-F]{6}$/.test(color)) throw new Error("WORKFLOW_REGION_COLOR_INVALID");
  return {
    x: boundedNumber(value.x, REGION_GAP + Math.max(0, index) * (DEFAULT_REGION_WIDTH + REGION_GAP), -100_000, 100_000),
    y: boundedNumber(value.y, REGION_GAP, -100_000, 100_000),
    width: boundedNumber(value.width, DEFAULT_REGION_WIDTH, 320, 8_000),
    height: boundedNumber(value.height, DEFAULT_REGION_HEIGHT, 220, 8_000),
    color,
  };
}

export function assertWorkflowRegionLayout<T extends WorkflowRegionLayoutEntry>(workflows: readonly T[]): readonly T[] {
  const memberOwners = new Map<string, string>();
  for (const workflow of workflows) {
    for (const nodeId of workflow.memberNodeIds) {
      const owner = memberOwners.get(nodeId);
      if (owner && owner !== workflow.id) {
        throw new Error(`WORKFLOW_MEMBER_CONFLICT:${nodeId}:${owner}:${workflow.id}`);
      }
      memberOwners.set(nodeId, workflow.id);
    }
  }
  for (let leftIndex = 0; leftIndex < workflows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < workflows.length; rightIndex += 1) {
      const left = workflows[leftIndex];
      const right = workflows[rightIndex];
      if (regionsOverlap(left.region, right.region)) {
        throw new Error(`WORKFLOW_REGION_OVERLAP:${left.id}:${right.id}`);
      }
    }
  }
  return workflows;
}

export function isWorkflowBoundaryConnectionAllowed(input: {
  sourceWorkflowId: string | null;
  targetWorkflowId: string | null;
  sourceNodeType: string;
  targetNodeType: string;
}) {
  if (input.sourceWorkflowId === input.targetWorkflowId) {
    if (input.sourceWorkflowId === null) return true;
    return input.targetNodeType !== "workflow-input" && input.sourceNodeType !== "workflow-output";
  }
  if (input.sourceWorkflowId === null) return input.targetNodeType === "workflow-input";
  if (input.targetWorkflowId === null) return input.sourceNodeType === "workflow-output";
  return input.sourceNodeType === "workflow-output" && input.targetNodeType === "workflow-input";
}

export function isWorkflowBoundaryPortType(value: unknown): value is WorkflowBoundaryPortType {
  return value === "text" || value === "image" || value === "video" || value === "audio";
}

function regionsOverlap(left: WorkflowRegionVisual, right: WorkflowRegionVisual) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
