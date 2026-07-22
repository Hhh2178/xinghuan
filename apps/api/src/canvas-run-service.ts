import { compileCanvasSnapshotRunPlan } from "@xinghuan/agent-core";

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
    return deps.repository.createCanvasRun({
      ownerId: input.ownerId,
      idempotencyKey: input.idempotencyKey,
      plan,
      runScope: input.runScope,
      configurationSnapshot,
      budgetSnapshot: normalizeCanvasRunBudget(input.budget),
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
