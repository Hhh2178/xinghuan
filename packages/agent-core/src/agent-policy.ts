import type { AgentRole } from "./llm-routing.js";

export interface AgentRoleTask {
  id: string;
  ownerId: string;
  role: AgentRole;
  scenario: string;
  inputSchema: string;
  outputSchema: string;
  toolAllowlist: string[];
  maxTokens: number;
  timeoutMs: number;
}

const PERMANENTLY_FORBIDDEN_TOOLS = new Set(["shell", "database.raw", "http.arbitrary", "secrets.read", "deploy", "admin.settings.write"]);

export function validateAgentRoleTask(task: AgentRoleTask): AgentRoleTask {
  if (!task.ownerId) throw new Error("AGENT_TASK_OWNER_REQUIRED");
  if (!task.inputSchema || !task.outputSchema) throw new Error("AGENT_TASK_SCHEMA_REQUIRED");
  if (task.maxTokens < 1 || task.maxTokens > 64_000) throw new Error("AGENT_TASK_TOKEN_BUDGET_INVALID");
  if (task.timeoutMs < 1_000 || task.timeoutMs > 300_000) throw new Error("AGENT_TASK_TIMEOUT_INVALID");
  const forbidden = task.toolAllowlist.find((tool) => PERMANENTLY_FORBIDDEN_TOOLS.has(tool));
  if (forbidden) throw new Error(`AGENT_TASK_TOOL_FORBIDDEN:${forbidden}`);
  return { ...task, toolAllowlist: [...new Set(task.toolAllowlist)] };
}

export function authorizeAgentToolCall(input: {
  task: AgentRoleTask;
  tool: string;
  ownerId: string;
  canvasRevisionMatches: boolean;
  budgetAvailable: boolean;
  approvalRequired: boolean;
  approvalGranted: boolean;
}) {
  validateAgentRoleTask(input.task);
  if (input.ownerId !== input.task.ownerId) throw new Error("AGENT_TOOL_OWNER_MISMATCH");
  if (!input.task.toolAllowlist.includes(input.tool)) throw new Error(`AGENT_TOOL_NOT_ALLOWED:${input.tool}`);
  if (!input.canvasRevisionMatches) throw new Error("AGENT_TOOL_REVISION_CONFLICT");
  if (!input.budgetAvailable) throw new Error("AGENT_TOOL_BUDGET_EXHAUSTED");
  if (input.approvalRequired && !input.approvalGranted) throw new Error("AGENT_TOOL_APPROVAL_REQUIRED");
  return { allowed: true as const, taskId: input.task.id, tool: input.tool };
}
