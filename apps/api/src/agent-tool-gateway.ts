import { authorizeAgentToolCall, type AgentRoleTask } from "@xinghuan/agent-core";

export interface AgentToolExecutionContext {
  ownerId: string;
  canvasRevisionMatches: boolean;
  budgetAvailable: boolean;
  approvalGranted: boolean;
  toolCallCount?: number;
  policy?: {
    maxCallsPerRun?: number;
    requireCanvasRevision?: boolean;
    requireBudget?: boolean;
  };
}

export interface AgentToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  approvalRequired: boolean;
  execute: (input: TInput, context: { ownerId: string; taskId: string }) => Promise<TOutput>;
}

export function createAgentToolGateway(deps: {
  tools: AgentToolDefinition[];
  recordAction: (input: {
    taskId: string;
    ownerId: string;
    tool: string;
    status: "running" | "succeeded" | "failed";
    result?: Record<string, unknown>;
    error?: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const tools = new Map(deps.tools.map((tool) => [tool.name, tool]));
  if (tools.size !== deps.tools.length) throw new Error("AGENT_TOOL_DUPLICATE_REGISTRATION");

  async function invoke(input: {
    task: AgentRoleTask;
    tool: string;
    payload: Record<string, unknown>;
    context: AgentToolExecutionContext;
  }) {
    const definition = tools.get(input.tool);
    if (!definition) throw new Error(`AGENT_TOOL_NOT_REGISTERED:${input.tool}`);
    const policy = input.context.policy || {};
    const callCount = Number(input.context.toolCallCount || 0);
    const maxCalls = Number(policy.maxCallsPerRun);
    if (Number.isFinite(maxCalls) && maxCalls >= 0 && callCount >= maxCalls) throw new Error("AGENT_TOOL_CALL_LIMIT_EXCEEDED");
    authorizeAgentToolCall({
      task: input.task,
      tool: input.tool,
      ownerId: input.context.ownerId,
      canvasRevisionMatches: policy.requireCanvasRevision === false || input.context.canvasRevisionMatches,
      budgetAvailable: policy.requireBudget === false || input.context.budgetAvailable,
      approvalRequired: definition.approvalRequired,
      approvalGranted: input.context.approvalGranted,
    });
    await deps.recordAction({ taskId: input.task.id, ownerId: input.task.ownerId, tool: input.tool, status: "running" });
    try {
      const result = await definition.execute(input.payload, { ownerId: input.task.ownerId, taskId: input.task.id });
      await deps.recordAction({
        taskId: input.task.id,
        ownerId: input.task.ownerId,
        tool: input.tool,
        status: "succeeded",
        result: summarizeResult(result),
      });
      return result;
    } catch (error) {
      await deps.recordAction({
        taskId: input.task.id,
        ownerId: input.task.ownerId,
        tool: input.tool,
        status: "failed",
        error: { message: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  return { invoke, registeredToolNames: () => [...tools.keys()].sort() };
}

function summarizeResult(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { type: "array", count: value.length };
  if (value && typeof value === "object") return { type: "object", keys: Object.keys(value).slice(0, 20) };
  return { type: typeof value };
}
