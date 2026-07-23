import { compileCanvasSnapshotRunPlan } from "@xinghuan/agent-core";
import {
  createWorkflowInputSnapshot,
  normalizeWorkflowDocuments,
  parseWorkflowTextTemplate,
  workflowTextTemplateBinding,
  type WorkflowDocument,
} from "@xinghuan/shared";

import type { CanvasRunCommand, CanvasRunEventRecord, CanvasRunRecord, CanvasSnapshotRecord } from "./canvas-run-repository.js";

export interface CanvasRunServiceRepository {
  readOwnedCanvasSnapshot(ownerId: string, canvasId: string): Promise<CanvasSnapshotRecord | null>;
  createCanvasRun(input: {
    ownerId: string;
    idempotencyKey: string;
    plan: ReturnType<typeof compileCanvasSnapshotRunPlan>;
    runScope?: CanvasRunRecord["runScope"];
    configurationSnapshot?: Record<string, unknown>;
    budgetSnapshot?: Record<string, unknown>;
    inputSnapshot?: Record<string, unknown>;
  }): Promise<{ run: CanvasRunRecord; created: boolean }>;
  readOwnedRun(ownerId: string, runId: string): Promise<CanvasRunRecord | null>;
  readOwnedRunEvents(ownerId: string, runId: string, afterSequence?: number, limit?: number): Promise<CanvasRunEventRecord[]>;
  applyCommand(input: {
    ownerId: string;
    runId: string;
    command: CanvasRunCommand;
    idempotencyKey: string;
    requestSnapshot?: Record<string, unknown>;
  }): Promise<CanvasRunRecord>;
}

export function createCanvasRunService(deps: {
  repository: CanvasRunServiceRepository;
  isEnabled: () => boolean;
  usePostgresRepository: () => boolean;
  assertStartablePlan?: (input: { ownerId: string; run: CanvasRunRecord }) => Promise<void>;
}) {
  function assertAvailable() {
    if (!deps.isEnabled()) throw new Error("CANVAS_RUN_DISABLED");
    if (!deps.usePostgresRepository()) throw new Error("CANVAS_RUN_POSTGRES_REQUIRED");
  }

  async function createRun(input: {
    ownerId: string;
    canvasId: string;
    idempotencyKey: string;
    runScope?: CanvasRunRecord["runScope"];
    workflowId?: string;
    workflowInputValues?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
    budget?: Record<string, unknown>;
  }) {
    assertAvailable();
    const canvas = await deps.repository.readOwnedCanvasSnapshot(input.ownerId, input.canvasId);
    if (!canvas) throw new Error("CANVAS_RUN_CANVAS_NOT_FOUND");
    const compiledPlan = compileCanvasSnapshotRunPlan({
      canvasId: canvas.id,
      ownerId: input.ownerId,
      revision: canvas.revision,
      data: canvas.data,
    });
    const configurationSnapshot = normalizeCanvasRunConfiguration(input.configuration);
    const plan = applyCanvasRunConfiguration(compiledPlan, configurationSnapshot);
    if (plan.steps.length === 0) throw new Error("CANVAS_RUN_PLAN_EMPTY");
    const inputSnapshot = compileWorkflowInputSnapshot({
      data: canvas.data,
      workflowId: input.workflowId,
      values: input.workflowInputValues,
    });
    return deps.repository.createCanvasRun({
      ownerId: input.ownerId,
      idempotencyKey: input.idempotencyKey,
      plan,
      runScope: input.runScope,
      configurationSnapshot,
      budgetSnapshot: normalizeCanvasRunBudget(input.budget),
      inputSnapshot,
    });
  }

  async function readRun(ownerId: string, runId: string) {
    assertAvailable();
    const run = await deps.repository.readOwnedRun(ownerId, runId);
    if (!run) throw new Error("CANVAS_RUN_NOT_FOUND");
    return run;
  }

  async function commandRun(input: {
    ownerId: string;
    runId: string;
    command: CanvasRunCommand;
    idempotencyKey: string;
    request?: Record<string, unknown>;
  }) {
    assertAvailable();
    if (input.command === "start") {
      const run = await readRun(input.ownerId, input.runId);
      const unsupported = run.planSnapshot.steps
        .filter((step) => step.skipped !== true && step.configuration?.serverRuntime !== "native_server")
        .map((step) => step.nodeType);
      if (unsupported.length > 0) throw new Error(`CANVAS_RUN_LEGACY_NODE_UNSUPPORTED:${[...new Set(unsupported)].join(",")}`);
      await deps.assertStartablePlan?.({ ownerId: input.ownerId, run });
    }
    return deps.repository.applyCommand({
      ownerId: input.ownerId,
      runId: input.runId,
      command: input.command,
      idempotencyKey: input.idempotencyKey,
      requestSnapshot: input.request,
    });
  }

  async function readEvents(ownerId: string, runId: string, afterSequence = 0, limit = 200) {
    assertAvailable();
    const run = await deps.repository.readOwnedRun(ownerId, runId);
    if (!run) throw new Error("CANVAS_RUN_NOT_FOUND");
    const events = await deps.repository.readOwnedRunEvents(ownerId, runId, afterSequence, limit);
    return { items: events, nextSequence: events.at(-1)?.sequence ?? afterSequence };
  }

  return { commandRun, createRun, readEvents, readRun };
}

