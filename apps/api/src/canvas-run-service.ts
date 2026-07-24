import { compileCanvasSnapshotRunPlan, compileWorkflowSnapshotRunPlan } from "@xinghuan/agent-core";
import {
  createWorkflowInputSnapshot,
  DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
  normalizeWorkflowDocuments,
  normalizeWorkflowSupervisionLimits,
  normalizeWorkflowSupervisionOverrides,
  parseWorkflowTextTemplate,
  resolveWorkflowSupervisionSettings,
  workflowTextTemplateBinding,
  type WorkflowDocument,
  type WorkflowSupervisionLimits,
  type WorkflowSupervisionSettingsInput,
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
  readOwnedWorkflowInputAssets?(ownerId: string, assetIds: string[]): Promise<Array<{ id: string; kind: string; url: string }>>;
  readOwnedWorkflowSupervisionSettings?(ownerId: string, canvasId: string, workflowId: string): Promise<{
    settings: WorkflowSupervisionSettingsInput;
    revision: number;
    updatedAt: number;
  } | null>;
  writeOwnedWorkflowSupervisionSettings?(input: {
    ownerId: string;
    canvasId: string;
    workflowId: string;
    settings: WorkflowSupervisionSettingsInput;
  }): Promise<unknown>;
  deleteOwnedWorkflowSupervisionSettings?(ownerId: string, canvasId: string, workflowId: string): Promise<boolean>;
  readOwnedRun(ownerId: string, runId: string): Promise<CanvasRunRecord | null>;
  readOwnedWorkflowRunOverview?(ownerId: string, canvasId: string, limit?: number): Promise<CanvasRunRecord[]>;
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
  resolvePlanModelReferences?: (input: {
    ownerId: string;
    plan: ReturnType<typeof compileCanvasSnapshotRunPlan>;
  }) => Promise<ReturnType<typeof compileCanvasSnapshotRunPlan>>;
  readSupervisionLimits?: () => Promise<Partial<WorkflowSupervisionLimits>>;
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
    supervisionSettings?: WorkflowSupervisionSettingsInput;
  }) {
    assertAvailable();
    const canvas = await deps.repository.readOwnedCanvasSnapshot(input.ownerId, input.canvasId);
    if (!canvas) throw new Error("CANVAS_RUN_CANVAS_NOT_FOUND");
    const workflowId = typeof input.workflowId === "string" ? input.workflowId.trim() : "";
    const compiledPlan = workflowId
      ? compileWorkflowSnapshotRunPlan({
        canvasId: canvas.id,
        ownerId: input.ownerId,
        revision: canvas.revision,
        workflowId,
        data: canvas.data,
      })
      : compileCanvasSnapshotRunPlan({
        canvasId: canvas.id,
        ownerId: input.ownerId,
        revision: canvas.revision,
        data: canvas.data,
      });
    const workflow = workflowId
      ? normalizeWorkflowDocuments(record(canvas.data).workflows).find((candidate) => candidate.id === workflowId)
      : undefined;
    const remembered = workflowId && deps.repository.readOwnedWorkflowSupervisionSettings
      ? await deps.repository.readOwnedWorkflowSupervisionSettings(input.ownerId, input.canvasId, workflowId)
      : null;
    const supervision = resolveWorkflowSupervisionSettings({
      limits: deps.readSupervisionLimits ? await deps.readSupervisionLimits() : DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
      workflowDefaults: workflow?.supervisionDefaults,
      remembered: remembered?.settings,
      runOverride: {
        ...legacySupervisionOverrides(input.configuration, input.budget),
        ...(input.supervisionSettings || {}),
      },
    });
    const legacyConfiguration = normalizeCanvasRunConfiguration(input.configuration);
    const configurationSnapshot = {
      ...legacyConfiguration,
      qualityEvaluationEnabled: supervision.settings.candidateSelectionMode === "ai",
      selectionPolicy: supervision.settings.candidateSelectionCount === 1 ? "best" : "top_k",
      selectionMaximum: supervision.settings.candidateSelectionCount,
      selectionMinimumScore: supervision.settings.candidateMinimumConfidence,
      retryExhaustionPolicy: supervision.settings.retryExhaustionPolicy,
      maxFallbackCount: supervision.settings.maxFallbackCount,
      promptReviewRewriteEnabled: supervision.settings.promptReviewRewriteEnabled,
      promptReviewMaxRetries: supervision.settings.promptReviewMaxRetries,
      stageConcurrency: supervision.settings.stageConcurrency,
      lowConfidenceManualFallback: supervision.settings.lowConfidenceManualFallback,
      nodeRetryOverrides: supervision.settings.nodeRetryOverrides,
      supervision: {
        schemaVersion: 1,
        settings: supervision.settings,
        sources: supervision.sources,
        overriddenFields: supervision.overriddenFields,
        clampedFields: supervision.clampedFields,
      },
    };
    const configuredPlan = applyCanvasRunConfiguration(compiledPlan, configurationSnapshot, Boolean(workflowId));
    const inputSnapshot = compileWorkflowInputSnapshot({
      data: canvas.data,
      workflowId,
      values: input.workflowInputValues,
    });
    const inputResolvedPlan = await applyWorkflowInputSnapshot(configuredPlan, inputSnapshot, input.ownerId, deps.repository);
    const plan = deps.resolvePlanModelReferences
      ? await deps.resolvePlanModelReferences({ ownerId: input.ownerId, plan: inputResolvedPlan })
      : inputResolvedPlan;
    if (plan.steps.length === 0) throw new Error("CANVAS_RUN_PLAN_EMPTY");
    return deps.repository.createCanvasRun({
      ownerId: input.ownerId,
      idempotencyKey: input.idempotencyKey,
      plan,
      runScope: workflowId ? "workflow" : input.runScope,
      configurationSnapshot,
      budgetSnapshot: {
        ...normalizeCanvasRunBudget(input.budget),
        maxAttemptsPerStep: supervision.settings.defaultRetryCount,
        maxDurationSeconds: supervision.settings.maxDurationSeconds,
        maxCost: supervision.settings.maxCost,
        currency: supervision.settings.currency,
        nodeRetryOverrides: supervision.settings.nodeRetryOverrides,
      },
      inputSnapshot,
    });
  }

  async function readRun(ownerId: string, runId: string) {
    assertAvailable();
    const run = await deps.repository.readOwnedRun(ownerId, runId);
    if (!run) throw new Error("CANVAS_RUN_NOT_FOUND");
    return run;
  }

  async function listWorkflowRuns(input: { ownerId: string; canvasId: string }) {
    assertAvailable();
    if (!deps.repository.readOwnedWorkflowRunOverview) return [];
    return deps.repository.readOwnedWorkflowRunOverview(input.ownerId, input.canvasId, 50);
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

  async function readWorkflowSettings(input: { ownerId: string; canvasId: string; workflowId: string }) {
    assertAvailable();
    const canvas = await deps.repository.readOwnedCanvasSnapshot(input.ownerId, input.canvasId);
    if (!canvas) throw new Error("CANVAS_RUN_CANVAS_NOT_FOUND");
    const workflow = normalizeWorkflowDocuments(record(canvas.data).workflows)
      .find((candidate) => candidate.id === input.workflowId);
    if (!workflow) throw new Error(`WORKFLOW_NOT_FOUND:${input.workflowId}`);
    const remembered = deps.repository.readOwnedWorkflowSupervisionSettings
      ? await deps.repository.readOwnedWorkflowSupervisionSettings(input.ownerId, input.canvasId, input.workflowId)
      : null;
    const limits = normalizeWorkflowSupervisionLimits(
      deps.readSupervisionLimits ? await deps.readSupervisionLimits() : DEFAULT_WORKFLOW_SUPERVISION_LIMITS,
    );
    const resolved = resolveWorkflowSupervisionSettings({
      limits,
      workflowDefaults: workflow.supervisionDefaults,
      remembered: remembered?.settings,
    });
    return {
      canvasId: input.canvasId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowRevision: workflow.revision,
      settings: resolved.settings,
      sources: resolved.sources,
      clampedFields: resolved.clampedFields,
      hasRemembered: Boolean(remembered),
      rememberedRevision: remembered?.revision ?? null,
      rememberedUpdatedAt: remembered?.updatedAt ?? null,
      platformLimits: limits,
      appliesTo: "next_run" as const,
    };
  }

  async function saveWorkflowSettings(input: {
    ownerId: string;
    canvasId: string;
    workflowId: string;
    settings: Record<string, unknown>;
  }) {
    await readWorkflowSettings(input);
    if (!deps.repository.writeOwnedWorkflowSupervisionSettings) throw new Error("WORKFLOW_SUPERVISION_SETTINGS_UNAVAILABLE");
    await deps.repository.writeOwnedWorkflowSupervisionSettings({
      ownerId: input.ownerId,
      canvasId: input.canvasId,
      workflowId: input.workflowId,
      settings: normalizeWorkflowSupervisionOverrides(input.settings),
    });
    return readWorkflowSettings(input);
  }

  async function resetWorkflowSettings(input: { ownerId: string; canvasId: string; workflowId: string }) {
    await readWorkflowSettings(input);
    if (!deps.repository.deleteOwnedWorkflowSupervisionSettings) throw new Error("WORKFLOW_SUPERVISION_SETTINGS_UNAVAILABLE");
    await deps.repository.deleteOwnedWorkflowSupervisionSettings(input.ownerId, input.canvasId, input.workflowId);
    return readWorkflowSettings(input);
  }

  return { commandRun, createRun, listWorkflowRuns, readEvents, readRun, readWorkflowSettings, resetWorkflowSettings, saveWorkflowSettings };
}

