import { buildNodeCapabilityPromptContext, routeLlmCandidates, validateAgentRoleTask, type AgentRoleTask, type LlmRouteCandidate, type LlmRoutingDecision } from "@xinghuan/agent-core";

import type { AgentRunRecord } from "./agent-run-repository.js";
import type { PublishedLlmRoutePool } from "./llm-routing-repository.js";

export interface AgentModelInvocation {
  ownerId: string;
  providerId: string;
  modelRecordId: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  maxTokens: number;
  timeoutMs: number;
}

export interface AgentRoleRunResult {
  mode: "agent";
  agentRunId: string;
  content: string;
  entryId?: string;
  providerId?: string;
  modelRecordId?: string;
}

export function createAgentOrchestrator(deps: {
  agentRuns: {
    createRun(input: {
      ownerId: string; agentKey: string; role: AgentRoleTask["role"]; scenario: string; environment: "gray" | "production";
      idempotencyKey: string; canvasRunId?: string; parentAgentRunId?: string; inputSnapshot: Record<string, unknown>; budgetSnapshot: Record<string, unknown>;
    }): Promise<{ run: AgentRunRecord; created: boolean }>;
    transitionRun(input: { ownerId: string; runId: string; next: "running" | "succeeded" | "failed"; output?: Record<string, unknown>; error?: Record<string, unknown> }): Promise<AgentRunRecord>;
    appendAction(input: {
      ownerId: string; runId: string; actionType: string; toolName?: string; status: "running" | "succeeded" | "failed";
      inputSnapshot?: Record<string, unknown>; outputSnapshot?: Record<string, unknown>; error?: Record<string, unknown>;
    }): Promise<unknown>;
  };
  routing: {
    readPublishedPool(input: { role: AgentRoleTask["role"]; scenario: string; environment: "gray" | "production" }): Promise<PublishedLlmRoutePool | null>;
    recordDecision(input: { ownerId: string; agentRunId?: string; pool: PublishedLlmRoutePool; decisionKey: string; decision: LlmRoutingDecision }): Promise<string>;
    recordOutcome(input: { entryId: string; outcome: "success" | "technical_failure" | "rate_limited" | "quality_failure"; latencyMs: number; failureThreshold: number }): Promise<unknown>;
    claimHalfOpenProbe?(input: { entryId: string; leaseOwner: string; leaseMs: number }): Promise<boolean>;
    releaseHalfOpenProbe?(input: { entryId: string; leaseOwner: string }): Promise<void>;
  };
  invokeModel: (input: AgentModelInvocation) => Promise<{ content: string; usage?: Record<string, unknown> }>;
  now?: () => number;
}) {
  const now = deps.now || Date.now;

  async function runRole(input: {
    task: AgentRoleTask;
    agentKey: string;
    environment: "gray" | "production";
    idempotencyKey: string;
    canvasRunId?: string;
    parentAgentRunId?: string;
    messages: AgentModelInvocation["messages"];
    inputSnapshot: Record<string, unknown>;
    maximumEstimatedCost?: number;
  }): Promise<AgentRoleRunResult> {
    const task = validateAgentRoleTask(input.task);
    const created = await deps.agentRuns.createRun({
      ownerId: task.ownerId,
      agentKey: input.agentKey,
      role: task.role,
      scenario: task.scenario,
      environment: input.environment,
      idempotencyKey: input.idempotencyKey,
      canvasRunId: input.canvasRunId,
      parentAgentRunId: input.parentAgentRunId,
      inputSnapshot: input.inputSnapshot,
      budgetSnapshot: { maxTokens: task.maxTokens, timeoutMs: task.timeoutMs, maximumEstimatedCost: input.maximumEstimatedCost ?? null },
    });
    if (!created.created) return replayResult(created.run);
    const run = await deps.agentRuns.transitionRun({ ownerId: task.ownerId, runId: created.run.id, next: "running" });
    try {
      const pool = await deps.routing.readPublishedPool({ role: task.role, scenario: task.scenario, environment: input.environment });
      if (!pool) throw new Error(`LLM_ROUTE_POOL_NOT_PUBLISHED:${task.role}:${task.scenario}:${input.environment}`);
      const decision = routeLlmCandidates({
        role: task.role,
        scenario: task.scenario,
        requiredCapabilityTags: requiredTags(task.role),
        maximumEstimatedCost: input.maximumEstimatedCost,
        decisionKey: input.idempotencyKey,
        candidates: pool.candidates,
      });
      const failureThreshold = boundedInteger(pool.policy.failureThreshold, 1, 20, 3);
      let lastError: unknown;
      for (const [index, entryId] of decision.orderedEntryIds.entries()) {
        const candidate = pool.candidates.find((item) => item.entryId === entryId);
        if (!candidate) continue;
        const probeOwner = `${run.id}:route:${index}`;
        const holdsProbeLease = candidate.state === "half_open" && deps.routing.claimHalfOpenProbe
          ? await deps.routing.claimHalfOpenProbe({ entryId, leaseOwner: probeOwner, leaseMs: Math.max(60_000, task.timeoutMs + 30_000) })
          : candidate.state !== "half_open";
        if (!holdsProbeLease) continue;
        const attemptDecision = decisionForCandidate(decision, candidate);
        try {
          await deps.routing.recordDecision({
          ownerId: task.ownerId,
          agentRunId: run.id,
          pool,
          decisionKey: `${input.idempotencyKey}:route:${index}`,
          decision: attemptDecision,
        });
          await deps.agentRuns.appendAction({
          ownerId: task.ownerId,
          runId: run.id,
          actionType: "llm.invoke",
          toolName: "llm.invoke",
          status: "running",
          inputSnapshot: { entryId, providerId: candidate.providerId, modelRecordId: candidate.modelId, inputSchema: task.inputSchema, outputSchema: task.outputSchema },
        });
          const startedAt = now();
          try {
          const result = await deps.invokeModel({
            ownerId: task.ownerId,
            providerId: candidate.providerId,
            modelRecordId: candidate.modelId,
            messages: messagesWithNodeCapabilities(task.role, input.messages),
            maxTokens: task.maxTokens,
            timeoutMs: task.timeoutMs,
          });
          await deps.routing.recordOutcome({ entryId, outcome: "success", latencyMs: now() - startedAt, failureThreshold });
          await deps.agentRuns.appendAction({
            ownerId: task.ownerId,
            runId: run.id,
            actionType: "llm.result",
            toolName: "llm.invoke",
            status: "succeeded",
            outputSnapshot: { entryId, usage: safeUsageSnapshot(result.usage), contentLength: result.content.length },
          });
          const output = { content: result.content, entryId, providerId: candidate.providerId, modelRecordId: candidate.modelId };
          await deps.agentRuns.transitionRun({ ownerId: task.ownerId, runId: run.id, next: "succeeded", output });
          return { mode: "agent" as const, agentRunId: run.id, ...output };
          } catch (error) {
          lastError = error;
          const outcome = isRateLimitError(error) ? "rate_limited" : "technical_failure";
          await deps.routing.recordOutcome({ entryId, outcome, latencyMs: now() - startedAt, failureThreshold });
          await deps.agentRuns.appendAction({
            ownerId: task.ownerId,
            runId: run.id,
            actionType: "llm.error",
            toolName: "llm.invoke",
            status: "failed",
            error: { entryId, category: outcome, message: auditErrorMessage(error) },
          });
          }
        } finally {
          if (candidate.state === "half_open") {
            await deps.routing.releaseHalfOpenProbe?.({ entryId, leaseOwner: probeOwner }).catch(() => undefined);
          }
        }
      }
      throw new Error(lastError ? auditErrorMessage(lastError) : "LLM_ROUTE_EXHAUSTED");
    } catch (error) {
      await deps.agentRuns.transitionRun({ ownerId: task.ownerId, runId: run.id, next: "failed", error: { message: auditErrorMessage(error) } });
      throw error;
    }
  }

  return { runRole };
}

