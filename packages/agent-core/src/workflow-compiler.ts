import { createHash } from "node:crypto";

import {
  findWorkflowStageOrderConflict,
  isWorkflowBoundaryConnectionAllowed,
  isWorkflowBoundaryPortType,
  normalizeWorkflowDocuments,
  reconcileWorkflowStageDefinitions,
  type WorkflowStageMode,
  type WorkflowStageNodeAssignment,
  type WorkflowStageSource,
} from "@xinghuan/shared";

import { CANVAS_RUN_EXECUTABLE_NODE_TYPES, CANVAS_RUN_NODE_CAPABILITIES } from "./node-execution-capabilities.js";

export interface CanvasRunGroupInput {
  id: string;
  order: number;
  name?: string;
  mode?: WorkflowStageMode;
  skipped?: boolean;
}

export interface CanvasRunNodeInput {
  id: string;
  type: string;
  groupId?: string;
  configuration?: Record<string, unknown>;
}

export interface CanvasRunEdgeInput {
  id: string;
  source: string;
  target: string;
}

export interface CompileCanvasRunPlanInput {
  canvasId: string;
  ownerId: string;
  revision: number;
  groups: CanvasRunGroupInput[];
  nodes: CanvasRunNodeInput[];
  edges: CanvasRunEdgeInput[];
}

export interface CanvasRunGroupPlan {
  id: string;
  order: number;
  name?: string;
  mode?: WorkflowStageMode;
  skipped: boolean;
  stepIds: string[];
}

export interface CanvasRunStepPlan {
  id: string;
  nodeId: string;
  nodeType: string;
  groupId: string | null;
  dependsOn: string[];
  skipped: boolean;
  configuration?: Record<string, unknown>;
}

export interface CanvasRunPlan {
  canvasId: string;
  ownerId: string;
  canvasRevision: number;
  workflowId?: string;
  workflowRevision?: number;
  workflowSubgraphHash?: string;
  groups: CanvasRunGroupPlan[];
  steps: CanvasRunStepPlan[];
}

export function compileCanvasRunPlan(input: CompileCanvasRunPlanInput): CanvasRunPlan {
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const groupOrderById = new Map(input.groups.map((group) => [group.id, group.order]));
  const incoming = new Map<string, string[]>();
  for (const node of input.nodes) incoming.set(node.id, []);
  for (const edge of input.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
    const sourceGroupId = nodesById.get(edge.source)?.groupId;
    const targetGroupId = nodesById.get(edge.target)?.groupId;
    const sourceOrder = sourceGroupId ? groupOrderById.get(sourceGroupId) : undefined;
    const targetOrder = targetGroupId ? groupOrderById.get(targetGroupId) : undefined;
    if (sourceOrder !== undefined && targetOrder !== undefined && sourceOrder > targetOrder) {
      throw new Error(`CANVAS_RUN_GROUP_ORDER_CONFLICT:${edge.source}->${edge.target}`);
    }
    incoming.get(edge.target)?.push(edge.source);
  }

  const groupInputs = [...input.groups].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  const groupPlans: CanvasRunGroupPlan[] = [];
  const orderedNodes: CanvasRunNodeInput[] = [];

  for (const group of groupInputs) {
    const groupNodes = input.nodes.filter((node) => node.groupId === group.id);
    const sorted = stableTopologicalSort(groupNodes, input.edges);
    orderedNodes.push(...sorted);
    groupPlans.push({
      id: group.id,
      order: group.order,
      name: group.name || group.id,
      mode: group.mode === "parallel" ? "parallel" : "serial",
      skipped: group.skipped === true,
      stepIds: sorted.map((node) => stepId(node.id)),
    });
  }

  const groupedNodeIds = new Set(orderedNodes.map((node) => node.id));
  orderedNodes.push(...stableTopologicalSort(input.nodes.filter((node) => !groupedNodeIds.has(node.id)), input.edges));

  return {
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    canvasRevision: input.revision,
    groups: groupPlans,
    steps: orderedNodes.map((node) => ({
      id: stepId(node.id),
      nodeId: node.id,
      nodeType: node.type,
      groupId: node.groupId || null,
      dependsOn: [...(incoming.get(node.id) || [])],
      skipped: node.groupId ? input.groups.find((group) => group.id === node.groupId)?.skipped === true : false,
      configuration: node.configuration,
    })),
  };
}

