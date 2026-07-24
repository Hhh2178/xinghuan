import { randomUUID } from "node:crypto";
import {
  evaluateArtifactQuality,
  nextLlmRouteState,
  routeLlmCandidates,
  routeVideoUnderstandingCandidates,
  resolveSmartCandidateSelection,
  selectArtifactCandidates,
  type ArtifactEvaluationResult,
  type ArtifactMediaKind,
  type LlmRouteCandidate,
  type LlmRouteEntryState,
  type ArtifactQualityProfile,
} from "@xinghuan/agent-core";
import { taskQueueNameForCapability } from "@xinghuan/shared";
import { prepareInlineImageReferences } from "@xinghuan/shared/node/grsai-reference-images";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { RedisClientType } from "redis";
import { advanceCanvasRunDispatchCursor, CANVAS_RUN_DISPATCH_SCOPES, lockCanvasRunDispatchCursor } from "./canvas-run-dispatch-fairness.js";
import {
  qualityGovernanceUnavailableReason,
  runQualitySettlementStage,
  settleWithQualitySavepoint,
  smartCandidateUnavailableDisposition,
} from "./canvas-run-quality-containment.js";
import {
  boundedInteger,
  boundedNumber,
  appendEvent,
  currentRouteCandidate,
  currentRouteEntryId,
  effectiveRouteState,
  extractJsonObject,
  failQualityStep,
  finalizeRunIfComplete,
  normalizeContext,
  object,
  planSteps,
  qualityMessages,
  qualityPolicy,
  qualityRuntimeEnabled,
  qualitySamples,
  readOwnedArtifact,
  readQualityBudgetError,
  readPublishedProfile,
  releaseEnvironment,
  scoreSnapshot,
  strings,
  text,
  unlockDependents,
  type QualityContext,
} from "./canvas-run-quality-support.js";

const QUALITY_SCENARIO = "artifact-quality";
const QUALITY_BINDING_KEY = "qualityOutput";

interface QualityStepRow extends QueryResultRow {
  id: string;
  run_id: string;
  owner_id: string;
  node_id: string;
  node_type: string;
  status: string;
  plan_snapshot: Record<string, unknown>;
  budget_snapshot: Record<string, unknown>;
  run_created_at?: Date;
  output_binding: Record<string, unknown>;
  quality_task_id: string | null;
  quality_dispatch_enqueued_at: Date | null;
  quality_context: Record<string, unknown>;
  candidate_context?: Record<string, unknown>;
  quality_task_status?: string | null;
  quality_task_result?: Record<string, unknown> | null;
}

export function qualityContextForCompletedStep(input: {
  nodeType: string;
  nodeId: string;
  planSnapshot: Record<string, unknown>;
  taskResult: Record<string, unknown>;
}): QualityContext | null {
  if (input.nodeType !== "image" && input.nodeType !== "video") return null;
  const planStep = planSteps(input.planSnapshot).find((item) => text(item.nodeId) === input.nodeId) || {};
  const configuration = object(planStep.configuration);
  if (configuration.qualityEvaluationEnabled !== true) return null;
  const artifactIds = strings(input.taskResult.generationArtifactIds);
  if (artifactIds.length < 2) return null;
  const payload = object(configuration.executionPayload);
  return {
    artifactIds,
    mediaKind: input.nodeType,
    goal: text(payload.prompt || payload.text).slice(0, 20_000),
    profileKey: text(configuration.qualityProfileKey),
    selectionPolicy: qualityPolicy(configuration.selectionPolicy),
    selectionMaximum: boundedInteger(configuration.selectionMaximum, 1, 16, 1),
    selectionMinimumScore: boundedNumber(configuration.selectionMinimumScore, 0, 100, 0),
    currentIndex: 0,
    evaluations: [],
  };
}

export function parseQualityEvaluationContent(input: {
  content: string;
  artifactId: string;
  mediaKind: ArtifactMediaKind;
  profile: ArtifactQualityProfile;
  sampledTimestampsMs?: number[];
  smartCandidate?: boolean;
}): ArtifactEvaluationResult & { variableAlignment?: number; noteAlignment?: number; summary?: string } {
  const parsed = JSON.parse(extractJsonObject(input.content));
  const common = {
    artifactId: input.artifactId,
    technicalValidity: parsed.technicalValidity,
    promptAlignment: parsed.promptAlignment,
    composition: parsed.composition,
    visualQuality: parsed.visualQuality,
    defects: strings(parsed.defects).slice(0, 50),
    evidence: strings(parsed.evidence).slice(0, 50),
    confidence: parsed.confidence,
  };
  const evaluation = evaluateArtifactQuality(input.mediaKind === "image"
    ? { mediaKind: "image", ...common }
    : {
      mediaKind: "video",
      ...common,
      temporalCoherence: parsed.temporalCoherence,
      motionQuality: parsed.motionQuality,
      keyframeConsistency: parsed.keyframeConsistency,
      sampledTimestampsMs: input.sampledTimestampsMs || [],
    }, input.profile);
  if (!input.smartCandidate) return evaluation;
  return {
    ...evaluation,
    variableAlignment: selectorScore(parsed.variableAlignment, "variableAlignment"),
    noteAlignment: selectorScore(parsed.noteAlignment, "noteAlignment"),
    summary: text(parsed.summary).slice(0, 1_000) || "No visible selection summary.",
  };
}

function selectorScore(value: unknown, key: string) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`SMART_CANDIDATE_SCORE_INVALID:${key}`);
  return score;
}

