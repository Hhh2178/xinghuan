import { api } from "./admin-api-client";
import type { AgentRuntimeConfiguration } from "@xinghuan/agent-core";

export type AgentEnvironment = "gray" | "production";
export type AgentVersionStatus = "draft" | "review" | "approved" | "retired";

export interface AgentRuntimeControl {
  environment: AgentEnvironment;
  agentEnabled: boolean;
  canvasRunsEnabled: boolean;
  automaticRecoveryEnabled: boolean;
  qualityEvaluationEnabled: boolean;
  revision: number;
  updatedAt: number;
}
export interface AgentOverview {
  environment: AgentEnvironment;
  metrics: Record<string, number>;
  controls: AgentRuntimeControl[];
}
export interface AgentPublication { id: string; environment: AgentEnvironment; publishedAt: number }
export interface AgentDefinition {
  id: string; agentKey: string; name: string; role: string; description: string; enabled: boolean;
  versions: Array<{ id: string; version: number; status: AgentVersionStatus; configuration: AgentRuntimeConfiguration; createdAt: number }>;
  publications: Array<AgentPublication & { configurationVersionId: string }>;
}
export interface LlmRouteEntry {
  id: string; modelId: string; providerId: string; capabilityTags: string[]; priority: number; weight: number;
  inputCapabilities: Record<string, unknown>; mediaInputTransports: string[];
  estimatedCost: number; enabled: boolean; health: { state: string; successCount: number; technicalFailureCount: number; qualityFailureCount: number; p95LatencyMs: number };
}
export interface LlmRoutePool {
  id: string; poolKey: string; name: string; role: string; scenario: string; enabled: boolean;
  versions: Array<{ id: string; version: number; status: AgentVersionStatus; policy: Record<string, unknown>; entries: LlmRouteEntry[]; publications: AgentPublication[] }>;
}
export interface AgentToolData {
  catalog: Array<{ name: string; label: string; risk: string; approvalRequired: boolean; roles: string[]; description: string }>;
  retiredCatalog: Array<{ name: string; label: string; risk: string; approvalRequired: boolean; roles: string[]; description: string }>;
  policies: Array<{ id: string; subjectType: string; subjectId?: string; toolName: string; effect: string; constraints: Record<string, unknown>; revision: number }>;
}
export interface AgentRoleWorkspaceData {
  definitions: AgentDefinition[];
  pools: LlmRoutePool[];
  knowledge: KnowledgeCollection[];
  tools: AgentToolData;
  qualityProfiles: QualityProfile[];
}
export interface AgentRecoveryWorkspaceData {
  decisions: RecoveryDecision[];
  roles: AgentRoleWorkspaceData;
}
export interface NodeCapabilityPort { key: string; valueTypes: string[]; cardinality: string; required: boolean; description: string }
export interface NodeCapability {
  nodeType: string; label: string; description: string; executionKind: string; serverRuntime: string; planEligible: boolean;
  inputs: NodeCapabilityPort[]; outputs: NodeCapabilityPort[]; recommendedUpstream: string[]; recommendedDownstream: string[];
  modelCapabilityHints: string[]; commonFailureCodes: string[]; agentAllowedActions: string[];
  connectionRules: string[]; usageExamples: string[]; alternativeNodeTypes: string[];
}
export interface QualityProfile {
  id: string; profileKey: string; version: number; mediaKind: "image" | "video"; status: AgentVersionStatus;
  minimumOverallScore: number; minimumConfidence: number; weights: Record<string, number>; instructions: string; publications: AgentPublication[];
}
export interface KnowledgeCollection {
  id: string; collectionKey: string; name: string; description: string; audience: "public" | "internal"; enabled: boolean; revision: number;
  documents: Array<{ id: string; documentKey: string; version: number; title: string; body: string; source: Record<string, unknown>; status: AgentVersionStatus; publications: AgentPublication[] }>;
}
export interface AgentRunsData { agentRuns: AgentRunSummary[]; canvasRuns: AgentRunSummary[] }
export interface AgentRunSummary { id: string; ownerId: string; ownerEmail: string; canvasRunId?: string; canvasId?: string; role?: string; scenario?: string; status: string; createdAt: number; updatedAt: number; error?: Record<string, unknown> }
export interface AgentApproval { id: string; ownerEmail: string; canvasRunId: string; runStepId?: string; actionType: string; action: Record<string, unknown>; status: string; requestedBy: string; decisionReason?: string; createdAt: number }
export interface RecoveryDecision { id: string; ownerEmail: string; canvasRunId: string; runStepId: string; failureClass: string; decision: string; currentProviderId?: string; currentModelId?: string; targetProviderId?: string; targetModelId?: string; reason: string; status: string; approvalId?: string; createdAt: number }
export interface AgentAuditRecord { id: string; ownerId: string; agentRunId: string; sequence: number; actionType: string; toolName?: string; status: string; error: Record<string, unknown>; createdAt: number }