interface CanvasSnapshotNode {
  id?: unknown;
  type?: unknown;
  position?: { x?: unknown; y?: unknown };
  width?: unknown;
  height?: unknown;
  measured?: { width?: unknown; height?: unknown };
  data?: Record<string, unknown>;
}

interface CanvasSnapshotEdge {
  id?: unknown;
  source?: unknown;
  target?: unknown;
}

export function compileCanvasSnapshotRunPlan(input: {
  canvasId: string;
  ownerId: string;
  revision: number;
  data: unknown;
  executableNodeTypes?: ReadonlySet<string>;
}): CanvasRunPlan {
  const data = isRecord(input.data) ? input.data : {};
  const nodes = Array.isArray(data.nodes) ? data.nodes.filter(isRecord) as CanvasSnapshotNode[] : [];
  const edges = Array.isArray(data.edges) ? data.edges.filter(isRecord) as CanvasSnapshotEdge[] : [];
  const executableTypes = input.executableNodeTypes || CANVAS_RUN_EXECUTABLE_NODE_TYPES;
  const groupNodes = nodes.filter((node) => node.type === "groupBox" && typeof node.id === "string");
  const groupIds = groupNodes.map((node) => String(node.id));
  const manager = nodes.find((node) => node.type === "group-execution-manager");
  const managerData = isRecord(manager?.data) ? manager.data : {};
  const requestedOrder = uniqueStrings(managerData.groupOrder);
  const groupOrder = [...requestedOrder.filter((id) => groupIds.includes(id)), ...groupIds.filter((id) => !requestedOrder.includes(id))];
  const skipped = new Set(uniqueStrings(managerData.skippedGroupIds));
  const groups = groupOrder.map((id, order) => ({
    id,
    order,
    name: stringValue(groupNodes.find((group) => group.id === id)?.data?.name) || `分组 ${order + 1}`,
    mode: "serial" as const,
    skipped: skipped.has(id),
  }));
  const executable = nodes.filter((node) => typeof node.id === "string" && typeof node.type === "string" && executableTypes.has(node.type));

  return compileCanvasRunPlan({
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    revision: input.revision,
    groups,
    nodes: executable.map((node) => ({
      id: String(node.id),
      type: String(node.type),
      groupId: groupNodes.find((group) => containsNode(group, node))?.id as string | undefined,
      configuration: extractNodeExecutionConfiguration(node.data, String(node.type)),
    })),
    edges: edges
      .filter((edge) => typeof edge.source === "string" && typeof edge.target === "string")
      .map((edge, index) => ({ id: typeof edge.id === "string" ? edge.id : `edge:${index}`, source: String(edge.source), target: String(edge.target) })),
  });
}

