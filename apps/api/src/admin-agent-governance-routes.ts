import type { IncomingMessage, ServerResponse } from "node:http";
import { ACTIVE_AGENT_TOOL_CATALOG, CANVAS_RUN_NODE_CAPABILITIES, RETIRED_AGENT_TOOL_CATALOG, type AgentRole } from "@xinghuan/agent-core";
import { readJsonBody } from "./http-session-utils.js";
import type { createAgentGovernanceRepository, GovernedVersionStatus, GovernanceEnvironment } from "./agent-governance-repository.js";

type GovernanceRepository = ReturnType<typeof createAgentGovernanceRepository>;
type CurrentUser = { id: string; email: string; name: string; role: "admin" | "member" };
type RequestContext = { requestId: string; method: string; path: string; ip: string; userAgent: string; startedAt: number };

export function createAdminAgentGovernanceRouteHandler(deps: {
  currentEnvironment: GovernanceEnvironment;
  repository: GovernanceRepository;
  sendT8: (response: ServerResponse, payload: unknown, statusCode?: number) => void;
  usePostgresRepository: () => boolean;
  appendAudit: (actor: CurrentUser, action: string, targetType: string, targetId: string, summary: string, context: RequestContext) => Promise<void>;
  invalidRequest: (message: string, payload?: Record<string, unknown>) => Error;
}) {
  return async function handleAdminAgentGovernanceRoutes(input: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
    currentUser: CurrentUser | null;
    requestContext: RequestContext;
  }) {
    const { request, response, url, currentUser, requestContext } = input;
    if (!url.pathname.startsWith("/api/admin/agent-runtime")) return false;
    try {
      const actor = requireAdmin(currentUser, deps.invalidRequest);
      if (!deps.usePostgresRepository()) throw deps.invalidRequest("AGENT_GOVERNANCE_POSTGRES_REQUIRED");
      const path = url.pathname;

    if (path === "/api/admin/agent-runtime/overview" && request.method === "GET") {
      deps.sendT8(response, {
        environment: deps.currentEnvironment,
        metrics: await deps.repository.readOverview(),
        controls: [await deps.repository.readRuntimeControl(deps.currentEnvironment)],
      });
      return true;
    }
    if (path === "/api/admin/agent-runtime/bootstrap" && request.method === "POST") {
      const value = await deps.repository.bootstrapDefaults(actor.id);
      await audit(deps, actor, requestContext, "agent.bootstrap", "agent-runtime", "defaults", "初始化内部 Agent 角色与公开知识集合草稿");
      deps.sendT8(response, value); return true;
    }
    if (path === "/api/admin/agent-runtime/roles" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listAgentDefinitions()); return true;
    }
    if (path === "/api/admin/agent-runtime/roles" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const role = agentRole(body.role);
      const created = await deps.repository.createAgentDefinition({ actorId: actor.id, agentKey: requiredText(body.agentKey, "AGENT_KEY_REQUIRED"), name: requiredText(body.name, "AGENT_NAME_REQUIRED"), role, description: text(body.description) });
      await audit(deps, actor, requestContext, "agent.definition.create", "agent-definition", created.id, `创建 Agent 角色 ${created.agentKey}`);
      deps.sendT8(response, created, 201); return true;
    }
    const roleVersionMatch = path.match(/^\/api\/admin\/agent-runtime\/roles\/([^/]+)\/versions$/);
    if (roleVersionMatch && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const created = await deps.repository.createAgentConfigurationVersion({ actorId: actor.id, agentDefinitionId: decodeURIComponent(roleVersionMatch[1]), configuration: object(body.configuration) });
      await audit(deps, actor, requestContext, "agent.configuration.create", "agent-configuration", String(created.id), "创建 Agent 配置草稿");
      deps.sendT8(response, created, 201); return true;
    }
    const agentVersionStatus = path.match(/^\/api\/admin\/agent-runtime\/agent-configurations\/([^/]+)\/status$/);
    if (agentVersionStatus && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const next = versionStatus(body.status);
      const value = await deps.repository.transitionAgentConfigurationVersion({ actorId: actor.id, versionId: decodeURIComponent(agentVersionStatus[1]), next });
      await audit(deps, actor, requestContext, "agent.configuration.status", "agent-configuration", String(value.id), `Agent 配置状态变更为 ${next}`);
      deps.sendT8(response, value); return true;
    }
    const agentVersionClone = path.match(/^\/api\/admin\/agent-runtime\/agent-configurations\/([^/]+)\/clone$/);
    if (agentVersionClone && request.method === "POST") {
      const sourceVersionId = decodeURIComponent(agentVersionClone[1]);
      const value = await deps.repository.cloneAgentConfigurationVersion({ actorId: actor.id, sourceVersionId });
      await audit(deps, actor, requestContext, "agent.configuration.clone", "agent-configuration", String(value.id), `从 ${sourceVersionId} 复制 Agent 配置草稿`);
      deps.sendT8(response, value, 201); return true;
    }
    const agentVersionPublish = path.match(/^\/api\/admin\/agent-runtime\/agent-configurations\/([^/]+)\/publish$/);
    if (agentVersionPublish && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const environment = scopedGovernanceEnvironment(body.environment, deps.currentEnvironment);
      const value = await deps.repository.publishAgentConfiguration({ actorId: actor.id, versionId: decodeURIComponent(agentVersionPublish[1]), environment });
      await audit(deps, actor, requestContext, "agent.configuration.publish", "agent-configuration", agentVersionPublish[1], `发布 Agent 配置到 ${environment}`);
      deps.sendT8(response, value); return true;
    }

    if (path === "/api/admin/agent-runtime/llm-pools" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listLlmPools()); return true;
    }
    if (path === "/api/admin/agent-runtime/llm-pools" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const created = await deps.repository.createLlmPool({ poolKey: requiredText(body.poolKey, "LLM_POOL_KEY_REQUIRED"), name: requiredText(body.name, "LLM_POOL_NAME_REQUIRED"), role: agentRole(body.role), scenario: requiredText(body.scenario, "LLM_POOL_SCENARIO_REQUIRED") });
      await audit(deps, actor, requestContext, "agent.llm_pool.create", "llm-route-pool", created.id, `创建 LLM 路由池 ${created.poolKey}`);
      deps.sendT8(response, created, 201); return true;
    }
    const poolVersions = path.match(/^\/api\/admin\/agent-runtime\/llm-pools\/([^/]+)\/versions$/);
    if (poolVersions && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const entries = array(body.entries).map((entry) => {
        const value = object(entry);
        return { modelId: requiredText(value.modelId, "LLM_ENTRY_MODEL_REQUIRED"), providerId: requiredText(value.providerId, "LLM_ENTRY_PROVIDER_REQUIRED"), capabilityTags: stringArray(value.capabilityTags), priority: number(value.priority, 0), weight: number(value.weight, 1), estimatedCost: number(value.estimatedCost, 0), enabled: value.enabled !== false };
      });
      const created = await deps.repository.createLlmPoolVersion({ actorId: actor.id, poolId: decodeURIComponent(poolVersions[1]), value: { policy: object(body.policy), entries } });
      await audit(deps, actor, requestContext, "agent.llm_pool.version.create", "llm-route-pool-version", created.id, `创建 LLM 路由版本 v${created.version}`);
      deps.sendT8(response, created, 201); return true;
    }
    const poolVersionStatus = path.match(/^\/api\/admin\/agent-runtime\/llm-pool-versions\/([^/]+)\/status$/);
    if (poolVersionStatus && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const next = versionStatus(body.status);
      const value = await deps.repository.transitionLlmPoolVersion({ actorId: actor.id, versionId: decodeURIComponent(poolVersionStatus[1]), next });
      await audit(deps, actor, requestContext, "agent.llm_pool.version.status", "llm-route-pool-version", String(value.id), `LLM 路由版本状态变更为 ${next}`);
      deps.sendT8(response, value); return true;
    }
    const poolVersionPublish = path.match(/^\/api\/admin\/agent-runtime\/llm-pool-versions\/([^/]+)\/publish$/);
    if (poolVersionPublish && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const environment = scopedGovernanceEnvironment(body.environment, deps.currentEnvironment);
      const value = await deps.repository.publishLlmPoolVersion({ actorId: actor.id, versionId: decodeURIComponent(poolVersionPublish[1]), environment });
      await audit(deps, actor, requestContext, "agent.llm_pool.version.publish", "llm-route-pool-version", poolVersionPublish[1], `发布或回滚 LLM 路由到 ${environment}`);
      deps.sendT8(response, value); return true;
    }
    if (path === "/api/admin/agent-runtime/llm-pools/simulate" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      deps.sendT8(response, await deps.repository.simulateLlmRoute({ versionId: requiredText(body.versionId, "LLM_POOL_VERSION_REQUIRED"), role: agentRole(body.role), scenario: requiredText(body.scenario, "LLM_POOL_SCENARIO_REQUIRED"), requiredCapabilityTags: stringArray(body.requiredCapabilityTags), requiredInputCapabilities: stringArray(body.requiredInputCapabilities), maximumEstimatedCost: optionalNumber(body.maximumEstimatedCost), decisionKey: requiredText(body.decisionKey, "LLM_ROUTE_DECISION_KEY_REQUIRED") }));
      return true;
    }

    if (path === "/api/admin/agent-runtime/tools" && request.method === "GET") {
      deps.sendT8(response, { catalog: ACTIVE_AGENT_TOOL_CATALOG, retiredCatalog: RETIRED_AGENT_TOOL_CATALOG, policies: await deps.repository.listToolPolicies() }); return true;
    }
    if (path === "/api/admin/agent-runtime/tool-policies" && request.method === "PUT") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const toolName = requiredText(body.toolName, "AGENT_TOOL_NAME_REQUIRED");
      if (!ACTIVE_AGENT_TOOL_CATALOG.some((tool) => tool.name === toolName)) throw deps.invalidRequest("AGENT_TOOL_RETIRED_OR_UNKNOWN");
      const value = await deps.repository.upsertToolPolicy({ actorId: actor.id, subjectType: enumValue(body.subjectType, ["platform", "user_group", "user"], "AGENT_TOOL_SUBJECT_INVALID"), subjectId: text(body.subjectId) || undefined, toolName, effect: enumValue(body.effect, ["allow", "deny", "require_approval"], "AGENT_TOOL_EFFECT_INVALID"), constraints: object(body.constraints), revision: optionalNumber(body.revision) });
      await audit(deps, actor, requestContext, "agent.tool_policy.update", "agent-tool-policy", String(value.id), `更新工具策略 ${toolName}`);
      deps.sendT8(response, value); return true;
    }
    if (path === "/api/admin/agent-runtime/node-capabilities" && request.method === "GET") {
      deps.sendT8(response, CANVAS_RUN_NODE_CAPABILITIES); return true;
    }

    if (path === "/api/admin/agent-runtime/quality-profiles" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listQualityProfiles()); return true;
    }
    if (path === "/api/admin/agent-runtime/quality-profiles" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const created = await deps.repository.createQualityProfile({ actorId: actor.id, profileKey: requiredText(body.profileKey, "QUALITY_PROFILE_KEY_REQUIRED"), mediaKind: enumValue(body.mediaKind, ["image", "video"], "QUALITY_MEDIA_KIND_INVALID"), minimumOverallScore: number(body.minimumOverallScore, 0), minimumConfidence: number(body.minimumConfidence, 0), weights: numericRecord(body.weights), instructions: text(body.instructions) });
      await audit(deps, actor, requestContext, "agent.quality_profile.create", "artifact-quality-profile", String(created.id), "创建质量配置草稿");
      deps.sendT8(response, created, 201); return true;
    }
    const qualityStatus = path.match(/^\/api\/admin\/agent-runtime\/quality-profiles\/([^/]+)\/status$/);
    if (qualityStatus && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const next = versionStatus(body.status);
      const value = await deps.repository.transitionQualityProfile({ actorId: actor.id, profileId: decodeURIComponent(qualityStatus[1]), next });
      await audit(deps, actor, requestContext, "agent.quality_profile.status", "artifact-quality-profile", String(value.id), `质量配置状态变更为 ${next}`);
      deps.sendT8(response, value); return true;
    }
    const qualityPublish = path.match(/^\/api\/admin\/agent-runtime\/quality-profiles\/([^/]+)\/publish$/);
    if (qualityPublish && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const environment = scopedGovernanceEnvironment(body.environment, deps.currentEnvironment);
      const value = await deps.repository.publishQualityProfile({ actorId: actor.id, profileId: decodeURIComponent(qualityPublish[1]), environment });
      await audit(deps, actor, requestContext, "agent.quality_profile.publish", "artifact-quality-profile", qualityPublish[1], `发布或回滚质量配置到 ${environment}`);
      deps.sendT8(response, value); return true;
    }

    if (path === "/api/admin/agent-runtime/knowledge" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listKnowledge()); return true;
    }
    if (isRetiredKnowledgeWrite(path, request.method)) {
      deps.sendT8(response, {
        code: "AGENT_KNOWLEDGE_WRITES_RETIRED",
        deprecated: true,
        message: "自由知识文档已退出新 Agent Run；历史集合与文档仍可只读查询。",
      }, 410);
      return true;
    }
    if (path === "/api/admin/agent-runtime/knowledge/collections" && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const value = await deps.repository.createKnowledgeCollection({ actorId: actor.id, collectionKey: requiredText(body.collectionKey, "KNOWLEDGE_COLLECTION_KEY_REQUIRED"), name: requiredText(body.name, "KNOWLEDGE_COLLECTION_NAME_REQUIRED"), description: text(body.description), audience: enumValue(body.audience, ["public", "internal"], "KNOWLEDGE_AUDIENCE_INVALID") });
      await audit(deps, actor, requestContext, "agent.knowledge.collection.create", "agent-knowledge-collection", String(value.id), "创建 Agent 知识集合");
      deps.sendT8(response, value, 201); return true;
    }
    const knowledgeDocuments = path.match(/^\/api\/admin\/agent-runtime\/knowledge\/collections\/([^/]+)\/documents$/);
    if (knowledgeDocuments && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const value = await deps.repository.createKnowledgeDocument({ actorId: actor.id, collectionId: decodeURIComponent(knowledgeDocuments[1]), documentKey: requiredText(body.documentKey, "KNOWLEDGE_DOCUMENT_KEY_REQUIRED"), title: requiredText(body.title, "KNOWLEDGE_DOCUMENT_TITLE_REQUIRED"), body: requiredText(body.body, "KNOWLEDGE_DOCUMENT_BODY_REQUIRED"), source: object(body.source) });
      await audit(deps, actor, requestContext, "agent.knowledge.document.create", "agent-knowledge-document", String(value.id), "创建 Agent 知识文档草稿");
      deps.sendT8(response, value, 201); return true;
    }
    const knowledgeStatus = path.match(/^\/api\/admin\/agent-runtime\/knowledge\/documents\/([^/]+)\/status$/);
    if (knowledgeStatus && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const next = versionStatus(body.status);
      const value = await deps.repository.transitionKnowledgeDocument({ actorId: actor.id, documentId: decodeURIComponent(knowledgeStatus[1]), next });
      await audit(deps, actor, requestContext, "agent.knowledge.document.status", "agent-knowledge-document", String(value.id), `知识文档状态变更为 ${next}`);
      deps.sendT8(response, value); return true;
    }
    const knowledgePublish = path.match(/^\/api\/admin\/agent-runtime\/knowledge\/documents\/([^/]+)\/publish$/);
    if (knowledgePublish && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const environment = scopedGovernanceEnvironment(body.environment, deps.currentEnvironment);
      const value = await deps.repository.publishKnowledgeDocument({ actorId: actor.id, documentId: decodeURIComponent(knowledgePublish[1]), environment });
      await audit(deps, actor, requestContext, "agent.knowledge.document.publish", "agent-knowledge-document", knowledgePublish[1], `发布或回滚知识文档到 ${environment}`);
      deps.sendT8(response, value); return true;
    }

    if (path === "/api/admin/agent-runtime/controls" && request.method === "GET") {
      deps.sendT8(response, [await deps.repository.readRuntimeControl(deps.currentEnvironment)]); return true;
    }
    const controls = path.match(/^\/api\/admin\/agent-runtime\/controls\/(gray|production)$/);
    if (controls && request.method === "PATCH") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const environment = scopedGovernanceEnvironment(controls[1], deps.currentEnvironment);
      const value = await deps.repository.updateRuntimeControls({ actorId: actor.id, environment, revision: number(body.revision, 0), values: object(body.values) as Record<string, boolean> });
      await audit(deps, actor, requestContext, "agent.runtime_controls.update", "agent-runtime-controls", controls[1], `更新 ${controls[1]} Agent 全局开关`);
      deps.sendT8(response, value); return true;
    }
    if (path === "/api/admin/agent-runtime/runs" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listRuns(limit(url))); return true;
    }
    if (path === "/api/admin/agent-runtime/approvals" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listApprovals(limit(url))); return true;
    }
    if (path === "/api/admin/agent-runtime/recovery" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listRecoveryDecisions(limit(url))); return true;
    }
    const approvalDecision = path.match(/^\/api\/admin\/agent-runtime\/approvals\/([^/]+)\/decision$/);
    if (approvalDecision && request.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const next = enumValue(body.status, ["approved", "rejected", "cancelled"], "AGENT_APPROVAL_STATUS_INVALID");
      const value = await deps.repository.decideApproval({ approvalId: decodeURIComponent(approvalDecision[1]), actorId: actor.id, next, reason: text(body.reason) });
      await audit(deps, actor, requestContext, "agent.approval.decide", "agent-approval", approvalDecision[1], `Agent 审批决定为 ${next}`);
      deps.sendT8(response, value); return true;
    }
    if (path === "/api/admin/agent-runtime/audit" && request.method === "GET") {
      deps.sendT8(response, await deps.repository.listAgentAudit(limit(url, 200))); return true;
    }
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const revision = Number((error as { currentRevision?: unknown })?.currentRevision);
      if (/(?:_REQUIRED|_INVALID|_UNKNOWN|_CONFLICT|_NOT_PENDING|_NOT_APPROVED|_ACTIVE_PUBLICATION|_TRANSITION_INVALID)$/.test(message)) {
        throw deps.invalidRequest(message, Number.isFinite(revision) ? { currentRevision: revision } : undefined);
      }
      throw error;
    }
  };
}