function legacySupervisionOverrides(
  configuration: Record<string, unknown> | undefined,
  budget: Record<string, unknown> | undefined,
): WorkflowSupervisionSettingsInput {
  const output: WorkflowSupervisionSettingsInput = {};
  if (configuration && Object.prototype.hasOwnProperty.call(configuration, "qualityEvaluationEnabled")) {
    output.candidateSelectionMode = configuration.qualityEvaluationEnabled === true ? "ai" : "manual";
  }
  if (configuration && Object.prototype.hasOwnProperty.call(configuration, "selectionMaximum")) {
    output.candidateSelectionCount = integer(configuration.selectionMaximum, 1, 16, 1);
  }
  if (configuration && Object.prototype.hasOwnProperty.call(configuration, "selectionMinimumScore")) {
    output.candidateMinimumConfidence = Math.max(0, Math.min(100, Number(decimal(configuration.selectionMinimumScore, "0"))));
  }
  if (budget && Object.prototype.hasOwnProperty.call(budget, "maxAttemptsPerStep")) {
    output.defaultRetryCount = integer(budget.maxAttemptsPerStep, 0, 10, 3);
  }
  if (budget && Object.prototype.hasOwnProperty.call(budget, "maxDurationSeconds")) {
    output.maxDurationSeconds = integer(budget.maxDurationSeconds, 60, 86_400, 3_600);
  }
  if (budget && Object.prototype.hasOwnProperty.call(budget, "maxCost")) output.maxCost = decimal(budget.maxCost, "0");
  if (budget && typeof budget.currency === "string" && /^[A-Z]{3}$/.test(budget.currency)) output.currency = budget.currency;
  return output;
}