export function compileWorkflowSnapshotRunPlan(input: {
  canvasId: string;
  ownerId: string;
  revision: number;
  workflowId: string;
  data: unknown;
  executableNodeTypes?: ReadonlySet<string>;
}): CanvasRunPlan {
  const data = isRecord(input.data) ? input.data : {};
  const workflows = normalizeWorkflowDocuments(data.workflows);
  const workflow = workflows.find((candidate) => candidate.id === input.workflowId);
  if (!workflow) throw new Error(`WORKFLOW_NOT_FOUND:${input.workflowId}`);
  const nodes = Array.isArray(data.nodes) ? data.nodes.filter(isRecord) as CanvasSnapshotNode[] : [];
  const edges = Array.isArray(data.edges) ? data.edges.filter(isRecord) as CanvasSnapshotEdge[] : [];
  const nodesById = new Map(nodes
    .filter((node): node is CanvasSnapshotNode & { id: string; type: string } => typeof node.id === "string" && typeof node.type === "string")
    .map((node) => [node.id, node]));
  const workflowByNodeId = new Map<string, string>();
  for (const candidate of workflows) {
    for (const nodeId of candidate.memberNodeIds) workflowByNodeId.set(nodeId, candidate.id);
  }
  const memberIds = new Set(workflow.memberNodeIds);
  const variablesById = new Map(workflow.variables.map((variable) => [variable.id, variable]));
  for (const nodeId of memberIds) {
    const node = nodesById.get(nodeId);
    if (!node) throw new Error(`WORKFLOW_MEMBER_NODE_MISSING:${nodeId}`);
    if (node.type === "workflow-input" || node.type === "workflow-output") {
      const nodeData = isRecord(node.data) ? node.data : {};
      if (!isWorkflowBoundaryPortType(nodeData.portType)) {
        throw new Error(`WORKFLOW_BOUNDARY_PORT_TYPE_INVALID:${nodeId}`);
      }
      if (node.type === "workflow-input") {
        const variableId = stringValue(nodeData.variableId);
        const variable = variablesById.get(variableId);
        if (!variable) throw new Error(`WORKFLOW_BOUNDARY_VARIABLE_INVALID:${nodeId}`);
        if (variable.type !== nodeData.portType) {
          throw new Error(`WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH:${nodeId}:${variable.type}:${String(nodeData.portType)}`);
        }
      }
    }
  }
  assertCompleteWorkflowGroups(workflow.id, memberIds, nodes);
  const incomingEdgeCountByNodeId = new Map<string, number>();
  const outgoingEdgeCountByNodeId = new Map<string, number>();
  for (const edge of edges) {
    if (typeof edge.source !== "string" || typeof edge.target !== "string") continue;
    incomingEdgeCountByNodeId.set(edge.target, (incomingEdgeCountByNodeId.get(edge.target) || 0) + 1);
    outgoingEdgeCountByNodeId.set(edge.source, (outgoingEdgeCountByNodeId.get(edge.source) || 0) + 1);
  }
  for (const edge of edges) {
    if (typeof edge.source !== "string" || typeof edge.target !== "string") continue;
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) continue;
    const sourceWorkflowId = workflowByNodeId.get(edge.source) || null;
    const targetWorkflowId = workflowByNodeId.get(edge.target) || null;
    if (!isWorkflowBoundaryConnectionAllowed({
      sourceWorkflowId,
      targetWorkflowId,
      sourceNodeType: source.type,
      targetNodeType: target.type,
    }) && !isAutomaticDisplayOutputEdge({
      edge,
      source,
      target,
      incomingEdgeCountByNodeId,
      outgoingEdgeCountByNodeId,
    })) {
      throw new Error(`WORKFLOW_BOUNDARY_EDGE_INVALID:${edge.source}->${edge.target}`);
    }
    if (sourceWorkflowId === workflow.id && targetWorkflowId === workflow.id) {
      if (target.type === "workflow-input" || source.type === "workflow-output") {
        throw new Error(`WORKFLOW_BOUNDARY_DIRECTION_INVALID:${edge.source}->${edge.target}`);
      }
    }
  }

  const scopedNodes = nodes.filter((node) => typeof node.id === "string" && memberIds.has(node.id));
  const scopedEdges = edges.filter((edge) => typeof edge.source === "string" && typeof edge.target === "string" && memberIds.has(edge.source) && memberIds.has(edge.target));
  const executableNodes = scopedNodes.filter((node): node is CanvasSnapshotNode & { id: string; type: string } => (
    typeof node.id === "string" && typeof node.type === "string" && (input.executableNodeTypes || CANVAS_RUN_EXECUTABLE_NODE_TYPES).has(node.type)
  ));
  const stageProjection = projectWorkflowStages(workflow.id, workflow.stages, scopedNodes, executableNodes);
  const conflict = findWorkflowStageOrderConflict(
    stageProjection.stages,
    stageProjection.assignments,
    scopedEdges.map((edge, index) => ({ id: typeof edge.id === "string" ? edge.id : `edge:${index}`, source: String(edge.source), target: String(edge.target) })),
  );
  if (conflict) throw new Error(`WORKFLOW_STAGE_ORDER_CONFLICT:${conflict.edgeId}:${conflict.source}->${conflict.target}`);
  const stageByNodeId = new Map(stageProjection.assignments.map((assignment) => [assignment.nodeId, assignment.stageId]));
  const compiled = compileCanvasRunPlan({
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    revision: input.revision,
    groups: stageProjection.stages,
    nodes: executableNodes.map((node) => ({
      id: node.id,
      type: node.type,
      groupId: stageByNodeId.get(node.id),
      configuration: extractNodeExecutionConfiguration(node.data, node.type),
    })),
    edges: scopedEdges.map((edge, index) => ({ id: typeof edge.id === "string" ? edge.id : `edge:${index}`, source: String(edge.source), target: String(edge.target) })),
  });
  const workflowPlan = {
    ...compiled,
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
  };
  return {
    ...workflowPlan,
    workflowSubgraphHash: hashWorkflowSubgraph(workflowPlan),
  };
}