export function compileWorkflowInputSnapshot(input: {
  data: unknown;
  workflowId?: string;
  values?: Record<string, unknown>;
}) {
  const workflowId = typeof input.workflowId === "string" ? input.workflowId.trim() : "";
  if (!workflowId) {
    if (input.values && Object.keys(input.values).length > 0) throw new Error("WORKFLOW_ID_REQUIRED");
    return Object.freeze({});
  }
  const data = record(input.data);
  const workflows = normalizeWorkflowDocuments(data.workflows);
  const workflow = workflows.find((item) => item.id === workflowId);
  if (!workflow) throw new Error(`WORKFLOW_NOT_FOUND:${workflowId}`);
  assertWorkflowBindingsCurrent(workflow, data.nodes);
  return createWorkflowInputSnapshot({
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    variables: workflow.variables,
    values: { ...workflow.inputValues, ...(input.values || {}) },
  });
}

function assertWorkflowBindingsCurrent(workflow: WorkflowDocument, rawNodes: unknown) {
  const nodes = Array.isArray(rawNodes) ? rawNodes.filter(isRecord) : [];
  const nodesById = new Map(nodes.map((node) => [String(node.id || ""), node]));
  for (const nodeId of workflow.memberNodeIds) {
    if (!nodesById.has(nodeId)) throw new Error(`WORKFLOW_MEMBER_NODE_MISSING:${nodeId}`);
  }
  const summaryCount = workflow.memberNodeIds.filter((nodeId) => nodesById.get(nodeId)?.type === "workflow-variables").length;
  if (summaryCount > 1) throw new Error(`WORKFLOW_VARIABLE_SUMMARY_CONFLICT:${workflow.id}`);
  for (const target of workflow.bindings) {
    const node = nodesById.get(target.nodeId);
    if (!node) throw new Error(`WORKFLOW_BINDING_NODE_MISSING:${target.nodeId}`);
    if (target.fieldType !== "text") continue;
    const source = readStringPath(record(node.data), target.fieldPath);
    const current = workflowTextTemplateBinding(parseWorkflowTextTemplate(source, workflow.variables));
    if (JSON.stringify(current) !== JSON.stringify(target.binding)) {
      throw new Error(`WORKFLOW_BINDING_STALE:${target.nodeId}:${target.fieldPath}`);
    }
  }
}

function readStringPath(source: Record<string, unknown>, path: string) {
  const normalizedPath = path.startsWith("data.") ? path.slice(5) : path;
  let value: unknown = source;
  for (const part of normalizedPath.split(".")) value = record(value)[part];
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCanvasRunConfiguration(value: Record<string, unknown> | undefined) {
  const input = value || {};
  const selectionPolicy = ["best", "top_k", "threshold", "diverse"].includes(String(input.selectionPolicy || ""))
    ? String(input.selectionPolicy)
    : "best";
  return {
    nodeCapabilityCatalog: "canvas-runtime-v1",
    qualityEvaluationEnabled: input.qualityEvaluationEnabled === true,
    qualityProfileKey: typeof input.qualityProfileKey === "string" ? input.qualityProfileKey.trim().slice(0, 120) : "",
    selectionPolicy,
    selectionMaximum: integer(input.selectionMaximum, 1, 16, 1),
    selectionMinimumScore: Math.max(0, Math.min(100, Number(decimal(input.selectionMinimumScore, "0")))),
  };
}

function applyCanvasRunConfiguration(
  plan: ReturnType<typeof compileCanvasSnapshotRunPlan>,
  configuration: ReturnType<typeof normalizeCanvasRunConfiguration>,
) {
  if (!configuration.qualityEvaluationEnabled) return plan;
  return {
    ...plan,
    steps: plan.steps.map((step) => step.nodeType === "image" || step.nodeType === "video" ? {
      ...step,
      configuration: {
        ...(step.configuration || {}),
        qualityEvaluationEnabled: true,
        qualityProfileKey: configuration.qualityProfileKey,
        selectionPolicy: configuration.selectionPolicy,
        selectionMaximum: configuration.selectionMaximum,
        selectionMinimumScore: configuration.selectionMinimumScore,
      },
    } : step),
  };
}

export function normalizeCanvasRunBudget(value: Record<string, unknown> | undefined) {
  const input = value || {};
  return {
    maxTaskCount: integer(input.maxTaskCount, 1, 1000, 100),
    maxAttemptsPerStep: integer(input.maxAttemptsPerStep, 0, 10, 3),
    maxDurationSeconds: integer(input.maxDurationSeconds, 60, 86_400, 3_600),
    maxCost: decimal(input.maxCost, "0"),
    currency: typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : "CNY",
  };
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function decimal(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return /^\d+(?:\.\d{1,6})?$/.test(text) ? text : fallback;
}