async function applyWorkflowInputSnapshot(
  plan: ReturnType<typeof compileCanvasSnapshotRunPlan>,
  rawSnapshot: Record<string, unknown>,
  ownerId: string,
  repository: CanvasRunServiceRepository,
) {
  if (!plan.workflowId) return plan;
  const snapshotVariables = Array.isArray(rawSnapshot.variables) ? rawSnapshot.variables.filter(isRecord) : [];
  const variablesById = new Map(snapshotVariables.map((variable) => [String(variable.id || ""), variable]));
  const inputs = plan.steps.filter((step) => step.nodeType === "workflow-input").map((step) => {
    const payload = record(step.configuration?.executionPayload);
    const variableId = typeof payload.variableId === "string" ? payload.variableId : "";
    const portType = typeof payload.portType === "string" ? payload.portType : "";
    const variable = variablesById.get(variableId);
    if (!variable) throw new Error(`WORKFLOW_BOUNDARY_VARIABLE_INVALID:${step.nodeId}`);
    if (variable.type !== portType) throw new Error(`WORKFLOW_BOUNDARY_VARIABLE_TYPE_MISMATCH:${step.nodeId}`);
    if (variable.source === "missing") throw new Error(`WORKFLOW_BOUNDARY_VALUE_MISSING:${step.nodeId}`);
    return { step, payload, variableId, portType, value: variable.value };
  });
  const mediaInputs = inputs.filter((input) => input.portType !== "text");
  const assetIds = mediaInputs.map((input) => {
    const value = record(input.value);
    return typeof value.assetId === "string" ? value.assetId : "";
  });
  let assetsById = new Map<string, { id: string; kind: string; url: string }>();
  if (assetIds.some(Boolean)) {
    if (!repository.readOwnedWorkflowInputAssets) throw new Error("WORKFLOW_BOUNDARY_ASSET_RESOLVER_REQUIRED");
    const assets = await repository.readOwnedWorkflowInputAssets(ownerId, [...new Set(assetIds)]);
    assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  }
  const inputByStepId = new Map(inputs.map((input) => [input.step.id, input]));
  return {
    ...plan,
    steps: plan.steps.map((step) => {
      const input = inputByStepId.get(step.id);
      if (!input) return step;
      const executionPayload: Record<string, unknown> = {
        ...input.payload,
        workflowVariableId: input.variableId,
      };
      if (input.portType === "text") {
        if (typeof input.value !== "string") throw new Error(`WORKFLOW_BOUNDARY_VALUE_TYPE_MISMATCH:${step.nodeId}:text`);
        executionPayload.text = input.value;
        executionPayload.prompt = input.value;
        executionPayload.outputText = input.value;
      } else {
        const reference = record(input.value);
        const assetId = typeof reference.assetId === "string" ? reference.assetId : "";
        const asset = assetsById.get(assetId);
        if (!asset || asset.kind !== input.portType || !asset.url) {
          throw new Error(`WORKFLOW_BOUNDARY_ASSET_NOT_FOUND:${step.nodeId}:${assetId}`);
        }
        executionPayload.workflowAssetId = asset.id;
        executionPayload[`${input.portType}Url`] = asset.url;
        executionPayload[`${input.portType}Urls`] = [asset.url];
      }
      return {
        ...step,
        configuration: { ...(step.configuration || {}), executionPayload },
      };
    }),
  };
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
  explicitCandidateBoundary: boolean,
) {
  if (explicitCandidateBoundary) {
    return {
      ...plan,
      steps: plan.steps.map((step) => step.nodeType === "image" || step.nodeType === "video" ? {
        ...step,
        configuration: {
          ...(step.configuration || {}),
          qualityEvaluationEnabled: false,
        },
      } : step),
    };
  }
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