function projectWorkflowStages(
  workflowId: string,
  configured: Parameters<typeof reconcileWorkflowStageDefinitions>[1],
  scopedNodes: CanvasSnapshotNode[],
  executableNodes: Array<CanvasSnapshotNode & { id: string; type: string }>,
) {
  const groupNodes = scopedNodes.filter((node): node is CanvasSnapshotNode & { id: string } => node.type === "groupBox" && typeof node.id === "string");
  const sourceByNodeId = new Map<string, string | null>();
  const membersByGroupId = new Map<string, string[]>();
  for (const group of groupNodes) membersByGroupId.set(group.id, []);
  const ungrouped: string[] = [];
  for (const node of executableNodes) {
    const containingGroups = groupNodes.filter((group) => containsNode(group, node));
    if (containingGroups.length > 1) throw new Error(`WORKFLOW_STAGE_MEMBER_CONFLICT:${node.id}:${containingGroups.map((group) => group.id).join(":")}`);
    const sourceGroupNodeId = containingGroups[0]?.id || null;
    sourceByNodeId.set(node.id, sourceGroupNodeId);
    if (sourceGroupNodeId) membersByGroupId.get(sourceGroupNodeId)?.push(node.id);
    else ungrouped.push(node.id);
  }
  const sources: WorkflowStageSource[] = groupNodes.map((group, index) => ({
    sourceGroupNodeId: group.id,
    name: stringValue(group.data?.name) || `阶段 ${index + 1}`,
    memberNodeIds: membersByGroupId.get(group.id) || [],
  }));
  if (ungrouped.length > 0) sources.push({ sourceGroupNodeId: null, name: "未分组阶段", memberNodeIds: ungrouped });
  const stages = reconcileWorkflowStageDefinitions(workflowId, configured, sources);
  const stageIdBySource = new Map(stages.map((stage) => [stage.sourceGroupNodeId || "__ungrouped__", stage.id]));
  const assignments: WorkflowStageNodeAssignment[] = executableNodes.map((node) => ({
    nodeId: node.id,
    stageId: stageIdBySource.get(sourceByNodeId.get(node.id) || "__ungrouped__")!,
  }));
  return { stages, assignments };
}