function requireAdmin(user: CurrentUser | null, invalidRequest: (message: string) => Error) {
  if (!user || user.role !== "admin") throw invalidRequest("ADMIN_REQUIRED");
  return user;
}
function governanceEnvironment(value: unknown): GovernanceEnvironment { return enumValue(value, ["gray", "production"], "AGENT_ENVIRONMENT_INVALID"); }
function scopedGovernanceEnvironment(value: unknown, currentEnvironment: GovernanceEnvironment): GovernanceEnvironment {
  const requested = governanceEnvironment(value);
  if (requested !== currentEnvironment) throw new Error("AGENT_RUNTIME_ENVIRONMENT_SCOPE_FORBIDDEN");
  return currentEnvironment;
}
function versionStatus(value: unknown): GovernedVersionStatus { return enumValue(value, ["draft", "review", "approved", "retired"], "GOVERNED_VERSION_STATUS_INVALID"); }
function agentRole(value: unknown): AgentRole { return enumValue(value, ["planner", "image_understanding", "video_understanding", "checker", "recovery", "manager"], "AGENT_ROLE_INVALID"); }
function enumValue<const T extends string>(value: unknown, allowed: readonly T[], error: string): T { const normalized = text(value) as T; if (!allowed.includes(normalized)) throw new Error(error); return normalized; }
function requiredText(value: unknown, error: string) { const normalized = text(value); if (!normalized) throw new Error(error); return normalized; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown) { return array(value).map(String).map((item) => item.trim()).filter(Boolean); }
function number(value: unknown, fallback: number) { const normalized = Number(value); return Number.isFinite(normalized) ? normalized : fallback; }
function optionalNumber(value: unknown) { const normalized = Number(value); return value !== undefined && value !== null && value !== "" && Number.isFinite(normalized) ? normalized : undefined; }
function numericRecord(value: unknown) { return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, number(item, 0)])); }
function limit(url: URL, fallback = 100) { return Math.min(500, Math.max(1, Math.floor(number(url.searchParams.get("limit"), fallback)))); }
async function audit(deps: Parameters<typeof createAdminAgentGovernanceRouteHandler>[0], actor: CurrentUser, context: RequestContext, action: string, targetType: string, targetId: string, summary: string) { await deps.appendAudit(actor, action, targetType, targetId, summary, context); }
function isRetiredKnowledgeWrite(path: string, method: string | undefined) {
  return method !== "GET" && (
    path === "/api/admin/agent-runtime/knowledge/collections"
    || /^\/api\/admin\/agent-runtime\/knowledge\/collections\/[^/]+\/documents$/.test(path)
    || /^\/api\/admin\/agent-runtime\/knowledge\/documents\/[^/]+\/(?:status|publish)$/.test(path)
  );
}
