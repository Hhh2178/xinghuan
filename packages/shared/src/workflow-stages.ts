export const WORKFLOW_STAGE_MODES = ["serial", "parallel"] as const;

export type WorkflowStageMode = typeof WORKFLOW_STAGE_MODES[number];

export interface WorkflowStageDefinition {
  id: string;
  name: string;
  sourceGroupNodeId: string | null;
  order: number;
  mode: WorkflowStageMode;
  skipped: boolean;
}

export interface WorkflowStageSource {
  sourceGroupNodeId: string | null;
  name: string;
  memberNodeIds: string[];
}

export interface WorkflowStageNodeAssignment {
  nodeId: string;
  stageId: string;
}

export interface WorkflowStageEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowStageOrderConflict {
  edgeId: string;
  source: string;
  target: string;
  sourceStageId: string;
  targetStageId: string;
}

export function normalizeWorkflowStageDefinitions(
  input: unknown,
  workflowMemberNodeIds: readonly string[],
): WorkflowStageDefinition[] {
  if (!Array.isArray(input)) return [];
  const memberIds = new Set(workflowMemberNodeIds);
  const stageIds = new Set<string>();
  const sourceIds = new Set<string>();
  let hasUngrouped = false;
  const stages = input.map((raw, index) => {
    if (!isRecord(raw)) throw new Error("WORKFLOW_STAGE_INVALID");
    const id = boundedText(raw.id, 200);
    if (!id) throw new Error("WORKFLOW_STAGE_ID_REQUIRED");
    if (stageIds.has(id)) throw new Error(`WORKFLOW_STAGE_ID_CONFLICT:${id}`);
    stageIds.add(id);
    const sourceGroupNodeId = boundedText(raw.sourceGroupNodeId, 160) || null;
    if (sourceGroupNodeId) {
      if (!memberIds.has(sourceGroupNodeId)) throw new Error(`WORKFLOW_STAGE_GROUP_OUTSIDE:${sourceGroupNodeId}`);
      if (sourceIds.has(sourceGroupNodeId)) throw new Error(`WORKFLOW_STAGE_GROUP_CONFLICT:${sourceGroupNodeId}`);
      sourceIds.add(sourceGroupNodeId);
    } else if (hasUngrouped) {
      throw new Error("WORKFLOW_STAGE_UNGROUPED_CONFLICT");
    } else {
      hasUngrouped = true;
    }
    const mode = WORKFLOW_STAGE_MODES.includes(raw.mode as WorkflowStageMode) ? raw.mode as WorkflowStageMode : "serial";
    return {
      id,
      name: boundedText(raw.name, 160) || (sourceGroupNodeId ? `阶段 ${index + 1}` : "未分组阶段"),
      sourceGroupNodeId,
      order: nonNegativeInteger(raw.order, index),
      mode,
      skipped: raw.skipped === true,
    };
  });
  return stages
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((stage, order) => ({ ...stage, order }));
}

export function reconcileWorkflowStageDefinitions(
  workflowId: string,
  configured: readonly WorkflowStageDefinition[] | undefined,
  sources: readonly WorkflowStageSource[],
): WorkflowStageDefinition[] {
  const uniqueSources: WorkflowStageSource[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const key = source.sourceGroupNodeId || "__ungrouped__";
    if (seen.has(key)) throw new Error(`WORKFLOW_STAGE_SOURCE_CONFLICT:${key}`);
    seen.add(key);
    uniqueSources.push(source);
  }
  const configuredBySource = new Map((configured || []).map((stage) => [stage.sourceGroupNodeId || "__ungrouped__", stage]));
  const sourceKeys = new Set(uniqueSources.map((source) => source.sourceGroupNodeId || "__ungrouped__"));
  const ordered = (configured || [])
    .filter((stage) => sourceKeys.has(stage.sourceGroupNodeId || "__ungrouped__"))
    .map((stage) => {
      const source = uniqueSources.find((candidate) => (candidate.sourceGroupNodeId || "__ungrouped__") === (stage.sourceGroupNodeId || "__ungrouped__"))!;
      return { ...stage, name: stage.name || source.name };
    });
  for (const source of uniqueSources) {
    const key = source.sourceGroupNodeId || "__ungrouped__";
    if (configuredBySource.has(key)) continue;
    ordered.push({
      id: workflowStageId(workflowId, source.sourceGroupNodeId),
      name: source.name || (source.sourceGroupNodeId ? "未命名阶段" : "未分组阶段"),
      sourceGroupNodeId: source.sourceGroupNodeId,
      order: ordered.length,
      mode: "serial",
      skipped: false,
    });
  }
  return ordered.map((stage, order) => ({ ...stage, order }));
}

export function findWorkflowStageOrderConflict(
  stages: readonly WorkflowStageDefinition[],
  assignments: readonly WorkflowStageNodeAssignment[],
  edges: readonly WorkflowStageEdge[],
): WorkflowStageOrderConflict | null {
  const orderByStageId = new Map(stages.map((stage) => [stage.id, stage.order]));
  const stageByNodeId = new Map(assignments.map((assignment) => [assignment.nodeId, assignment.stageId]));
  for (const edge of edges) {
    const sourceStageId = stageByNodeId.get(edge.source);
    const targetStageId = stageByNodeId.get(edge.target);
    if (!sourceStageId || !targetStageId || sourceStageId === targetStageId) continue;
    const sourceOrder = orderByStageId.get(sourceStageId);
    const targetOrder = orderByStageId.get(targetStageId);
    if (sourceOrder === undefined || targetOrder === undefined || sourceOrder <= targetOrder) continue;
    return { edgeId: edge.id, source: edge.source, target: edge.target, sourceStageId, targetStageId };
  }
  return null;
}

export function workflowStageId(workflowId: string, sourceGroupNodeId: string | null) {
  return `workflow-stage:${workflowId}:${sourceGroupNodeId || "ungrouped"}`;
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
