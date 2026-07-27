import type { AgentEnvironment, AgentVersionStatus } from "./admin-agent-governance-api";

export type AssistantLifecycleStepId = "capability" | "routing" | "publication" | "verification";
export type AssistantReadinessIssueCode =
  | "surface_disabled"
  | "definition_missing"
  | "agent_not_approved"
  | "route_missing"
  | "route_has_no_candidate"
  | "agent_not_published"
  | "route_not_published"
  | "verification_required";

export interface AssistantReadinessIssue {
  code: AssistantReadinessIssueCode;
  step: AssistantLifecycleStepId;
  message: string;
}

export interface AssistantLifecycle {
  currentStep: AssistantLifecycleStepId;
  complete: boolean;
  conclusion: string;
  issues: AssistantReadinessIssue[];
  agentVersionLabel: string;
  routeVersionLabel: string;
}

interface DefinitionInput {
  enabled: boolean;
  versions: Array<{ id: string; version: number; status: AgentVersionStatus }>;
  publications: Array<{ environment: AgentEnvironment; configurationVersionId: string }>;
}

interface PoolInput {
  enabled: boolean;
  versions: Array<{
    id: string;
    version: number;
    status: AgentVersionStatus;
    entries: Array<{ enabled: boolean }>;
    publications: Array<{ environment: AgentEnvironment }>;
  }>;
}

interface VerificationInput {
  status: "succeeded" | "failed";
  verifiedAt: number;
}

export interface DeriveAssistantLifecycleInput {
  enabled: boolean;
  environment: AgentEnvironment;
  definition?: DefinitionInput;
  pools: PoolInput[];
  lastVerification: VerificationInput | null;
}

export function formatAssistantVerificationDetail(input: {
  environment: AgentEnvironment;
  agentVersionLabel: string;
  routeVersionLabel: string;
}): string {
  return `Agent 模式 · ${environmentLabel(input.environment)} · ${input.agentVersionLabel} · ${input.routeVersionLabel} · 真实请求已完成`;
}

export function deriveAssistantLifecycle(input: DeriveAssistantLifecycleInput): AssistantLifecycle {
  const issues: AssistantReadinessIssue[] = [];
  const definition = input.definition;
  const approvedAgent = latestApproved(definition?.versions || []);
  const activePool = input.pools.find((pool) => pool.enabled) || input.pools[0];
  const approvedRoute = latestApproved(activePool?.versions || []);
  const routeHasCandidate = Boolean(approvedRoute?.entries.some((entry) => entry.enabled));
  const publishedAgentId = definition?.publications.find((item) => item.environment === input.environment)?.configurationVersionId;
  const publishedRoute = activePool?.versions.find((version) =>
    version.publications.some((publication) => publication.environment === input.environment),
  );

  if (!input.enabled) issues.push(issue("surface_disabled", "capability", "启用当前助手"));
  if (!definition) issues.push(issue("definition_missing", "capability", "初始化固定助手 Agent 定义"));
  if (definition && !approvedAgent) issues.push(issue("agent_not_approved", "publication", "批准助手 Agent 配置"));
  if (!activePool) issues.push(issue("route_missing", "routing", "创建当前助手的模型路由"));
  else if (!routeHasCandidate) issues.push(issue("route_has_no_candidate", "routing", "至少启用一个聊天模型候选"));
  if (approvedAgent && publishedAgentId !== approvedAgent.id) {
    issues.push(issue("agent_not_published", "publication", `发布 ${environmentLabel(input.environment)} Agent 配置`));
  }
  if (approvedRoute && routeHasCandidate && publishedRoute?.id !== approvedRoute.id) {
    issues.push(issue("route_not_published", "publication", `发布 ${environmentLabel(input.environment)} 模型路由`));
  }

  const blockingIssues = issues.filter((item) => item.code !== "verification_required");
  if (!blockingIssues.length && input.lastVerification?.status !== "succeeded") {
    issues.push(issue("verification_required", "verification", "发送一条真实请求验证生效"));
  }

  const currentStep = nextStep(issues);
  const complete = issues.length === 0;

  return {
    currentStep,
    complete,
    conclusion: conclusion(input, issues),
    issues,
    agentVersionLabel: publishedAgentId
      ? `Agent v${definition?.versions.find((version) => version.id === publishedAgentId)?.version || "?"}`
      : "Agent 未发布",
    routeVersionLabel: publishedRoute ? `路由 v${publishedRoute.version}` : "路由未发布",
  };
}

function latestApproved<T extends { version: number; status: AgentVersionStatus }>(versions: T[]): T | undefined {
  return versions
    .filter((version) => version.status === "approved")
    .sort((left, right) => right.version - left.version)[0];
}

function issue(code: AssistantReadinessIssueCode, step: AssistantLifecycleStepId, message: string): AssistantReadinessIssue {
  return { code, step, message };
}

function nextStep(issues: AssistantReadinessIssue[]): AssistantLifecycleStepId {
  if (issues.some((item) => item.step === "capability")) return "capability";
  if (issues.some((item) => item.step === "routing")) return "routing";
  if (issues.some((item) => item.step === "publication")) return "publication";
  return "verification";
}

function conclusion(input: DeriveAssistantLifecycleInput, issues: AssistantReadinessIssue[]) {
  if (issues.some((item) => item.code === "surface_disabled")) return "助手尚未启用";
  if (issues.some((item) => item.code === "definition_missing")) return "缺少助手 Agent 定义";
  if (issues.some((item) => item.code === "route_not_published")) return `${environmentLabel(input.environment)} 路由未发布`;
  if (issues.some((item) => item.code === "agent_not_published")) return `${environmentLabel(input.environment)} Agent 未发布`;
  if (issues.some((item) => item.code === "route_has_no_candidate")) return "尚未选择可用聊天模型";
  if (issues.some((item) => item.code === "route_missing")) return "缺少助手模型路由";
  if (issues.some((item) => item.code === "agent_not_approved")) return "助手配置尚未批准";
  if (issues.some((item) => item.code === "verification_required")) return "已发布，等待真实验证";
  return `${environmentLabel(input.environment)} 已生效`;
}

function environmentLabel(environment: AgentEnvironment) {
  return environment === "gray" ? "Gray" : "Production";
}
