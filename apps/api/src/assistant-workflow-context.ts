import { resolveNodeDisplayIdentity } from "@xinghuan/shared";

const MAX_NODES = 40;
const MAX_EDGES = 80;
const MAX_TEXT_LENGTH = 1_200;
const SENSITIVE_KEY = /key|secret|token|cookie|password|authorization/i;
const ALLOWED_DATA_KEYS = new Set([
  "label", "title", "prompt", "text", "messages", "backendProviderId", "backendModelId", "providerModel", "taskCapability",
  "groupOrder", "skippedGroupIds", "memberIds", "generationAlternatives", "agentQualityEvaluation", "agentQualityProfileKey",
  "agentSelectionPolicy", "agentSelectionMaximum", "agentParameterRepair", "providerParams", "size", "ratio", "aspectRatio",
  "status", "error", "errorMessage", "lastError", "runtimeError", "errorCode", "failureClass", "failureCategory",
  "providerDiagnostic", "providerName", "modelName", "taskId", "requestId", "upstreamHttpStatus",
]);

export function summarizeWorkflowAssistantAttachment(
  payload: Record<string, unknown>,
  options: { detailLevel?: "brief" | "technical" } = {},
) {
  const allNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const allEdges = Array.isArray(payload.edges) ? payload.edges : [];
  const detailLevel = options.detailLevel || "technical";
  const nodes = allNodes.slice(0, MAX_NODES).map((node) => snapshotNode(record(node), detailLevel)).filter((node) => node.displayName || node.nodeType);
  const nodeNames = new Map(allNodes.slice(0, MAX_NODES).map((node, index) => [text(record(node).id, 120), nodes[index]?.displayName || ""]));
  return {
    nodeCount: allNodes.length,
    edgeCount: allEdges.length,
    nodes,
    edges: allEdges.slice(0, MAX_EDGES).map((edge) => snapshotEdge(record(edge), nodeNames, detailLevel)).filter((edge) => edge.source && edge.target),
    truncated: { nodes: allNodes.length > MAX_NODES, edges: allEdges.length > MAX_EDGES },
  };
}

export function summarizeNodeAssistantAttachment(
  payload: Record<string, unknown>,
  options: { detailLevel?: "brief" | "technical" } = {},
) {
  const nodeId = text(payload.id || payload.nodeId, 120);
  const nodeType = text(payload.type || payload.nodeType, 120);
  const displayName = text(payload.displayName || payload.nodeDisplayName, 200)
    || resolveNodeDisplayIdentity({ nodeId, nodeType, customLabel: payload.label || payload.title, catalogLabel: nodeType }).displayName;
  const diagnostic = options.detailLevel === "brief"
    ? briefDiagnostic(payload.diagnostic)
    : safeValue(payload.diagnostic, 0);
  const summary = {
    source: text(payload.source, 80),
    displayName,
    nodeType,
    configuration: safeValue(payload.configuration, 0),
    planContext: safeValue(payload.planContext, 0),
    diagnostic,
  };
  if (options.detailLevel === "brief") return summary;
  return {
    ...summary,
    technical: {
      runId: text(payload.runId, 120),
      nodeId,
      upstreamNodeIds: safeTextList(payload.upstreamNodeIds, 20),
      downstreamNodeIds: safeTextList(payload.downstreamNodeIds, 20),
    },
  };
}

function briefDiagnostic(value: unknown) {
  const diagnostic = record(value);
  return safeValue({
    category: diagnostic.category,
    title: diagnostic.title,
    summary: diagnostic.summary,
    observed: diagnostic.observed,
    likelyCause: diagnostic.likelyCause,
    impact: diagnostic.impact,
    repair: diagnostic.repair,
    retryable: diagnostic.retryable,
  }, 0);
}

function snapshotNode(node: Record<string, unknown>, detailLevel: "brief" | "technical") {
  const data = record(node.data);
  const nodeId = text(node.id, 120);
  const nodeType = text(node.type, 120);
  const displayName = text(node.displayName || node.nodeDisplayName, 200)
    || resolveNodeDisplayIdentity({ nodeId, nodeType, customLabel: data.label || data.title, catalogLabel: nodeType }).displayName;
  const summary = {
    displayName,
    nodeType,
    data: Object.fromEntries(Object.entries(data)
      .filter(([key]) => ALLOWED_DATA_KEYS.has(key) && !SENSITIVE_KEY.test(key))
      .map(([key, value]) => [key, safeValue(value, 0)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined)),
  };
  return detailLevel === "technical" ? { ...summary, technical: { nodeId } } : summary;
}

function snapshotEdge(edge: Record<string, unknown>, nodeNames: Map<string, string>, detailLevel: "brief" | "technical") {
  const edgeId = text(edge.id, 120);
  const sourceNodeId = text(edge.source, 120);
  const targetNodeId = text(edge.target, 120);
  const summary = {
    source: nodeNames.get(sourceNodeId) || "上游节点",
    target: nodeNames.get(targetNodeId) || "下游节点",
  };
  return detailLevel === "technical" ? { ...summary, technical: { edgeId, sourceNodeId, targetNodeId } } : summary;
}

function safeValue(value: unknown, depth: number): unknown {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return safeString(value).slice(0, MAX_TEXT_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .slice(0, 20)
    .map(([key, item]) => [key.slice(0, 120), safeValue(item, depth + 1)])
    .filter((entry): entry is [string, unknown] => entry[1] !== undefined));
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? safeString(value).trim().slice(0, maximum) : "";
}

function safeTextList(value: unknown, maximum: number) {
  return Array.isArray(value)
    ? value.map((item) => text(item, 120)).filter(Boolean).slice(0, maximum)
    : [];
}

function safeString(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [已隐藏]")
    .replace(/https?:\/\/[^\s"'<>]+[?&](?:token|signature|sign|auth|key)=[^\s"'<>]+/gi, "[已隐藏临时链接]");
}
