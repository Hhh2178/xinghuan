import { CANVAS_RUN_NODE_CAPABILITIES, getNodeExecutionCapability, type NodeExecutionCapability } from "./node-execution-capabilities.js";

export type KnowledgeEnvironment = "gray" | "production";
export type KnowledgeAudience = "public" | "internal";

export interface AgentModelCatalogSource {
  id: string;
  modelId: string;
  displayName: string;
  capability: string;
  providerId: string;
  providerName: string;
  providerProtocol: string;
  enabled: boolean;
  providerEnabled: boolean;
  inputProfile: string;
  inputCapabilities: Record<string, unknown>;
  capabilityTags: string[];
  parameterSchema: string | Record<string, unknown>;
  testState?: unknown;
  providerHealthState?: string;
}

export interface AgentModelProjection {
  id: string;
  modelId: string;
  displayName: string;
  provider: { id: string; name: string; protocol: string };
  purpose: string;
  inputProfile: string;
  inputCapabilities: Record<string, unknown>;
  capabilityTags: string[];
  compatibleNodeTypes: string[];
  parameterSchema: string | Record<string, unknown>;
  tendencies: { cost: "low" | "medium" | "high" | "unknown"; latency: "low" | "medium" | "high" | "unknown"; quality: "standard" | "high" | "unknown" };
  llmEligible: boolean;
  health: { state: string; p95LatencyMs: number | null };
  enabled: boolean;
}

export interface KnowledgeDocumentProjection {
  publicationId: string;
  documentId: string;
  documentKey: string;
  collectionKey: string;
  audience: KnowledgeAudience;
  environment: KnowledgeEnvironment;
  version: number;
  title: string;
  body: string;
  bodyHash: string;
}

export interface WorkflowTemplateReference {
  templateKey: string;
  revision: number;
  hash: string;
  documentId: string;
}

export interface KnowledgeSnapshotCanonicalValue {
  environment: KnowledgeEnvironment;
  audience: KnowledgeAudience;
  nodeCatalogVersion: string;
  nodeCatalogHash: string;
  modelCatalogRevision: string;
  modelCatalogHash: string;
  documentPublications: KnowledgeDocumentProjection[];
  workflowTemplates: WorkflowTemplateReference[];
}

export function projectAgentModelCatalog(
  sources: readonly AgentModelCatalogSource[],
  nodes: readonly NodeExecutionCapability[] = CANVAS_RUN_NODE_CAPABILITIES,
): AgentModelProjection[] {
  return sources.map((source) => ({
    id: source.id,
    modelId: source.modelId,
    displayName: source.displayName,
    provider: { id: source.providerId, name: source.providerName, protocol: source.providerProtocol },
    purpose: source.capability,
    inputProfile: source.inputProfile,
    inputCapabilities: plainObject(source.inputCapabilities),
    capabilityTags: stringArray(source.capabilityTags),
    compatibleNodeTypes: nodes
      .filter((node) => modelSupportsNode(source, node))
      .map((node) => node.nodeType)
      .sort(),
    parameterSchema: typeof source.parameterSchema === "string" ? source.parameterSchema : plainObject(source.parameterSchema),
    tendencies: inferTendencies(source),
    llmEligible: source.capability === "chat",
    health: normalizeHealth(source.testState, source.providerHealthState),
    enabled: source.enabled && source.providerEnabled,
  })).sort((left, right) => left.id.localeCompare(right.id));
}

export function queryAgentModels(models: readonly AgentModelProjection[], input: {
  exactId?: string;
  exactModelId?: string;
  compatibleNodeType?: string;
  llmEligible?: boolean;
  enabled?: boolean;
}): AgentModelProjection[] {
  return models.filter((model) =>
    (!input.exactId || model.id === input.exactId)
    && (!input.exactModelId || model.modelId === input.exactModelId)
    && (!input.compatibleNodeType || model.compatibleNodeTypes.includes(input.compatibleNodeType))
    && (input.llmEligible === undefined || model.llmEligible === input.llmEligible)
    && (input.enabled === undefined || model.enabled === input.enabled));
}

