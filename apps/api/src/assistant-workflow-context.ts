const MAX_NODES = 40;
const MAX_EDGES = 80;
const MAX_TEXT_LENGTH = 1_200;
const SENSITIVE_KEY = /key|secret|token|cookie|password|authorization/i;
const ALLOWED_DATA_KEYS = new Set([
  "label", "title", "prompt", "text", "messages", "backendProviderId", "backendModelId", "providerModel", "taskCapability",
  "groupOrder", "skippedGroupIds", "memberIds", "generationAlternatives", "agentQualityEvaluation", "agentQualityProfileKey",
  "agentSelectionPolicy", "agentSelectionMaximum", "agentParameterRepair", "providerParams", "size", "ratio", "aspectRatio",
]);

export function summarizeWorkflowAssistantAttachment(payload: Record<string, unknown>) {
  const allNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const allEdges = Array.isArray(payload.edges) ? payload.edges : [];
  return {
    nodeCount: allNodes.length,
    edgeCount: allEdges.length,
    nodes: allNodes.slice(0, MAX_NODES).map((node) => snapshotNode(record(node))).filter((node) => node.id || node.type),
    edges: allEdges.slice(0, MAX_EDGES).map((edge) => snapshotEdge(record(edge))).filter((edge) => edge.source && edge.target),
    truncated: { nodes: allNodes.length > MAX_NODES, edges: allEdges.length > MAX_EDGES },
  };
}

function snapshotNode(node: Record<string, unknown>) {
  const data = record(node.data);
  return {
    id: text(node.id, 120),
    type: text(node.type, 120),
    data: Object.fromEntries(Object.entries(data)
      .filter(([key]) => ALLOWED_DATA_KEYS.has(key) && !SENSITIVE_KEY.test(key))
      .map(([key, value]) => [key, safeValue(value, 0)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined)),
  };
}

function snapshotEdge(edge: Record<string, unknown>) {
  return { id: text(edge.id, 120), source: text(edge.source, 120), target: text(edge.target, 120) };
}

function safeValue(value: unknown, depth: number): unknown {
  if (depth > 3 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.slice(0, MAX_TEXT_LENGTH);
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
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}