function messagesWithNodeCapabilities(role: AgentRoleTask["role"], messages: AgentModelInvocation["messages"]) {
  if (!new Set<AgentRoleTask["role"]>(["planner", "manager", "checker", "recovery"]).has(role)) return messages;
  return [
    {
      role: "system" as const,
      content: buildNodeCapabilityPromptContext({ includeLegacy: true, maximumEntries: 80 }),
    },
    ...messages,
  ];
}

function requiredTags(role: AgentRoleTask["role"]) {
  if (role === "image_understanding") return ["image_understanding"];
  if (role === "video_understanding") return ["video_understanding"];
  return ["text_chat"];
}

function decisionForCandidate(decision: LlmRoutingDecision, candidate: LlmRouteCandidate): LlmRoutingDecision {
  return { ...decision, selectedEntryId: candidate.entryId, reason: `${decision.reason}; invocation=${candidate.entryId}` };
}

function replayResult(run: AgentRunRecord) {
  if (run.status === "succeeded" && typeof run.outputSnapshot.content === "string") {
    return {
      mode: "agent" as const,
      agentRunId: run.id,
      content: run.outputSnapshot.content,
      entryId: typeof run.outputSnapshot.entryId === "string" ? run.outputSnapshot.entryId : undefined,
      providerId: typeof run.outputSnapshot.providerId === "string" ? run.outputSnapshot.providerId : undefined,
      modelRecordId: typeof run.outputSnapshot.modelRecordId === "string" ? run.outputSnapshot.modelRecordId : undefined,
    };
  }
  throw new Error(`AGENT_RUN_REPLAY_${run.status.toUpperCase()}`);
}

function isRateLimitError(error: unknown) {
  return /(?:\b429\b|rate.?limit|too many requests)/i.test(errorMessage(error));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function auditErrorMessage(error: unknown) {
  return errorMessage(error)
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|signature)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(api[_-]?key|token|secret)\b(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .slice(0, 2_000);
}

function safeUsageSnapshot(value: Record<string, unknown> | undefined) {
  return Object.fromEntries(Object.entries(value || {}).flatMap(([key, item]) => {
    const number = Number(item);
    return /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) && Number.isFinite(number) && number >= 0
      ? [[key, Math.floor(number)]]
      : [];
  }));
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}
