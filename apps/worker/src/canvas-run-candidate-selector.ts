import {
  assertSmartCandidateSet,
  resolveSmartCandidateBarrier,
  type SmartCandidate,
  type SmartCandidateUpstreamStatus,
} from "@xinghuan/agent-core";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  resolveCanvasRunArtifactProvenance,
  type CanvasRunSourceTask,
} from "./canvas-run-artifact-provenance.js";

interface SelectorUpstreamStep {
  id: string;
  nodeId: string;
  status: SmartCandidateUpstreamStatus;
  outputBinding: Record<string, unknown>;
}

interface SelectorArtifact {
  id: string;
  ownerId?: string;
  sourceTaskId?: string;
  kind: "image" | "video";
  fileUrl: string;
  sourceNodeId: string;
  providerId: string;
  modelId: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface SmartCandidateRuntimeContext {
  schemaVersion: 1;
  mediaKind: "image" | "video";
  mode: "manual" | "ai";
  maximum: number;
  minimumConfidence: number;
  lowConfidencePolicy: "request_manual" | "stop";
  criteria: string;
  note: string;
  candidates: SmartCandidate[];
}

export function resolveSmartCandidateQualityGate(
  context: Pick<SmartCandidateRuntimeContext, "mode" | "lowConfidencePolicy">,
  qualityEvaluationEnabled: boolean,
) {
  if (context.mode !== "ai") return "manual" as const;
  if (qualityEvaluationEnabled) return "evaluate" as const;
  return context.lowConfidencePolicy === "request_manual" ? "manual" as const : "stop" as const;
}

export function createSmartCandidateRuntimeContext(input: {
  selectorStep: { nodeId: string; dependsOn: string[] };
  planSnapshot: Record<string, unknown>;
  inputSnapshot: Record<string, unknown>;
  configurationSnapshot: Record<string, unknown>;
  upstreamSteps: SelectorUpstreamStep[];
  artifacts: SelectorArtifact[];
  sourceTasks?: CanvasRunSourceTask[];
}): SmartCandidateRuntimeContext {
  const barrier = resolveSmartCandidateBarrier({
    dependencyNodeIds: input.selectorStep.dependsOn,
    upstreamSteps: input.upstreamSteps.map((step) => ({
      nodeId: step.nodeId,
      status: step.status,
      artifactIds: strings(step.outputBinding.generationArtifactIds),
    })),
  });
  if (barrier.state !== "ready") throw new Error("SMART_CANDIDATE_BARRIER_INCOMPLETE");
  const planSteps = arrayOfRecords(record(input.planSnapshot).steps);
  const selectorPlan = planSteps.find((step) => text(step.nodeId) === input.selectorStep.nodeId) || {};
  const selector = record(record(selectorPlan.configuration).smartCandidateSelector);
  const planStepByNodeId = new Map(planSteps.map((step) => [text(step.nodeId), step]));
  const artifactsById = new Map(input.artifacts.map((artifact) => [artifact.id, artifact]));
  const sourceTaskById = new Map((input.sourceTasks || []).map((task) => [task.id, task]));
  const variableSnapshot = workflowVariableSnapshot(input.inputSnapshot);
  const candidates = barrier.artifactIds.map((artifactId) => {
    const artifact = artifactsById.get(artifactId);
    if (!artifact) throw new Error(`SMART_CANDIDATE_ARTIFACT_NOT_FOUND:${artifactId}`);
    const sourcePlan = planStepByNodeId.get(artifact.sourceNodeId) || {};
    const payload = record(record(sourcePlan.configuration).executionPayload);
    const provenance = resolveCanvasRunArtifactProvenance({
      artifact,
      sourceTask: artifact.sourceTaskId ? sourceTaskById.get(artifact.sourceTaskId) : undefined,
    });
    return {
      artifactId,
      mediaKind: artifact.kind,
      fileUrl: artifact.fileUrl,
      sourceNodeId: provenance.sourceNodeId || artifact.sourceNodeId,
      prompt: provenance.resolvedPrompt || text(artifact.metadata.prompt) || text(payload.prompt) || text(payload.text),
      variableSnapshot,
      providerId: provenance.providerId || artifact.providerId,
      modelRecordId: provenance.modelRecordId || artifact.modelId,
      createdAt: artifact.createdAt,
    };
  });
  assertSmartCandidateSet(candidates);
  const mediaKind = selector.mediaKind === "video" ? "video" as const : "image" as const;
  if (candidates.some((candidate) => candidate.mediaKind !== mediaKind)) {
    throw new Error("SMART_CANDIDATE_SELECTOR_MEDIA_KIND_MISMATCH");
  }
  const configuredMode = input.configurationSnapshot.candidateSelectionMode;
  const configuredMaximum = input.configurationSnapshot.selectionMaximum;
  const configuredConfidence = Number(input.configurationSnapshot.candidateMinimumConfidence);
  const criteria = input.upstreamSteps
    .flatMap((step) => [text(step.outputBinding.text), text(step.outputBinding.outputText), text(step.outputBinding.prompt)])
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 20_000);
  return {
    schemaVersion: 1,
    mediaKind,
    mode: configuredMode === "ai" || configuredMode === "manual"
      ? configuredMode
      : selector.mode === "ai" ? "ai" : "manual",
    maximum: boundedInteger(configuredMaximum ?? selector.maximum, 1, 8, 1),
    minimumConfidence: boundedConfidence(Number.isFinite(configuredConfidence)
      ? configuredConfidence
      : Number(selector.minimumConfidence)),
    lowConfidencePolicy: input.configurationSnapshot.lowConfidenceManualFallback === false
      || selector.lowConfidencePolicy === "stop"
      ? "stop"
      : "request_manual",
    criteria,
    note: text(selector.note).slice(0, 2_000),
    candidates,
  };
}