function containsNode(group: CanvasSnapshotNode, node: CanvasSnapshotNode) {
  const explicitMembers = uniqueStrings(group.data?.memberIds);
  if (typeof node.id === "string" && explicitMembers.includes(node.id)) return true;
  const gx = finite(group.position?.x);
  const gy = finite(group.position?.y);
  const width = finite(group.data?.width ?? group.width ?? group.measured?.width);
  const height = finite(group.data?.height ?? group.height ?? group.measured?.height);
  const nx = finite(node.position?.x) + finite(node.width ?? node.measured?.width, 200) / 2;
  const ny = finite(node.position?.y) + finite(node.height ?? node.measured?.height, 100) / 2;
  return width > 0 && height > 0 && nx >= gx && nx <= gx + width && ny >= gy && ny <= gy + height;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

function isAutomaticDisplayOutputEdge(input: {
  edge: CanvasSnapshotEdge;
  source: CanvasSnapshotNode & { id: string; type: string };
  target: CanvasSnapshotNode & { id: string; type: string };
  incomingEdgeCountByNodeId: ReadonlyMap<string, number>;
  outgoingEdgeCountByNodeId: ReadonlyMap<string, number>;
}) {
  return input.target.type === "output"
    && input.target.id.startsWith(`output-auto-${input.source.id}-`)
    && input.edge.id === `e-auto-${input.target.id}`
    && input.incomingEdgeCountByNodeId.get(input.target.id) === 1
    && !input.outgoingEdgeCountByNodeId.has(input.target.id);
}

function finite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractNodeExecutionConfiguration(value: unknown, nodeType: string): Record<string, unknown> {
  const data = isRecord(value) ? value : {};
  const providerParams = isRecord(data.providerParams) ? data.providerParams : {};
  const alternatives = Array.isArray(data.generationAlternatives)
    ? data.generationAlternatives.filter(isRecord).slice(0, 10).map((item) => ({
      providerId: stringValue(item.providerId),
      modelId: stringValue(item.modelId),
      modelRecordId: stringValue(item.modelRecordId),
      requiresApproval: item.requiresApproval !== false,
      parameterPatch: isRecord(item.parameterPatch) ? item.parameterPatch : {},
    })).filter((item) => item.providerId && item.modelRecordId)
    : [];
  return {
    providerSource: stringValue(data.providerSource),
    providerId: stringValue(data.backendProviderId || data.providerId),
    modelId: stringValue(data.providerModel || data.model),
    modelRecordId: stringValue(data.backendModelId || providerParams.modelRecordId),
    parameterRepair: isRecord(data.agentParameterRepair) ? data.agentParameterRepair : {},
    generationAlternatives: alternatives,
    taskCapability: taskCapability(data, nodeType),
    executionPayload: executionPayload(data),
    serverRuntime: CANVAS_RUN_NODE_CAPABILITIES.find((capability) => capability.nodeType === nodeType)?.serverRuntime || "legacy_browser",
    qualityEvaluationEnabled: data.agentQualityEvaluation === true,
    qualityProfileKey: stringValue(data.agentQualityProfileKey),
    selectionPolicy: qualitySelectionPolicy(data.agentSelectionPolicy),
    selectionMaximum: positiveInteger(data.agentSelectionMaximum, 1, 16),
    selectionMinimumScore: boundedNumber(data.agentSelectionMinimumScore, 0, 100),
    ...(nodeType === "smart-candidate-selector" ? { smartCandidateSelector: smartCandidateSelectorSnapshot(data) } : {}),
    ...(isRunningHubNode(nodeType) ? { runningHub: runningHubExecutionSnapshot(data) } : {}),
  };
}

function smartCandidateSelectorSnapshot(data: Record<string, unknown>) {
  return {
    mediaKind: data.selectorMediaKind === "video" ? "video" : "image",
    mode: data.selectorMode === "ai" ? "ai" : "manual",
    maximum: positiveInteger(data.selectorMaximum, 1, 8),
    minimumConfidence: boundedNumber(data.selectorMinimumConfidence, 0, 1),
    lowConfidencePolicy: data.selectorLowConfidencePolicy === "stop" ? "stop" : "request_manual",
    note: stringValue(data.selectorNote).slice(0, 2_000),
  };
}

function runningHubExecutionSnapshot(data: Record<string, unknown>) {
  const appInfo = isRecord(data.appInfo) ? data.appInfo : {};
  const fields = Array.isArray(appInfo.nodeInfoList) ? appInfo.nodeInfoList
    .filter(isRecord)
    .map((field) => ({
      nodeId: stringValue(field.nodeId),
      fieldName: stringValue(field.fieldName),
      valueType: stringValue(field.valueType || field.fieldType),
    }))
    .filter((field) => field.nodeId && field.fieldName && !hasSensitiveKey(field.fieldName))
    .slice(0, 80)
    : [];
  const values: Record<string, string | number | boolean> = {};
  const rawValues = isRecord(data.paramValues) ? data.paramValues : {};
  for (const [key, raw] of Object.entries(rawValues).slice(0, 120)) {
    if (hasSensitiveKey(key)) continue;
    const value = isRecord(raw) ? raw.value : raw;
    if (typeof value === "string") values[key.slice(0, 300)] = value.slice(0, 2_000_000);
    else if (typeof value === "number" && Number.isFinite(value)) values[key.slice(0, 300)] = value;
    else if (typeof value === "boolean") values[key.slice(0, 300)] = value;
  }
  return {
    catalogId: stringValue(data.rhWorkflowPresetId),
    targetType: appInfo.targetType === "app" ? "app" : "workflow",
    runTargetId: stringValue(appInfo.runTargetId || data.webappId),
    pageId: stringValue(appInfo.pageId),
    webappId: stringValue(appInfo.webappId),
    workflowId: stringValue(appInfo.workflowId),
    instanceType: stringValue(data.instanceType),
    fields,
    values,
  };
}

function isRunningHubNode(nodeType: string) {
  return ["runninghub", "runninghub-wallet", "rh-tools", "rh-toolbox"].includes(nodeType);
}

function hasSensitiveKey(value: string) {
  return /key|secret|token|cookie|password|authorization/i.test(value);
}

function qualitySelectionPolicy(value: unknown) {
  const policy = stringValue(value);
  return ["best", "top_k", "threshold", "diverse"].includes(policy) ? policy : "best";
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(maximum, Math.floor(parsed)) : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : minimum;
}

const EXECUTION_PAYLOAD_KEYS = [
  "prompt", "text", "messages", "negativePrompt", "negative", "size", "aspectRatio", "aspect_ratio", "ratio", "width", "height", "fit",
  "duration", "resolution", "seed", "images", "videos", "audios", "first_frame", "last_frame", "mode",
  "stylePrompt", "voice", "audioFormat", "temperature", "maxTokens", "max_tokens",
  "outputText", "textSegments", "segments", "texts", "imageUrl", "imageUrls", "videoUrl", "videoUrls", "audioUrl", "audioUrls",
  "urls", "generatedImages", "firstFrameUrl", "lastFrameUrl", "materialSetKind", "materialSetItems", "pickKind", "pickIndex",
  "fileName", "fileNames", "fileSize", "fileSizes", "mime", "mimes",
  "sourceText", "splitMode", "delimiter", "chunkSize", "regexPattern", "regexFlags", "regexStrategy",
  "removeEmpty", "trim", "normalizeSpaces", "stripNumbering", "preferUpstream", "prefix", "suffix", "segmentsOverride",
  "portType", "variableId", "label",
] as const;

function assertCompleteWorkflowGroups(workflowId: string, memberIds: ReadonlySet<string>, nodes: CanvasSnapshotNode[]) {
  const groups = nodes.filter((node) => node.type === "groupBox" && typeof node.id === "string" && memberIds.has(node.id));
  for (const group of groups) {
    for (const node of nodes) {
      if (typeof node.id !== "string" || node.id === group.id || node.type === "groupBox") continue;
      if (containsNode(group, node) && !memberIds.has(node.id)) {
        throw new Error(`WORKFLOW_GROUP_MEMBER_OUTSIDE:${workflowId}:${group.id}:${node.id}`);
      }
    }
  }
}

function hashWorkflowSubgraph(plan: Omit<CanvasRunPlan, "workflowSubgraphHash">) {
  const executionContract = {
    workflowId: plan.workflowId,
    workflowRevision: plan.workflowRevision,
    groups: plan.groups,
    steps: plan.steps,
  };
  return createHash("sha256").update(canonicalStringify(executionContract)).digest("hex");
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function executionPayload(data: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of EXECUTION_PAYLOAD_KEYS) {
    const value = sanitizeExecutionValue(data[key], 0);
    if (value !== undefined) payload[key] = value;
  }
  if (data.generationCount !== undefined) {
    payload.generationCount = positiveInteger(data.generationCount, 1, 4);
  }
  const providerParams = isRecord(data.providerParams) ? data.providerParams : {};
  const sanitizedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(providerParams)) {
    if (/key|secret|token|cookie|password|authorization/i.test(key)) continue;
    const sanitized = sanitizeExecutionValue(value, 0);
    if (sanitized !== undefined) sanitizedParams[key.slice(0, 100)] = sanitized;
  }
  if (Object.keys(sanitizedParams).length > 0) payload.providerParams = sanitizedParams;
  return payload;
}