export function retrieveKnowledgeDocuments(documents: readonly KnowledgeDocumentProjection[], input: {
  query: string;
  collectionAllowlist: string[];
  audience: KnowledgeAudience;
  environment: KnowledgeEnvironment;
  topK: number;
  tokenBudget: number;
}) {
  const allowlist = new Set(input.collectionAllowlist);
  const queryTerms = tokenize(input.query);
  const maximumItems = boundInteger(input.topK, 1, 20);
  let remainingTokens = boundInteger(input.tokenBudget, 1, 32_000);
  const ranked = documents
    .filter((document) => allowlist.has(document.collectionKey)
      && document.audience === input.audience
      && document.environment === input.environment)
    .map((document) => ({ document, score: lexicalScore(document, queryTerms) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score
      || left.document.collectionKey.localeCompare(right.document.collectionKey)
      || left.document.documentKey.localeCompare(right.document.documentKey));

  const items: Array<KnowledgeDocumentProjection & { citation: string; estimatedTokens: number }> = [];
  for (const entry of ranked) {
    if (items.length >= maximumItems || remainingTokens <= 0) break;
    const maximumCharacters = remainingTokens * 4;
    const body = entry.document.body.slice(0, maximumCharacters).trim();
    if (!body) continue;
    const estimatedTokens = estimateTokens(body);
    if (estimatedTokens > remainingTokens) continue;
    items.push({
      ...entry.document,
      body,
      citation: `knowledge://${entry.document.collectionKey}/${entry.document.documentKey}@${entry.document.version}`,
      estimatedTokens,
    });
    remainingTokens -= estimatedTokens;
  }
  return { items, totalEstimatedTokens: input.tokenBudget - remainingTokens };
}

export function buildKnowledgeSnapshotCanonicalValue(input: KnowledgeSnapshotCanonicalValue): KnowledgeSnapshotCanonicalValue {
  return {
    environment: input.environment,
    audience: input.audience,
    nodeCatalogVersion: input.nodeCatalogVersion,
    nodeCatalogHash: input.nodeCatalogHash,
    modelCatalogRevision: input.modelCatalogRevision,
    modelCatalogHash: input.modelCatalogHash,
    documentPublications: [...input.documentPublications].sort((left, right) => left.publicationId.localeCompare(right.publicationId)),
    workflowTemplates: [...input.workflowTemplates].sort((left, right) => left.templateKey.localeCompare(right.templateKey) || left.revision - right.revision),
  };
}

export interface WorkflowSnapshot {
  revisionId: string;
  nodes: Array<{ id: string; type: string; [key: string]: unknown }>;
  edges: Array<{ id: string; source: string; target: string; [key: string]: unknown }>;
}

export function validateWorkflowSnapshot(workflow: WorkflowSnapshot) {
  const issues: Array<{ code: string; subjectId: string }> = [];
  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) issues.push({ code: "DUPLICATE_NODE_ID", subjectId: node.id });
    nodeIds.add(node.id);
    if (!getNodeExecutionCapability(node.type)) issues.push({ code: "UNKNOWN_NODE_TYPE", subjectId: node.id });
  }
  const edgeIds = new Set<string>();
  for (const edge of workflow.edges) {
    if (edgeIds.has(edge.id)) issues.push({ code: "DUPLICATE_EDGE_ID", subjectId: edge.id });
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) issues.push({ code: "EDGE_SOURCE_NOT_FOUND", subjectId: edge.id });
    if (!nodeIds.has(edge.target)) issues.push({ code: "EDGE_TARGET_NOT_FOUND", subjectId: edge.id });
  }
  return { valid: issues.length === 0, issues };
}

export type WorkflowPatchOperation =
  | { operation: "add-node"; node: WorkflowSnapshot["nodes"][number] }
  | { operation: "remove-node"; nodeId: string }
  | { operation: "add-edge"; edge: WorkflowSnapshot["edges"][number] }
  | { operation: "remove-edge"; edgeId: string };

export function proposeWorkflowPatch(input: { workflow: WorkflowSnapshot; operations: WorkflowPatchOperation[]; reason: string }) {
  const after: WorkflowSnapshot = {
    revisionId: input.workflow.revisionId,
    nodes: input.workflow.nodes.map((node) => ({ ...node })),
    edges: input.workflow.edges.map((edge) => ({ ...edge })),
  };
  for (const operation of input.operations) {
    if (operation.operation === "add-node") after.nodes.push({ ...operation.node });
    if (operation.operation === "remove-node") {
      after.nodes = after.nodes.filter((node) => node.id !== operation.nodeId);
      after.edges = after.edges.filter((edge) => edge.source !== operation.nodeId && edge.target !== operation.nodeId);
    }
    if (operation.operation === "add-edge") after.edges.push({ ...operation.edge });
    if (operation.operation === "remove-edge") after.edges = after.edges.filter((edge) => edge.id !== operation.edgeId);
  }
  return {
    baseRevisionId: input.workflow.revisionId,
    reason: input.reason,
    operations: input.operations,
    approvalRequired: true as const,
    appliesAutomatically: false as const,
    preview: { before: input.workflow, after, validation: validateWorkflowSnapshot(after) },
  };
}

function modelSupportsNode(source: AgentModelCatalogSource, node: NodeExecutionCapability) {
  const facts = new Set([source.capability, ...stringArray(source.capabilityTags)]);
  return node.modelCapabilityHints.some((hint) => facts.has(hint)
    || (source.capability === "chat" && ["text_chat", "image_understanding", "video_understanding"].includes(hint)));
}

function inferTendencies(source: AgentModelCatalogSource): AgentModelProjection["tendencies"] {
  const health = normalizeHealth(source.testState, source.providerHealthState);
  const latency = health.p95LatencyMs === null ? "unknown" : health.p95LatencyMs <= 1_000 ? "low" : health.p95LatencyMs <= 5_000 ? "medium" : "high";
  return { cost: "unknown", latency, quality: "unknown" };
}

function normalizeHealth(value: unknown, providerHealthState?: string) {
  const record = plainObject(value);
  const checks = Object.values(record).map(plainObject).filter((item) => typeof item.ok === "boolean");
  const successes = checks.filter((item) => item.ok === true).length;
  const derivedState = checks.length === 0
    ? providerHealthState || "unknown"
    : successes === checks.length ? "healthy" : successes > 0 ? "degraded" : "unavailable";
  const state = typeof record.state === "string" ? record.state : derivedState;
  const latency = Number(record.p95LatencyMs);
  const checkLatencies = checks.map((item) => Number(item.latencyMs)).filter((item) => Number.isFinite(item) && item >= 0);
  return { state, p95LatencyMs: Number.isFinite(latency) && latency >= 0 ? latency : checkLatencies.length > 0 ? Math.max(...checkLatencies) : null };
}

function lexicalScore(document: KnowledgeDocumentProjection, terms: string[]) {
  if (terms.length === 0) return 1;
  const haystack = `${document.documentKey} ${document.title} ${document.body}`.toLocaleLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(value: string) {
  return [...new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(Boolean))];
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function boundInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(Number.isFinite(value) ? value : minimum)));
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