export async function initializeSmartCandidateSelector(input: {
  pool: Pool;
  environment: string;
  appendEvent: (
    client: PoolClient,
    runId: string,
    stepId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
}) {
  const client = await input.pool.connect();
  try {
    await client.query("begin");
    const claimed = await client.query(
      `select s.*, r.owner_id, r.plan_snapshot, r.input_snapshot, r.configuration_snapshot
       from xh_canvas_run_steps s
       join xh_canvas_runs r on r.id = s.run_id
       where r.status in ('queued', 'running')
         and s.status = 'ready'
         and s.node_type = 'smart-candidate-selector'
         and coalesce(s.execution_layer, 0) = (
           select min(coalesce(layer_step.execution_layer, 0)) from xh_canvas_run_steps layer_step
           where layer_step.run_id = r.id
             and layer_step.status not in ('succeeded', 'failed', 'cancelled', 'skipped')
         )
       order by r.updated_at asc, s.sequence asc
       for update of s, r skip locked
       limit 1`,
    );
    const step = claimed.rows[0] as Record<string, unknown> | undefined;
    if (!step) {
      await client.query("rollback");
      return false;
    }
    const dependsOn = strings(step.depends_on);
    const upstream = await client.query(
      `select d.id, d.node_id, d.status, d.output_binding
       from xh_canvas_run_steps d
       where d.run_id = $1 and d.node_id = any($2::text[])
       order by d.sequence`,
      [step.run_id, dependsOn],
    );
    const artifactIds = [...new Set(upstream.rows.flatMap((row) => strings(record(row.output_binding).generationArtifactIds)))];
    const artifacts = await client.query(
      `select id, kind, file_url, source_task_id, source_node_id, provider_id, model_id, metadata, created_at
       from xh_generation_artifacts
       where owner_id = $1 and id = any($2::text[]) and status in ('active', 'promoted')
       order by created_at asc, id asc`,
      [step.owner_id, artifactIds],
    );
    const sourceTaskIds = [...new Set(artifacts.rows.map((row) => text(row.source_task_id)).filter(Boolean))];
    const sourceTasks = sourceTaskIds.length > 0
      ? await client.query(
        `select id, owner_id, provider_id, model_id, payload
         from xh_tasks
         where owner_id = $1 and id = any($2::text[])`,
        [step.owner_id, sourceTaskIds],
      )
      : { rows: [] as Record<string, unknown>[] };
    let context: SmartCandidateRuntimeContext;
    try {
      context = createSmartCandidateRuntimeContext({
        selectorStep: { nodeId: text(step.node_id), dependsOn },
        planSnapshot: record(step.plan_snapshot),
        inputSnapshot: record(step.input_snapshot),
        configurationSnapshot: record(step.configuration_snapshot),
        upstreamSteps: upstream.rows.map((row) => ({
          id: text(row.id),
          nodeId: text(row.node_id),
          status: text(row.status) as SmartCandidateUpstreamStatus,
          outputBinding: record(row.output_binding),
        })),
        artifacts: artifacts.rows.map((row) => ({
          id: text(row.id),
          ownerId: text(step.owner_id),
          sourceTaskId: text(row.source_task_id),
          kind: row.kind === "video" ? "video" : "image",
          fileUrl: text(row.file_url),
          sourceNodeId: text(row.source_node_id),
          providerId: text(row.provider_id),
          modelId: text(row.model_id),
          metadata: record(row.metadata),
          createdAt: new Date(String(row.created_at)).getTime(),
        })),
        sourceTasks: sourceTasks.rows.map((row) => ({
          id: text(row.id),
          ownerId: text(row.owner_id),
          providerId: text(row.provider_id),
          modelRecordId: text(row.model_id),
          payload: record(row.payload),
        })),
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "SMART_CANDIDATE_CONTEXT_INVALID";
      if (code === "SMART_CANDIDATE_BARRIER_INCOMPLETE") {
        await client.query("rollback");
        return false;
      }
      await client.query(
        `update xh_canvas_run_steps
         set status = 'failed', error = $2::jsonb, finalized_at = now(), updated_at = now()
         where id = $1`,
        [step.id, JSON.stringify({ code, nodeType: "smart-candidate-selector" })],
      );
      await client.query(
        `update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now()
         where id = $1`,
        [step.run_id],
      );
      await input.appendEvent(client, text(step.run_id), text(step.id), "canvas_run.step_failed", {
        code,
        nodeType: "smart-candidate-selector",
      });
      await input.appendEvent(client, text(step.run_id), null, "canvas_run.failed", {
        stepId: text(step.id),
        code,
      });
      await client.query("commit");
      return true;
    }
    const upstreamStepIdByNodeId = new Map(upstream.rows.map((row) => [text(row.node_id), text(row.id)]));
    for (const candidate of context.candidates) {
      await client.query(
        `insert into xh_canvas_run_candidate_artifacts
          (id, owner_id, canvas_run_id, run_step_id, source_run_step_id, artifact_id, media_kind,
           selection_status, provenance_snapshot)
         values ($1,$2,$3,$4,$5,$6,$7,'candidate',$8::jsonb)
         on conflict (run_step_id, artifact_id) do nothing`,
        [
          `canvas_run_candidate_${randomUUID()}`,
          step.owner_id,
          step.run_id,
          step.id,
          upstreamStepIdByNodeId.get(candidate.sourceNodeId) || null,
          candidate.artifactId,
          candidate.mediaKind,
          JSON.stringify(candidate),
        ],
      );
    }
    const qualityEvaluationEnabled = await readQualityEvaluationEnabled(client, input.environment);
    const qualityGate = resolveSmartCandidateQualityGate(context, qualityEvaluationEnabled);
    if (qualityGate === "stop") {
      const code = "CANVAS_RUN_QUALITY_DISABLED";
      await client.query(
        `update xh_canvas_run_steps set status = 'failed', error = $2::jsonb,
          finalized_at = now(), updated_at = now() where id = $1`,
        [step.id, JSON.stringify({ code, nodeType: "smart-candidate-selector" })],
      );
      await client.query(
        `update xh_canvas_runs set status = 'failed', finalized_at = now(), updated_at = now() where id = $1`,
        [step.run_id],
      );
      await input.appendEvent(client, text(step.run_id), text(step.id), "canvas_run.step_failed", { code });
      await input.appendEvent(client, text(step.run_id), null, "canvas_run.failed", { stepId: text(step.id), code });
      await client.query("commit");
      return true;
    }
    const nextStatus = qualityGate === "evaluate" ? "evaluating" : "selecting";
    const candidateContext = qualityGate === "manual" && context.mode === "ai"
      ? { ...context, transferReason: "quality_evaluation_disabled", aiConfidence: 0 }
      : context;
    const qualityContext = qualityGate === "evaluate" ? {
      artifactIds: context.candidates.map((candidate) => candidate.artifactId),
      mediaKind: context.mediaKind,
      goal: selectorGoal(context),
      profileKey: "",
      selectionPolicy: context.maximum === 1 ? "best" : "top_k",
      selectionMaximum: context.maximum,
      selectionMinimumScore: 0,
      currentIndex: 0,
      evaluations: [],
      smartCandidateSelector: context,
    } : {};
    await client.query(
      `update xh_canvas_run_steps
       set status = $2, candidate_context = $3::jsonb, quality_context = $4::jsonb,
         started_at = coalesce(started_at, now()), updated_at = now()
       where id = $1`,
      [step.id, nextStatus, JSON.stringify(candidateContext), JSON.stringify(qualityContext)],
    );
    await client.query(
      `update xh_canvas_runs set status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
       where id = $1 and status = 'queued'`,
      [step.run_id],
    );
    await input.appendEvent(
      client,
      text(step.run_id),
      text(step.id),
      qualityGate === "evaluate"
        ? "canvas_run.candidate_evaluation_started"
        : context.mode === "ai"
          ? "canvas_run.candidate_selection_manual_required"
          : "canvas_run.candidate_selection_waiting",
      {
        candidateCount: context.candidates.length,
        mediaKind: context.mediaKind,
        maximum: context.maximum,
        ...(qualityGate === "manual" && context.mode === "ai"
          ? { reason: "quality_evaluation_disabled", confidence: 0 }
          : {}),
      },
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readQualityEvaluationEnabled(client: PoolClient, environment: string) {
  if (environment === "local" || environment === "test") return true;
  const result = await client.query(
    `select quality_evaluation_enabled from xh_agent_runtime_controls where environment = $1 limit 1`,
    [environment],
  );
  return result.rows[0]?.quality_evaluation_enabled === true;
}

function selectorGoal(context: SmartCandidateRuntimeContext) {
  return [
    context.criteria,
    context.note ? `User selection note: ${context.note}` : "",
    `Workflow variable snapshots by candidate: ${JSON.stringify(context.candidates.map((candidate) => ({
      artifactId: candidate.artifactId,
      variables: candidate.variableSnapshot,
    })))}`,
  ].filter(Boolean).join("\n\n").slice(0, 30_000);
}

function workflowVariableSnapshot(value: Record<string, unknown>) {
  const variables = Array.isArray(value.variables) ? value.variables.map(record) : [];
  return Object.fromEntries(variables.flatMap((variable) => {
    const id = text(variable.id);
    return id ? [[id, variable.value]] : [];
  }));
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function strings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

function boundedConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}