function sanitizeExecutionValue(value: unknown, depth: number): unknown {
  if (depth > 4 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, 2_000_000);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeExecutionValue(item, depth + 1)).filter((item) => item !== undefined);
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 80)) {
      if (/key|secret|token|cookie|password|authorization/i.test(key)) continue;
      const sanitized = sanitizeExecutionValue(item, depth + 1);
      if (sanitized !== undefined) result[key.slice(0, 100)] = sanitized;
    }
    return result;
  }
  return undefined;
}

function taskCapability(data: Record<string, unknown>, nodeType: string) {
  const explicit = stringValue(data.taskCapability);
  if (["image", "video", "audio", "chat"].includes(explicit)) return explicit;
  return nodeType === "llm" ? "chat" : ["image", "video", "audio"].includes(nodeType) ? nodeType : "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function stableTopologicalSort(nodes: CanvasRunNodeInput[], edges: CanvasRunEdgeInput[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const inDegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outgoing.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const ready = nodes.filter((node) => inDegree.get(node.id) === 0);
  const result: CanvasRunNodeInput[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => (indexById.get(left.id) || 0) - (indexById.get(right.id) || 0));
    const node = ready.shift();
    if (!node) break;
    result.push(node);
    for (const target of outgoing.get(node.id) || []) {
      const nextDegree = (inDegree.get(target) || 0) - 1;
      inDegree.set(target, nextDegree);
      if (nextDegree === 0) {
        const targetNode = nodes.find((candidate) => candidate.id === target);
        if (targetNode) ready.push(targetNode);
      }
    }
  }
  if (result.length !== nodes.length) {
    const blocked = nodes.filter((node) => !result.some((item) => item.id === node.id)).map((node) => node.id);
    throw new Error(`CANVAS_RUN_PLAN_CYCLE:${blocked.join(",")}`);
  }
  return result;
}

function stepId(nodeId: string) {
  return `step:${nodeId}`;
}