export function createCanvasRunQualityCoordinator(options: {
  pool: Pool;
  redis: RedisClientType;
  workerId: string;
  environment: string;
  queueName: string;
  dataDir: string;
  enabled: boolean;
  pollIntervalMs?: number;
}) {
  const pollIntervalMs = Math.max(250, options.pollIntervalMs || 1_000);
  let stopping = false;

  async function run() {
    if (!options.enabled) return;
    while (!stopping) {
      try {
        if (await qualityRuntimeEnabled(options.pool, options.environment)) await tick();
      } catch (error) {
        console.error("canvas run quality coordinator tick failed", error instanceof Error ? error.message : String(error));
      }
      await wait(pollIntervalMs);
    }
  }

  function stop() {
    stopping = true;
  }

  async function tick() {
    await settleQualityTask();
    await enqueuePendingQualityTask();
    await claimQualityWork();
  }

  async function settleQualityTask() {
    const result = await options.pool.query<QualityStepRow>(
      `select s.*, r.owner_id, r.plan_snapshot, t.status as quality_task_status, t.result as quality_task_result
       from xh_canvas_run_steps s
       join xh_canvas_runs r on r.id = s.run_id
       join xh_tasks t on t.id = s.quality_task_id
       where r.status = 'running' and s.status = 'evaluating'
         and t.status in ('succeeded', 'failed', 'cancelled')
       order by s.updated_at asc limit 1`,
    );
    const candidate = result.rows[0];
    if (!candidate) return;
    const client = await options.pool.connect();
    try {
      await client.query("begin");
      const locked = await client.query<QualityStepRow>(
        `select s.*, r.owner_id, r.plan_snapshot, t.status as quality_task_status, t.result as quality_task_result
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id join xh_tasks t on t.id = s.quality_task_id
         where s.id = $1 for update of s, r`,
        [candidate.id],
      );
      const step = locked.rows[0];
      if (!step || step.status !== "evaluating" || !step.quality_task_id) {
        await client.query("rollback");
        return;
      }
      const context = normalizeContext(step.quality_context);
      if (step.quality_task_status === "succeeded") {
        await settleWithQualitySavepoint({
          client,
          settleSuccessful: () => settleSuccessfulEvaluation(client, step, context),
          settleFailed: (reason) => settleFailedEvaluation(client, step, context, reason),
          settleContained: (reason, fallbackReason) => containQualitySettlementFailure(client, step, context, reason, fallbackReason),
        });
      } else {
        await settleFailedEvaluation(client, step, context, step.quality_task_status || "failed");
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function settleSuccessfulEvaluation(client: PoolClient, step: QualityStepRow, context: QualityContext) {
    const artifactId = context.artifactIds[context.currentIndex];
    const profile = context.profile;
    if (!artifactId || !profile) throw new Error("CANVAS_RUN_QUALITY_CONTEXT_INVALID");
    const content = text(object(step.quality_task_result).content || object(step.quality_task_result).text);
    const evaluation = await runQualitySettlementStage("parse_evaluation", async () => parseQualityEvaluationContent({
      content,
      artifactId,
      mediaKind: context.mediaKind,
      profile,
      sampledTimestampsMs: context.sampledTimestampsMs,
      smartCandidate: Boolean(context.smartCandidateSelector),
    }));
    const artifact = await runQualitySettlementStage("read_artifact", () =>
      readOwnedArtifact(client, step.owner_id, artifactId, context.mediaKind));
    const evaluationId = `artifact_evaluation_${randomUUID()}`;
    await runQualitySettlementStage("insert_evaluation", () => client.query(
      `insert into xh_artifact_evaluations
        (id, owner_id, artifact_id, canvas_run_id, run_step_id, agent_run_id, quality_profile_id, media_kind,
         evaluator_entry_id, evaluator_provider_id_snapshot, evaluator_model_id_snapshot, score_snapshot,
         evidence_snapshot, defect_snapshot, sample_snapshot, overall_score, confidence, passed, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19)
       on conflict (owner_id, idempotency_key) do nothing`,
      [evaluationId, step.owner_id, artifactId, step.run_id, step.id, context.agentRunId || null, profile.databaseId,
        context.mediaKind, currentRouteEntryId(context) || null, currentRouteCandidate(context)?.providerId || null,
        currentRouteCandidate(context)?.modelId || null, JSON.stringify(scoreSnapshot(evaluation)), JSON.stringify(evaluation.evidence),
        JSON.stringify(evaluation.defects), JSON.stringify({ inputMode: context.mediaKind === "video" ? context.videoInputMode : "image", sampledTimestampsMs: context.sampledTimestampsMs || [] }),
        evaluation.overallScore, evaluation.confidence, evaluation.passed, `${step.id}:quality:${artifactId}`],
    ));
    const replay = await runQualitySettlementStage("read_evaluation", () => client.query<{ id: string }>(
      `select id from xh_artifact_evaluations where owner_id = $1 and idempotency_key = $2 limit 1`,
      [step.owner_id, `${step.id}:quality:${artifactId}`],
    ));
    const effectiveEvaluationId = replay.rows[0]?.id || evaluationId;
    await runQualitySettlementStage("complete_agent_attempt", () =>
      completeAgentAttempt(client, context, true, { evaluationId: effectiveEvaluationId, overallScore: evaluation.overallScore }));
    await runQualitySettlementStage("record_route_outcome", () =>
      recordRouteOutcome(client, currentRouteEntryId(context), "success"));
    await runQualitySettlementStage("release_half_open_probe", () => releaseHalfOpenProbe(client, context));
    const evaluations = [...context.evaluations, {
      evaluationId: effectiveEvaluationId,
      artifactId,
      fileUrl: artifact.file_url,
      createdAt: new Date(artifact.created_at).getTime(),
      overallScore: context.smartCandidateSelector
        ? Math.round(((evaluation.technicalValidity + evaluation.promptAlignment + evaluation.visualQuality
          + Number(evaluation.variableAlignment) + Number(evaluation.noteAlignment)) / 5) * 100) / 100
        : evaluation.overallScore,
      confidence: evaluation.confidence,
      technicalValidity: evaluation.technicalValidity,
      promptAlignment: evaluation.promptAlignment,
      visualQuality: evaluation.visualQuality,
      variableAlignment: evaluation.variableAlignment,
      noteAlignment: evaluation.noteAlignment,
      summary: evaluation.summary,
    }];
    const nextContext: QualityContext = {
      ...context,
      currentIndex: context.currentIndex + 1,
      evaluations,
      routeArtifactId: undefined,
      routeCandidates: undefined,
      routeOrderedEntryIds: undefined,
      routeRejected: undefined,
      routeReason: undefined,
      routeIndex: undefined,
      videoInputMode: undefined,
      fallbackRouteOrderedEntryIds: undefined,
      fallbackRouteRejected: undefined,
      fallbackRouteReason: undefined,
      agentRunId: undefined,
      agentActionId: undefined,
      profile: undefined,
      sampledTimestampsMs: undefined,
    };
    if (nextContext.currentIndex < nextContext.artifactIds.length) {
      await runQualitySettlementStage("advance_artifact", () => client.query(
        `update xh_canvas_run_steps set quality_task_id = null, quality_dispatch_enqueued_at = null,
          quality_context = $2::jsonb, updated_at = now() where id = $1`,
        [step.id, JSON.stringify(nextContext)],
      ));
      await runQualitySettlementStage("append_artifact_event", () => appendEvent(client, step.run_id, step.id, "canvas_run.quality_artifact_evaluated", {
        artifactId,
        evaluationId: effectiveEvaluationId,
        overallScore: evaluation.overallScore,
        remaining: nextContext.artifactIds.length - nextContext.currentIndex,
      }));
      return;
    }
    await runQualitySettlementStage("finalize_selection", () => finalizeSelection(client, step, nextContext));
  }

  async function settleFailedEvaluation(client: PoolClient, step: QualityStepRow, context: QualityContext, reason: string) {
    await runQualitySettlementStage("fail_agent_attempt", () =>
      completeAgentAttempt(client, context, false, { taskId: step.quality_task_id, status: step.quality_task_status || "failed", reason }));
    await runQualitySettlementStage("record_route_failure", () =>
      recordRouteOutcome(client, currentRouteEntryId(context), "technical_failure"));
    await runQualitySettlementStage("release_failed_probe", () => releaseHalfOpenProbe(client, context));
    const nextRouteIndex = Number(context.routeIndex || 0) + 1;
    if (nextRouteIndex < (context.routeOrderedEntryIds?.length || 0)) {
      const nextContext = { ...context, routeIndex: nextRouteIndex, agentRunId: undefined, agentActionId: undefined };
      await client.query(
        `update xh_canvas_run_steps set quality_task_id = null, quality_dispatch_enqueued_at = null,
          quality_context = $2::jsonb, updated_at = now() where id = $1`,
        [step.id, JSON.stringify(nextContext)],
      );
      await appendEvent(client, step.run_id, step.id, "canvas_run.quality_route_fallback", {
        artifactId: context.artifactIds[context.currentIndex],
        routeIndex: nextRouteIndex,
        reason,
      });
      return;
    }
    if (context.videoInputMode === "native_video" && context.fallbackRouteOrderedEntryIds?.length) {
      const nextContext: QualityContext = {
        ...context,
        videoInputMode: "sampled_frames",
        routeOrderedEntryIds: context.fallbackRouteOrderedEntryIds,
        routeRejected: context.fallbackRouteRejected,
        routeReason: context.fallbackRouteReason,
        routeIndex: 0,
        fallbackRouteOrderedEntryIds: undefined,
        fallbackRouteRejected: undefined,
        fallbackRouteReason: undefined,
      agentRunId: undefined,
      agentActionId: undefined,
      halfOpenProbeEntryId: undefined,
      halfOpenProbeOwner: undefined,
        sampledTimestampsMs: undefined,
      };
      await client.query(
        `update xh_canvas_run_steps set quality_task_id = null, quality_dispatch_enqueued_at = null,
          quality_context = $2::jsonb, updated_at = now() where id = $1`,
        [step.id, JSON.stringify(nextContext)],
      );
      await appendEvent(client, step.run_id, step.id, "canvas_run.quality_input_fallback", {
        artifactId: context.artifactIds[context.currentIndex],
        from: "native_video",
        to: "sampled_frames",
        reason,
      });
      return;
    }
    if (await settleSmartCandidateUnavailable(client, step, context, "quality_route_exhausted")) return;
    await failQualityStep(client, step, "CANVAS_RUN_QUALITY_ROUTE_EXHAUSTED");
  }

  async function containQualitySettlementFailure(
    client: PoolClient,
    step: QualityStepRow,
    context: QualityContext,
    reason: string,
    fallbackReason: string,
  ) {
    const boundedReason = reason.slice(0, 1_000);
    const boundedFallbackReason = fallbackReason.slice(0, 1_000);
    await appendEvent(client, step.run_id, step.id, "canvas_run.quality_settlement_contained", {
      reason: boundedReason,
      fallbackReason: boundedFallbackReason,
    });
    if (smartCandidateUnavailableDisposition(context) === "manual") {
      await transferSmartCandidateToManual(client, step, context, "quality_settlement_failed");
      return;
    }
    await failQualityStep(client, step, "CANVAS_RUN_QUALITY_SETTLEMENT_FAILED");
  }

  async function transferSmartCandidateToManual(
    client: PoolClient,
    step: QualityStepRow,
    context: QualityContext,
    reason: string,
    confidence: number | null = 0,
  ) {
    const selector = object(context.smartCandidateSelector);
    const normalizedConfidence = confidence ?? 0;
    const candidateContext = { ...selector, evaluations: context.evaluations, transferReason: reason, aiConfidence: normalizedConfidence };
    await client.query(
      `update xh_canvas_run_steps set status = 'selecting', candidate_context = $2::jsonb,
        quality_task_id = null, quality_dispatch_enqueued_at = null, quality_context = '{}'::jsonb,
        lease_owner = null, lease_expires_at = null, updated_at = now() where id = $1`,
      [step.id, JSON.stringify(candidateContext)],
    );
    await appendEvent(client, step.run_id, step.id, "canvas_run.candidate_selection_manual_required", {
      candidateCount: Array.isArray(selector.candidates) ? selector.candidates.length : 0,
      reason,
      confidence: normalizedConfidence,
    });
  }

  async function settleSmartCandidateUnavailable(client: PoolClient, step: QualityStepRow, context: QualityContext, reason: string) {
    const disposition = smartCandidateUnavailableDisposition(context);
    if (disposition === "not_smart") return false;
    await appendEvent(client, step.run_id, step.id, "canvas_run.quality_governance_unavailable", { reason });
    if (disposition === "manual") {
      await transferSmartCandidateToManual(client, step, context, reason);
      return true;
    }
    await failQualityStep(client, step, "CANVAS_RUN_QUALITY_GOVERNANCE_UNAVAILABLE");
    return true;
  }

  async function finalizeSelection(client: PoolClient, step: QualityStepRow, context: QualityContext) {
    const selector = object(context.smartCandidateSelector);
    const smartCandidates = Array.isArray(selector.candidates) ? selector.candidates.map(object).map((candidate) => ({
      artifactId: text(candidate.artifactId),
      mediaKind: candidate.mediaKind === "video" ? "video" as const : "image" as const,
      fileUrl: text(candidate.fileUrl),
      sourceNodeId: text(candidate.sourceNodeId),
      prompt: text(candidate.prompt),
      variableSnapshot: object(candidate.variableSnapshot),
      providerId: text(candidate.providerId),
      modelRecordId: text(candidate.modelRecordId),
      createdAt: Number(candidate.createdAt),
    })) : [];
    const smartResult = context.smartCandidateSelector ? resolveSmartCandidateSelection({
      mode: "ai",
      maximum: boundedInteger(selector.maximum, 1, 8, 1),
      minimumConfidence: boundedNumber(selector.minimumConfidence, 0, 1, 0),
      lowConfidencePolicy: selector.lowConfidencePolicy === "stop" ? "stop" : "request_manual",
      candidates: smartCandidates,
      evaluations: context.evaluations.map((evaluation) => ({
        artifactId: evaluation.artifactId,
        technicalValidity: Number(evaluation.technicalValidity),
        promptAlignment: Number(evaluation.promptAlignment),
        visualQuality: Number(evaluation.visualQuality),
        variableAlignment: Number(evaluation.variableAlignment),
        noteAlignment: Number(evaluation.noteAlignment),
        overallScore: evaluation.overallScore,
        confidence: evaluation.confidence,
        summary: evaluation.summary || "No visible selection summary.",
      })),
    }) : null;
    if (smartResult?.state === "awaiting_manual") {
      await transferSmartCandidateToManual(client, step, context, smartResult.reason, smartResult.confidence);
      return;
    }
    if (smartResult?.state === "stopped") {
      await failQualityStep(client, step, "SMART_CANDIDATE_LOW_CONFIDENCE");
      return;
    }
    const automaticSelection = selectArtifactCandidates({
      policy: context.selectionPolicy,
      maximum: context.selectionMaximum,
      minimumScore: context.selectionMinimumScore,
      candidates: context.evaluations.map((item) => ({ artifactId: item.artifactId, createdAt: item.createdAt })),
      evaluations: context.evaluations.map((item) => ({ artifactId: item.artifactId, overallScore: item.overallScore, confidence: item.confidence })),
    });
    const selection = smartResult?.state === "selected" ? {
      policy: context.selectionMaximum === 1 ? "best" as const : "top_k" as const,
      executionMode: smartResult.selectedArtifactIds.length <= 1 ? "single" as const : "batch" as const,
      selectedArtifactIds: smartResult.selectedArtifactIds,
      rejectedArtifactIds: smartResult.rejectedArtifactIds,
      reason: smartResult.reason,
      confidence: smartResult.confidence,
    } : automaticSelection;
    const selectionId = `artifact_selection_${randomUUID()}`;
    const bindingKey = context.smartCandidateSelector ? "smartCandidateSelection" : QUALITY_BINDING_KEY;
    await client.query(
      `insert into xh_artifact_selections
        (id, owner_id, canvas_run_id, run_step_id, binding_key, policy, source_artifact_ids, selected_artifact_ids,
         rejected_artifact_ids, evaluation_ids, reason, confidence, evaluator_version, binding_snapshot,
         selection_mode, criteria_snapshot, note_snapshot, candidate_snapshot, score_snapshot, selected_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,
         $15,$16::jsonb,$17,$18::jsonb,$19::jsonb,now())
       on conflict (run_step_id, binding_key) do nothing`,
      [selectionId, step.owner_id, step.run_id, step.id, bindingKey, selection.policy,
        JSON.stringify(context.artifactIds), JSON.stringify(selection.selectedArtifactIds), JSON.stringify(selection.rejectedArtifactIds),
        JSON.stringify(context.evaluations.map((item) => item.evaluationId)), selection.reason, selection.confidence,
        context.profileKey || "published-default", JSON.stringify({ executionMode: selection.executionMode }),
        context.smartCandidateSelector ? "ai" : null,
        JSON.stringify({ text: text(selector.criteria) }),
        text(selector.note),
        JSON.stringify(smartCandidates),
        JSON.stringify(context.evaluations)],
    );
    const selectedSet = new Set(selection.selectedArtifactIds);
    const selected = context.evaluations.filter((item) => selectedSet.has(item.artifactId));
    if (context.smartCandidateSelector) {
      for (const evaluation of context.evaluations) {
        await client.query(
          `update xh_canvas_run_candidate_artifacts
           set selection_status = $3, score_snapshot = $4::jsonb, updated_at = now()
           where run_step_id = $1 and artifact_id = $2`,
          [step.id, evaluation.artifactId, selectedSet.has(evaluation.artifactId) ? "selected" : "not_selected", JSON.stringify(evaluation)],
        );
      }
    }
    const output = {
      ...object(step.output_binding),
      generationArtifactIds: selection.selectedArtifactIds,
      imageUrls: context.mediaKind === "image" ? selected.map((item) => item.fileUrl) : [],
      videoUrls: context.mediaKind === "video" ? selected.map((item) => item.fileUrl) : [],
      ...(context.smartCandidateSelector ? {
        selectedCandidates: smartCandidates.filter((candidate) => selectedSet.has(candidate.artifactId)),
      } : {}),
      qualitySelection: {
        selectionId,
        policy: selection.policy,
        selectedArtifactIds: selection.selectedArtifactIds,
        rejectedArtifactIds: selection.rejectedArtifactIds,
        reason: selection.reason,
        confidence: selection.confidence,
      },
    };
    await client.query(
      `update xh_canvas_run_steps set status = 'succeeded', output_binding = $2::jsonb, quality_task_id = null,
        quality_dispatch_enqueued_at = null, quality_context = $3::jsonb, lease_owner = null, lease_expires_at = null,
        updated_at = now(), finalized_at = now() where id = $1`,
      [step.id, JSON.stringify(output), JSON.stringify(context)],
    );
    await appendEvent(client, step.run_id, step.id, "canvas_run.quality_selection_completed", {
      selectionId,
      selectedArtifactIds: selection.selectedArtifactIds,
      rejectedArtifactIds: selection.rejectedArtifactIds,
    });
    if (context.smartCandidateSelector) {
      const skipped = await client.query<{ id: string }>(
        `update xh_canvas_run_steps set status = 'skipped',
          error = '{"code":"skipped_by_selection"}'::jsonb, finalized_at = now(), updated_at = now()
         where run_id = $1 and status in ('blocked', 'ready')
           and input_binding->>'candidateArtifactId' = any($2::text[])
         returning id`,
        [step.run_id, selection.rejectedArtifactIds],
      );
      for (const skippedStep of skipped.rows) {
        await appendEvent(client, step.run_id, skippedStep.id, "canvas_run.step_skipped_by_selection", {
          selectorStepId: step.id,
          rejectedArtifactIds: selection.rejectedArtifactIds,
        });
      }
      await appendEvent(client, step.run_id, step.id, "canvas_run.candidate_selection_completed", {
        selectionId,
        selectedArtifactIds: selection.selectedArtifactIds,
        notSelectedArtifactIds: selection.rejectedArtifactIds,
        reason: selection.reason,
        confidence: selection.confidence,
      });
    }
    await appendEvent(client, step.run_id, step.id, "canvas_run.step_succeeded", { taskId: step.quality_task_id, qualitySelectionId: selectionId });
    await unlockDependents(client, step.run_id);
    await finalizeRunIfComplete(client, step.run_id);
  }

  async function enqueuePendingQualityTask() {
    const result = await options.pool.query<{ step_id: string; task_id: string }>(
      `select s.id as step_id, t.id as task_id
       from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id join xh_tasks t on t.id = s.quality_task_id
       where r.status = 'running' and s.status = 'evaluating' and t.status = 'queued'
         and s.quality_dispatch_enqueued_at is null
       order by s.updated_at asc limit 25`,
    );
    for (const row of result.rows) {
      await options.redis.lPush(taskQueueNameForCapability(options.queueName, "chat"), row.task_id);
      await options.pool.query(
        `update xh_canvas_run_steps set quality_dispatch_enqueued_at = now(), updated_at = now()
         where id = $1 and quality_task_id = $2 and quality_dispatch_enqueued_at is null`,
        [row.step_id, row.task_id],
      );
    }
  }

  async function claimQualityWork() {
    const client = await options.pool.connect();
    let dispatch: { stepId: string; taskId: string } | null = null;
    try {
      await client.query("begin");
      const lastOwnerId = await lockCanvasRunDispatchCursor(client, CANVAS_RUN_DISPATCH_SCOPES.quality);
      const result = await client.query<QualityStepRow>(
        `with ready_owners as (
           select r.owner_id
           from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
           where r.status = 'running' and s.status = 'evaluating' and s.quality_task_id is null
           group by r.owner_id
         ), next_owner as (
           select owner_id from ready_owners
           order by case when owner_id > $1 then 0 else 1 end, owner_id
           limit 1
         )
         select s.*, r.owner_id, r.plan_snapshot, r.budget_snapshot, r.created_at as run_created_at
         from xh_canvas_run_steps s join xh_canvas_runs r on r.id = s.run_id
         join next_owner on next_owner.owner_id = r.owner_id
         where r.status = 'running' and s.status = 'evaluating' and s.quality_task_id is null
         order by r.updated_at asc, s.sequence asc for update of s skip locked limit 1`,
        [lastOwnerId],
      );
      const step = result.rows[0];
      if (!step) {
        await client.query("rollback");
        return;
      }
      await advanceCanvasRunDispatchCursor(client, CANVAS_RUN_DISPATCH_SCOPES.quality, step.owner_id);
      const context = normalizeContext(step.quality_context);
      const budgetError = await readQualityBudgetError(client, step);
      if (budgetError) {
        await failQualityStep(client, step, budgetError);
        await client.query("commit");
        return;
      }
      const artifactId = context.artifactIds[context.currentIndex];
      if (!artifactId) {
        await failQualityStep(client, step, "CANVAS_RUN_QUALITY_CONTEXT_INVALID");
        await client.query("commit");
        return;
      }
      const artifact = await readOwnedArtifact(client, step.owner_id, artifactId, context.mediaKind);
      const samples = qualitySamples(artifact);
      let profile;
      try {
        profile = await readPublishedProfile(client, context.mediaKind, context.profileKey, releaseEnvironment(options.environment));
      } catch (error) {
        const reason = qualityGovernanceUnavailableReason(error);
        if (!reason) throw error;
        if (!await settleSmartCandidateUnavailable(client, step, context, reason)) {
          await failQualityStep(client, step, "CANVAS_RUN_QUALITY_GOVERNANCE_UNAVAILABLE");
        }
        await client.query("commit");
        return;
      }
      let routed = context;
      if (context.routeArtifactId !== artifactId || !context.routeOrderedEntryIds?.length) {
        try {
          routed = await routeQualityCandidates(client, step, context, artifactId, releaseEnvironment(options.environment), samples.length >= 2);
        } catch (error) {
          const reason = qualityGovernanceUnavailableReason(error);
          if (!reason) throw error;
          if (!await settleSmartCandidateUnavailable(client, step, context, reason)) {
            await failQualityStep(client, step, context.mediaKind === "video" ? "VIDEO_EVALUATION_INPUT_UNAVAILABLE" : "CANVAS_RUN_QUALITY_ROUTE_EXHAUSTED");
          }
          await client.query("commit");
          return;
        }
      }
      const routeCandidate = currentRouteCandidate(routed);
      if (!routeCandidate) {
        if (!await settleSmartCandidateUnavailable(client, step, context, "quality_route_exhausted")) {
          await failQualityStep(client, step, "CANVAS_RUN_QUALITY_ROUTE_EXHAUSTED");
        }
        await client.query("commit");
        return;
      }
      if (routed.videoInputMode === "sampled_frames" && samples.length < 2) {
        await failQualityStep(client, step, "VIDEO_EVALUATION_SAMPLES_REQUIRED");
        await client.query("commit");
        return;
      }
      const shouldPrepareFrames = context.mediaKind === "image" || routed.videoInputMode === "sampled_frames";
      let prepared: string[] = [];
      try {
        prepared = shouldPrepareFrames ? await prepareInlineImageReferences({
          dataDir: options.dataDir,
          ownerId: step.owner_id,
          values: samples.map((sample) => sample.url),
          limit: 12,
          maxBytesPerImage: 8 * 1024 * 1024,
          maxTotalBytes: 32 * 1024 * 1024,
          processing: { format: "jpeg", maxDimension: 1280, quality: 82 },
        }) : [];
      } catch {
        await failQualityStep(client, step, context.mediaKind === "video" ? "VIDEO_EVALUATION_SAMPLES_INVALID" : "IMAGE_EVALUATION_INPUT_INVALID");
        await client.query("commit");
        return;
      }
      const probeOwner = `canvas-quality:${step.id}:${artifactId}:${routed.routeIndex || 0}`;
      const holdsProbeLease = routeCandidate.state !== "half_open" || await claimHalfOpenProbe(client, routeCandidate.entryId, probeOwner, 900_000);
      if (!holdsProbeLease) {
        await appendEvent(client, step.run_id, step.id, "canvas_run.quality_half_open_busy", {
          artifactId,
          routeEntryId: routeCandidate.entryId,
        });
        await client.query("commit");
        return;
      }
      let agentRunId;
      try {
        agentRunId = await createAgentRun(client, step, routed, artifactId, releaseEnvironment(options.environment));
      } catch (error) {
        const reason = qualityGovernanceUnavailableReason(error);
        if (!reason) throw error;
        if (routeCandidate.state === "half_open") {
          await releaseHalfOpenProbe(client, {
            ...routed,
            halfOpenProbeEntryId: routeCandidate.entryId,
            halfOpenProbeOwner: probeOwner,
          });
        }
        if (!await settleSmartCandidateUnavailable(client, step, context, reason)) {
          await failQualityStep(client, step, "CANVAS_RUN_QUALITY_GOVERNANCE_UNAVAILABLE");
        }
        await client.query("commit");
        return;
      }
      const actionId = await appendAgentAction(client, step.owner_id, agentRunId, routeCandidate, artifactId, routed.videoInputMode);
      await recordRouteDecision(client, step, routed, routeCandidate, agentRunId, artifactId);
      const taskId = `task-${randomUUID()}`;
      const messages = qualityMessages(context.mediaKind, context.goal, artifactId, prepared, samples.map((sample) => sample.timestampMs), routed.videoInputMode, Boolean(context.smartCandidateSelector));
      const nativeVideo = context.mediaKind === "video" && routed.videoInputMode === "native_video"
        ? { artifactId, fileUrl: artifact.file_url, mimeType: artifact.mime || "video/mp4" }
        : undefined;
      await client.query(
        `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, payload, result, logs, created_at, updated_at)
         values ($1,$2,$3,'queued',$4,$5,$6::jsonb,'{}'::jsonb,$7::jsonb,now(),now())`,
        [taskId, step.owner_id, `Canvas Run Quality · ${context.mediaKind} · ${artifactId}`, routeCandidate.providerId,
          routeCandidate.modelId, JSON.stringify({ messages, nativeVideo, maxTokens: 4_000, temperature: 0, taskCapability: "chat", executionMode: "worker_queue", canvasRunId: step.run_id, canvasRunStepId: step.id, qualityArtifactId: artifactId, qualityInputMode: routed.videoInputMode || "image" }),
          JSON.stringify(["Canvas Run Quality Worker created evaluation task"])],
      );
      const nextContext = {
        ...routed,
        profile,
        sampledTimestampsMs: shouldPrepareFrames ? samples.map((sample) => sample.timestampMs) : [],
        agentRunId,
        agentActionId: actionId,
        halfOpenProbeEntryId: routeCandidate.state === "half_open" ? routeCandidate.entryId : undefined,
        halfOpenProbeOwner: routeCandidate.state === "half_open" ? probeOwner : undefined,
      };
      await client.query(
        `update xh_canvas_run_steps set quality_task_id = $2, quality_dispatch_enqueued_at = null,
          quality_context = $3::jsonb, updated_at = now() where id = $1`,
        [step.id, taskId, JSON.stringify(nextContext)],
      );
      await appendEvent(client, step.run_id, step.id, "canvas_run.quality_evaluation_dispatched", {
        artifactId,
        taskId,
        role: context.mediaKind === "image" ? "image_understanding" : "video_understanding",
        routeEntryId: routeCandidate.entryId,
        inputMode: routed.videoInputMode || "image",
        sampleCount: prepared.length,
      });
      await client.query("commit");
      dispatch = { stepId: step.id, taskId };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (dispatch) {
      await options.redis.lPush(taskQueueNameForCapability(options.queueName, "chat"), dispatch.taskId);
      await options.pool.query(
        `update xh_canvas_run_steps set quality_dispatch_enqueued_at = now(), updated_at = now()
         where id = $1 and quality_task_id = $2`,
        [dispatch.stepId, dispatch.taskId],
      );
    }
  }

  return { run, stop, tick };
}

async function routeQualityCandidates(
  client: PoolClient,
  step: QualityStepRow,
  context: QualityContext,
  artifactId: string,
  environment: "gray" | "production",
  hasSampledFrames: boolean,
): Promise<QualityContext> {
  const role = context.mediaKind === "image" ? "image_understanding" : "video_understanding";
  const result = await client.query(
    `select p.id as pool_id, pv.id as pool_version_id, pv.policy_snapshot,
      e.id as entry_id, e.provider_id, e.model_id, e.model_capability_snapshot, e.capability_tags_snapshot,
      e.model_input_capabilities_snapshot, e.media_input_transports_snapshot,
      e.priority, e.weight, e.estimated_cost::text, coalesce(h.state, 'healthy') as health_state, h.circuit_opened_at,
      coalesce(h.p95_latency_ms, 0) as p95_latency_ms
     from xh_llm_route_pools p
     join xh_llm_route_pool_versions pv on pv.pool_id = p.id and pv.status = 'approved'
     join xh_llm_route_pool_publications pub on pub.pool_version_id = pv.id and pub.environment = $3 and pub.retired_at is null
     join xh_llm_route_entries e on e.pool_version_id = pv.id and e.enabled = true
     join xh_models m on m.id = e.model_id and m.enabled = true and m.capability = 'chat'
     join xh_providers pr on pr.id = e.provider_id and pr.enabled = true
     left join xh_llm_route_entry_health h on h.route_entry_id = e.id
     where p.role = $1 and p.scenario = $2 and p.enabled = true
     order by pv.version desc, e.priority asc, e.id asc`,
    [role, QUALITY_SCENARIO, environment],
  );
  if (!result.rows[0]) throw new Error(`LLM_ROUTE_POOL_NOT_PUBLISHED:${role}:${QUALITY_SCENARIO}`);
  const poolVersionId = text(result.rows[0].pool_version_id);
  const routePolicy = object(result.rows[0].policy_snapshot);
  const candidates: LlmRouteCandidate[] = result.rows.filter((row) => text(row.pool_version_id) === poolVersionId).map((row) => ({
    entryId: text(row.entry_id),
    providerId: text(row.provider_id),
    modelId: text(row.model_id),
    capability: text(row.model_capability_snapshot),
    capabilityTags: strings(row.capability_tags_snapshot),
    inputCapabilities: object(row.model_input_capabilities_snapshot),
    mediaInputTransports: strings(row.media_input_transports_snapshot),
    priority: Number(row.priority),
    weight: Number(row.weight),
    state: effectiveRouteState(row, routePolicy),
    estimatedCost: Number(row.estimated_cost || 0),
    p95LatencyMs: Number(row.p95_latency_ms || 0),
  }));
  const videoRoute = context.mediaKind === "video" ? routeVideoUnderstandingCandidates({
    scenario: QUALITY_SCENARIO,
    decisionKey: `${step.id}:quality:${artifactId}`,
    candidates,
    hasSampledFrames,
  }) : undefined;
  const decision = videoRoute?.decision || routeLlmCandidates({
    role,
    scenario: QUALITY_SCENARIO,
    requiredCapabilityTags: [role],
    decisionKey: `${step.id}:quality:${artifactId}`,
    candidates,
  });
  return {
    ...context,
    routeArtifactId: artifactId,
    routeCandidates: candidates,
    routeOrderedEntryIds: decision.orderedEntryIds,
    routeRejected: decision.rejected,
    routeReason: decision.reason,
    routeIndex: 0,
    videoInputMode: videoRoute?.mode,
    fallbackRouteOrderedEntryIds: videoRoute?.fallbackDecision?.orderedEntryIds,
    fallbackRouteRejected: videoRoute?.fallbackDecision?.rejected,
    fallbackRouteReason: videoRoute?.fallbackDecision?.reason,
  };
}

async function createAgentRun(client: PoolClient, step: QualityStepRow, context: QualityContext, artifactId: string, environment: "gray" | "production") {
  const role = context.mediaKind === "image" ? "image_understanding" : "video_understanding";
  const agentKey = context.mediaKind === "image" ? "artifact-image-understanding" : "artifact-video-understanding";
  const definition = await client.query(
    `select d.id as definition_id, cv.id as configuration_version_id
     from xh_agent_definitions d
     join xh_agent_configuration_versions cv on cv.agent_definition_id = d.id and cv.status = 'approved'
     join xh_agent_configuration_publications cp on cp.configuration_version_id = cv.id and cp.environment = $3 and cp.retired_at is null
     where d.agent_key = $1 and d.role = $2 and d.enabled = true order by cv.version desc limit 1`,
    [agentKey, role, environment],
  );
  if (!definition.rows[0]) throw new Error(`AGENT_CONFIGURATION_UNAVAILABLE:${agentKey}:${environment}`);
  const inputMode = context.videoInputMode || "image";
  const idempotencyKey = `${step.id}:quality:${artifactId}:input:${inputMode}:route:${context.routeIndex || 0}`;
  const existing = await client.query<{ id: string }>(
    `select id from xh_agent_runs where owner_id = $1 and idempotency_key = $2 limit 1`,
    [step.owner_id, idempotencyKey],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const agentRunId = `agent_run_${randomUUID()}`;
  await client.query(
    `insert into xh_agent_runs
      (id, owner_id, canvas_run_id, agent_definition_id, configuration_version_id, role, scenario, status,
       input_snapshot, budget_snapshot, idempotency_key, started_at)
     values ($1,$2,$3,$4,$5,$6,$7,'running',$8::jsonb,$9::jsonb,$10,now())`,
    [agentRunId, step.owner_id, step.run_id, definition.rows[0].definition_id, definition.rows[0].configuration_version_id,
      role, QUALITY_SCENARIO, JSON.stringify({ artifactId, mediaKind: context.mediaKind, inputMode, profileKey: context.profileKey }),
      JSON.stringify({ maxTokens: 4_000, timeoutMs: 120_000 }), idempotencyKey],
  );
  return agentRunId;
}

async function appendAgentAction(client: PoolClient, ownerId: string, agentRunId: string, candidate: LlmRouteCandidate, artifactId: string, inputMode?: QualityContext["videoInputMode"]) {
  const sequence = await client.query<{ action_sequence: number }>(
    `update xh_agent_runs set action_sequence = action_sequence + 1, updated_at = now()
     where id = $1 and owner_id = $2 returning action_sequence`,
    [agentRunId, ownerId],
  );
  const actionId = `agent_action_${randomUUID()}`;
  await client.query(
    `insert into xh_agent_actions
      (id, owner_id, agent_run_id, sequence, action_type, tool_name, status, input_snapshot)
     values ($1,$2,$3,$4,'llm.invoke','llm.invoke','running',$5::jsonb)`,
    [actionId, ownerId, agentRunId, Number(sequence.rows[0]?.action_sequence || 1), JSON.stringify({ artifactId, inputMode: inputMode || "image", entryId: candidate.entryId, providerId: candidate.providerId, modelRecordId: candidate.modelId })],
  );
  return actionId;
}

async function completeAgentAttempt(client: PoolClient, context: QualityContext, succeeded: boolean, snapshot: Record<string, unknown>) {
  if (context.agentActionId) {
    await client.query(
      `update xh_agent_actions set status = $2, output_snapshot = case when $2 = 'succeeded' then $3::jsonb else output_snapshot end,
        error = case when $2 = 'failed' then $3::jsonb else error end, finalized_at = now() where id = $1`,
      [context.agentActionId, succeeded ? "succeeded" : "failed", JSON.stringify(snapshot)],
    );
  }
  if (context.agentRunId) {
    await client.query(
      `update xh_agent_runs set status = $2, output_snapshot = case when $2 = 'succeeded' then $3::jsonb else output_snapshot end,
        error = case when $2 = 'failed' then $3::jsonb else error end, finalized_at = now(), updated_at = now() where id = $1`,
      [context.agentRunId, succeeded ? "succeeded" : "failed", JSON.stringify(snapshot)],
    );
  }
}

async function recordRouteDecision(client: PoolClient, step: QualityStepRow, context: QualityContext, candidate: LlmRouteCandidate, agentRunId: string, artifactId: string) {
  const pool = await client.query<{ pool_id: string; pool_version_id: string }>(
    `select p.id as pool_id, pv.id as pool_version_id from xh_llm_route_entries e
     join xh_llm_route_pool_versions pv on pv.id = e.pool_version_id join xh_llm_route_pools p on p.id = pv.pool_id
     where e.id = $1 limit 1`,
    [candidate.entryId],
  );
  if (!pool.rows[0]) throw new Error("LLM_ROUTE_SELECTED_ENTRY_MISSING");
  await client.query(
    `insert into xh_llm_route_decisions
      (id, owner_id, agent_run_id, pool_id, pool_version_id, role, scenario, decision_key, selected_entry_id,
       selected_provider_id, selected_model_id, candidate_snapshot, rejection_snapshot, reason)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
     on conflict (owner_id, decision_key) do nothing`,
    [`llm_route_decision_${randomUUID()}`, step.owner_id, agentRunId, pool.rows[0].pool_id, pool.rows[0].pool_version_id,
      context.mediaKind === "image" ? "image_understanding" : "video_understanding", QUALITY_SCENARIO,
      `${step.id}:quality:${artifactId}:input:${context.videoInputMode || "image"}:route:${context.routeIndex || 0}`, candidate.entryId, candidate.providerId, candidate.modelId,
      JSON.stringify(context.routeCandidates || []), JSON.stringify(context.routeRejected || []), `${context.routeReason || "quality route"}; invocation=${candidate.entryId}`],
  );
}

async function recordRouteOutcome(client: PoolClient, entryId: string, outcome: "success" | "technical_failure") {
  if (!entryId) return;
  const current = await client.query<{ state: LlmRouteEntryState; consecutive_technical_failures: number }>(
    `select state, consecutive_technical_failures from xh_llm_route_entry_health where route_entry_id = $1 for update`,
    [entryId],
  );
  const state = nextLlmRouteState({
    current: current.rows[0]?.state || "healthy",
    outcome,
    consecutiveTechnicalFailures: Number(current.rows[0]?.consecutive_technical_failures || 0),
    failureThreshold: 3,
  });
  await client.query(
    `insert into xh_llm_route_entry_health
      (route_entry_id, state, consecutive_technical_failures, success_count, technical_failure_count, updated_at,
       last_success_at, last_failure_at, circuit_opened_at)
     values ($1,$2,$3::integer,$4::bigint,$5::bigint,now(),case when $4::bigint=1 then now() end,case when $5::bigint=1 then now() end,case when $2='circuit_open' then now() end)
     on conflict (route_entry_id) do update set state = excluded.state,
       consecutive_technical_failures = case when $4::bigint=1 then 0 else xh_llm_route_entry_health.consecutive_technical_failures + 1 end,
       success_count = xh_llm_route_entry_health.success_count + $4::bigint,
       technical_failure_count = xh_llm_route_entry_health.technical_failure_count + $5::bigint,
       last_success_at = case when $4::bigint=1 then now() else xh_llm_route_entry_health.last_success_at end,
       last_failure_at = case when $5::bigint=1 then now() else xh_llm_route_entry_health.last_failure_at end,
       circuit_opened_at = case when excluded.state='circuit_open' then coalesce(xh_llm_route_entry_health.circuit_opened_at,now()) else null end,
       updated_at = now()`,
    [entryId, state, outcome === "success" ? 0 : Number(current.rows[0]?.consecutive_technical_failures || 0) + 1,
      outcome === "success" ? 1 : 0, outcome === "technical_failure" ? 1 : 0],
  );
}

async function claimHalfOpenProbe(client: PoolClient, entryId: string, leaseOwner: string, leaseMs: number) {
  const result = await client.query(
    `insert into xh_llm_route_entry_probe_leases (route_entry_id, lease_owner, lease_expires_at, updated_at)
     values ($1,$2,now() + ($3::bigint * interval '1 millisecond'),now())
     on conflict (route_entry_id) do update set lease_owner=excluded.lease_owner,
       lease_expires_at=excluded.lease_expires_at, updated_at=now()
     where xh_llm_route_entry_probe_leases.lease_expires_at < now()
        or xh_llm_route_entry_probe_leases.lease_owner=excluded.lease_owner
     returning route_entry_id`,
    [entryId, leaseOwner, Math.max(5_000, Math.min(1_800_000, Math.floor(leaseMs)))],
  );
  return Boolean(result.rows[0]);
}

async function releaseHalfOpenProbe(client: PoolClient, context: QualityContext) {
  if (!context.halfOpenProbeEntryId || !context.halfOpenProbeOwner) return;
  await client.query(
    "delete from xh_llm_route_entry_probe_leases where route_entry_id=$1 and lease_owner=$2",
    [context.halfOpenProbeEntryId, context.halfOpenProbeOwner],
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