const base = "/api/admin/agent-runtime";
const json = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const adminAgentGovernanceApi = {
  overview: () => api<AgentOverview>(`${base}/overview`),
  bootstrap: () => api<{ definitionsCreated: number; configurationsCreated: number; knowledgeCollectionsCreated: number }>(`${base}/bootstrap`, { method: "POST" }),
  roles: () => api<AgentDefinition[]>(`${base}/roles`),
  roleWorkspace: async (): Promise<AgentRoleWorkspaceData> => {
    const [definitions, pools, qualityProfiles] = await Promise.all([
      api<AgentDefinition[]>(`${base}/roles`),
      api<LlmRoutePool[]>(`${base}/llm-pools`),
      api<QualityProfile[]>(`${base}/quality-profiles`),
    ]);
    return { definitions, pools, knowledge: [], tools: { catalog: [], retiredCatalog: [], policies: [] }, qualityProfiles };
  },
  createRole: (value: { agentKey: string; name: string; role: string; description: string }) => api<AgentDefinition>(`${base}/roles`, json(value)),
  createRoleVersion: (roleId: string, configuration: AgentRuntimeConfiguration) => api(`${base}/roles/${encodeURIComponent(roleId)}/versions`, json({ configuration })),
  cloneRoleVersion: (id: string) => api(`${base}/agent-configurations/${encodeURIComponent(id)}/clone`, { method: "POST" }),
  transitionRoleVersion: (id: string, status: AgentVersionStatus) => api(`${base}/agent-configurations/${encodeURIComponent(id)}/status`, json({ status })),
  publishRoleVersion: (id: string, environment: AgentEnvironment) => api(`${base}/agent-configurations/${encodeURIComponent(id)}/publish`, json({ environment })),
  pools: () => api<LlmRoutePool[]>(`${base}/llm-pools`),
  createPool: (value: { poolKey: string; name: string; role: string; scenario: string }) => api<LlmRoutePool>(`${base}/llm-pools`, json(value)),
  createPoolVersion: (poolId: string, value: { policy: Record<string, unknown>; entries: Array<{ modelId: string; providerId: string; capabilityTags: string[]; priority: number; weight: number; estimatedCost: number; enabled: boolean }> }) => api(`${base}/llm-pools/${encodeURIComponent(poolId)}/versions`, json(value)),
  transitionPoolVersion: (id: string, status: AgentVersionStatus) => api(`${base}/llm-pool-versions/${encodeURIComponent(id)}/status`, json({ status })),
  publishPoolVersion: (id: string, environment: AgentEnvironment) => api(`${base}/llm-pool-versions/${encodeURIComponent(id)}/publish`, json({ environment })),
  simulatePool: (value: { versionId: string; role: string; scenario: string; requiredCapabilityTags: string[]; requiredInputCapabilities?: string[]; maximumEstimatedCost?: number; decisionKey: string }) => api<{ candidates: LlmRouteEntry[]; decision: { selectedEntryId: string; orderedEntryIds: string[]; rejected: Array<{ entryId: string; reason: string }>; reason: string } }>(`${base}/llm-pools/simulate`, json({
    ...value,
    requiredInputCapabilities: value.requiredInputCapabilities
      ?? (value.role === "video_understanding" ? ["videoReference"] : value.role === "image_understanding" ? ["imageReference"] : []),
  })),
  tools: () => api<AgentToolData>(`${base}/tools`),
  updateToolPolicy: (value: Record<string, unknown>) => api(`${base}/tool-policies`, json(value, "PUT")),
  nodes: () => api<NodeCapability[]>(`${base}/node-capabilities`),
  qualityProfiles: () => api<QualityProfile[]>(`${base}/quality-profiles`),
  createQualityProfile: (value: { profileKey: string; mediaKind: "image" | "video"; minimumOverallScore: number; minimumConfidence: number; weights: Record<string, number>; instructions: string }) => api(`${base}/quality-profiles`, json(value)),
  transitionQualityProfile: (id: string, status: AgentVersionStatus) => api(`${base}/quality-profiles/${encodeURIComponent(id)}/status`, json({ status })),
  publishQualityProfile: (id: string, environment: AgentEnvironment) => api(`${base}/quality-profiles/${encodeURIComponent(id)}/publish`, json({ environment })),
  knowledge: () => api<KnowledgeCollection[]>(`${base}/knowledge`),
  createKnowledgeCollection: (value: Record<string, unknown>) => api(`${base}/knowledge/collections`, json(value)),
  createKnowledgeDocument: (collectionId: string, value: Record<string, unknown>) => api(`${base}/knowledge/collections/${encodeURIComponent(collectionId)}/documents`, json(value)),
  transitionKnowledgeDocument: (id: string, status: AgentVersionStatus) => api(`${base}/knowledge/documents/${encodeURIComponent(id)}/status`, json({ status })),
  publishKnowledgeDocument: (id: string, environment: AgentEnvironment) => api(`${base}/knowledge/documents/${encodeURIComponent(id)}/publish`, json({ environment })),
  controls: () => api<AgentRuntimeControl[]>(`${base}/controls`),
  updateControls: (value: AgentRuntimeControl) => api<AgentRuntimeControl>(`${base}/controls/${value.environment}`, json({ revision: value.revision, values: value }, "PATCH")),
  runs: () => api<AgentRunsData>(`${base}/runs`),
  approvals: () => api<AgentApproval[]>(`${base}/approvals`),
  recovery: () => api<RecoveryDecision[]>(`${base}/recovery`),
  recoveryWorkspace: async (): Promise<AgentRecoveryWorkspaceData> => {
    const [decisions, roles] = await Promise.all([
      api<RecoveryDecision[]>(`${base}/recovery`),
      adminAgentGovernanceApi.roleWorkspace(),
    ]);
    return { decisions, roles };
  },
  decideApproval: (id: string, status: "approved" | "rejected" | "cancelled", reason: string) => api(`${base}/approvals/${encodeURIComponent(id)}/decision`, json({ status, reason })),
  audit: () => api<AgentAuditRecord[]>(`${base}/audit`),
};
