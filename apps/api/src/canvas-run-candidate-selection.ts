import { randomUUID } from "node:crypto";

import {
  resolveSmartCandidateSelection,
  type SmartCandidate,
} from "@xinghuan/agent-core";
import type { Pool, PoolClient } from "pg";

export interface PendingCanvasRunCandidateSelection {
  runId: string;
  stepId: string;
  nodeId: string;
  mediaKind: "image" | "video";
  maximum: number;
  criteria: string;
  note: string;
  candidates: SmartCandidate[];
}

export function createCanvasRunCandidateSelectionService(deps: {
  getPostgresPool: () => Promise<Pool>;
  newId?: (prefix: string) => string;
}) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readPending(input: { ownerId: string; runId: string }) {
    const pool = await deps.getPostgresPool();
    const run = await pool.query<{ id: string }>(
      `select id from xh_canvas_runs where id = $1 and owner_id = $2 limit 1`,
      [input.runId, input.ownerId],
    );
    if (!run.rows[0]) throw new Error("CANVAS_RUN_NOT_FOUND");
    const result = await pool.query<{
      id: string;
      run_id: string;
      node_id: string;
      candidate_context: unknown;
    }>(
      `select s.id, s.run_id, s.node_id, s.candidate_context
       from xh_canvas_run_steps s
       where s.run_id = $1 and s.node_type = 'smart-candidate-selector' and s.status = 'selecting'
       order by s.sequence asc, s.id asc`,
      [input.runId],
    );
    return result.rows.map(projectPendingSelection);
  }

  async function selectManual(input: {
    ownerId: string;
    runId: string;
    stepId: string;
    selectedArtifactIds: string[];
    idempotencyKey: string;
  }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const locked = await client.query<{
        id: string;
        run_id: string;
        step_key: string;
        node_id: string;
        status: string;
        output_binding: unknown;
        candidate_context: unknown;
      }>(
        `select s.id, s.run_id, s.step_key, s.node_id, s.status, s.output_binding, s.candidate_context
         from xh_canvas_run_steps s
         join xh_canvas_runs r on r.id = s.run_id
         where r.id = $1 and r.owner_id = $2 and s.id = $3 and s.node_type = 'smart-candidate-selector'
         for update of r, s`,
        [input.runId, input.ownerId, input.stepId],
      );
      const step = locked.rows[0];
      if (!step) throw new Error("SMART_CANDIDATE_SELECTION_NOT_FOUND");

      const requestedArtifactIds = uniqueTexts(input.selectedArtifactIds);
      const replay = await client.query<{
        id: string;
        canvas_run_id: string;
        run_step_id: string;
        selected_artifact_ids: unknown;
        rejected_artifact_ids: unknown;
      }>(
        `select id, canvas_run_id, run_step_id, selected_artifact_ids, rejected_artifact_ids
         from xh_artifact_selections where owner_id = $1 and idempotency_key = $2 limit 1`,
        [input.ownerId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        const replaySelectedArtifactIds = textArray(replay.rows[0].selected_artifact_ids);
        if (replay.rows[0].canvas_run_id !== input.runId
          || replay.rows[0].run_step_id !== input.stepId
          || !sameIds(replaySelectedArtifactIds, requestedArtifactIds)) {
          throw new Error("SMART_CANDIDATE_SELECTION_IDEMPOTENCY_CONFLICT");
        }
        return {
          runId: input.runId,
          stepId: input.stepId,
          selectionId: replay.rows[0].id,
          selectedArtifactIds: replaySelectedArtifactIds,
          notSelectedArtifactIds: textArray(replay.rows[0].rejected_artifact_ids),
        };
      }
      if (step.status !== "selecting") throw new Error(`SMART_CANDIDATE_SELECTION_INVALID_TRANSITION:${step.status}`);

      const context = normalizeContext(step.candidate_context);
      const selection = resolveSmartCandidateSelection({
        mode: "manual",
        maximum: context.maximum,
        minimumConfidence: context.minimumConfidence,
        lowConfidencePolicy: context.lowConfidencePolicy,
        candidates: context.candidates,
        evaluations: [],
        manualSelectedArtifactIds: requestedArtifactIds,
      });
      if (selection.state !== "selected") throw new Error("SMART_CANDIDATE_MANUAL_SELECTION_REQUIRED");

      const ledger = await client.query<{ artifact_id: string }>(
        `select artifact_id from xh_canvas_run_candidate_artifacts
         where canvas_run_id = $1 and run_step_id = $2
         order by created_at asc, artifact_id asc
         for update`,
        [input.runId, input.stepId],
      );
      const ledgerIds = ledger.rows.map((row) => row.artifact_id);
      if (!sameIds(ledgerIds, selection.candidateArtifactIds)) {
        throw new Error("SMART_CANDIDATE_LEDGER_MISMATCH");
      }

      const selectionId = newId("artifact_selection");
      const bindingKey = `smart-candidate:${step.step_key}`;
      await client.query(
        `insert into xh_artifact_selections
          (id, owner_id, canvas_run_id, run_step_id, binding_key, policy,
           source_artifact_ids, selected_artifact_ids, rejected_artifact_ids, evaluation_ids,
           reason, confidence, evaluator_version, binding_snapshot, selection_mode,
           criteria_snapshot, note_snapshot, candidate_snapshot, score_snapshot,
           overridden_by_user_id, selected_at, idempotency_key)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'[]'::jsonb,
           $10,null,'manual-user-v1',$11::jsonb,'manual',$12::jsonb,$13,$14::jsonb,'[]'::jsonb,$2,now(),$15)`,
        [
          selectionId,
          input.ownerId,
          input.runId,
          input.stepId,
          bindingKey,
          selection.selectedArtifactIds.length === 1 ? "single" : "many",
          JSON.stringify(selection.candidateArtifactIds),
          JSON.stringify(selection.selectedArtifactIds),
          JSON.stringify(selection.rejectedArtifactIds),
          selection.reason,
          JSON.stringify({ executionMode: "manual", nodeId: step.node_id }),
          JSON.stringify({ text: context.criteria }),
          context.note,
          JSON.stringify(context.candidates),
          input.idempotencyKey,
        ],
      );

      const selectedSet = new Set(selection.selectedArtifactIds);
      for (const artifactId of selection.candidateArtifactIds) {
        await client.query(
          `update xh_canvas_run_candidate_artifacts
           set selection_status = $3, updated_at = now()
           where run_step_id = $1 and artifact_id = $2`,
          [input.stepId, artifactId, selectedSet.has(artifactId) ? "selected" : "not_selected"],
        );
      }

      const selectedCandidates = context.candidates.filter((candidate) => selectedSet.has(candidate.artifactId));
      const output = {
        ...record(step.output_binding),
        generationArtifactIds: selection.selectedArtifactIds,
        imageUrls: context.mediaKind === "image" ? selectedCandidates.map((candidate) => candidate.fileUrl) : [],
        videoUrls: context.mediaKind === "video" ? selectedCandidates.map((candidate) => candidate.fileUrl) : [],
        selectedCandidates,
        qualitySelection: {
          selectionId,
          policy: selection.selectedArtifactIds.length === 1 ? "single" : "many",
          selectedArtifactIds: selection.selectedArtifactIds,
          rejectedArtifactIds: selection.rejectedArtifactIds,
          reason: selection.reason,
          confidence: null,
        },
      };
      await client.query(
        `update xh_canvas_run_steps
         set status = 'succeeded', output_binding = $2::jsonb, updated_at = now(), finalized_at = now()
         where id = $1`,
        [input.stepId, JSON.stringify(output)],
      );

      const skipped = await client.query<{ id: string }>(
        `update xh_canvas_run_steps set status = 'skipped',
          error = '{"code":"skipped_by_selection"}'::jsonb, finalized_at = now(), updated_at = now()
         where run_id = $1 and status in ('blocked', 'ready')
           and input_binding->>'candidateArtifactId' = any($2::text[])
         returning id`,
        [input.runId, selection.rejectedArtifactIds],
      );
      for (const skippedStep of skipped.rows) {
        await appendEvent(client, input.runId, skippedStep.id, "canvas_run.step_skipped_by_selection", {
          selectorStepId: input.stepId,
          rejectedArtifactIds: selection.rejectedArtifactIds,
        });
      }
      await appendEvent(client, input.runId, input.stepId, "canvas_run.candidate_selection_manual_override", {
        selectionId,
        selectedArtifactIds: selection.selectedArtifactIds,
        notSelectedArtifactIds: selection.rejectedArtifactIds,
        overriddenByUserId: input.ownerId,
      });
      await appendEvent(client, input.runId, input.stepId, "canvas_run.candidate_selection_completed", {
        selectionId,
        selectedArtifactIds: selection.selectedArtifactIds,
        notSelectedArtifactIds: selection.rejectedArtifactIds,
        reason: selection.reason,
        confidence: null,
        selectionMode: "manual",
      });
      await appendEvent(client, input.runId, input.stepId, "canvas_run.step_succeeded", {
        candidateSelectionId: selectionId,
      });
      await unlockDependents(client, input.runId);
      await finalizeRunIfComplete(client, input.runId);
      return {
        runId: input.runId,
        stepId: input.stepId,
        selectionId,
        selectedArtifactIds: selection.selectedArtifactIds,
        notSelectedArtifactIds: selection.rejectedArtifactIds,
      };
    });
  }

  return { readPending, selectManual };
}

export function projectPendingSelection(row: {
  id: string;
  run_id: string;
  node_id: string;
  candidate_context: unknown;
}): PendingCanvasRunCandidateSelection {
  const context = normalizeContext(row.candidate_context);
  return {
    runId: row.run_id,
    stepId: row.id,
    nodeId: row.node_id,
    mediaKind: context.mediaKind,
    maximum: context.maximum,
    criteria: context.criteria,
    note: context.note,
    candidates: context.candidates,
  };
}

function normalizeContext(value: unknown) {
  const context = record(value);
  const candidates = Array.isArray(context.candidates) ? context.candidates.map((value) => {
    const candidate = record(value);
    return {
      artifactId: text(candidate.artifactId),
      mediaKind: candidate.mediaKind === "video" ? "video" as const : "image" as const,
      fileUrl: text(candidate.fileUrl),
      sourceNodeId: text(candidate.sourceNodeId),
      prompt: text(candidate.prompt),
      variableSnapshot: record(candidate.variableSnapshot),
      providerId: text(candidate.providerId),
      modelRecordId: text(candidate.modelRecordId),
      createdAt: Number(candidate.createdAt),
    };
  }) : [];
  return {
    mediaKind: context.mediaKind === "video" ? "video" as const : "image" as const,
    maximum: Math.max(1, Math.min(8, Math.floor(Number(context.maximum) || 1))),
    minimumConfidence: Math.max(0, Math.min(1, Number(context.minimumConfidence) || 0)),
    lowConfidencePolicy: context.lowConfidencePolicy === "stop" ? "stop" as const : "request_manual" as const,
    criteria: text(context.criteria),
    note: text(context.note),
    candidates,
  };
}

async function unlockDependents(client: PoolClient, runId: string) {
  await client.query(
    `update xh_canvas_run_steps s set status='ready', updated_at=now()
     where s.run_id=$1 and s.status='blocked' and not exists (
       select 1 from jsonb_array_elements_text(s.depends_on) dep
       left join xh_canvas_run_steps d on d.run_id=s.run_id and d.node_id=dep
       where d.id is null or d.status not in ('succeeded','skipped')
     )`,
    [runId],
  );
}

async function finalizeRunIfComplete(client: PoolClient, runId: string) {
  const result = await client.query<{ status: string }>(`select status from xh_canvas_run_steps where run_id=$1`, [runId]);
  if (result.rows.length && result.rows.every((row) => ["succeeded", "skipped"].includes(row.status))) {
    await client.query(`update xh_canvas_runs set status='succeeded', finalized_at=now(), updated_at=now() where id=$1`, [runId]);
    await appendEvent(client, runId, null, "canvas_run.succeeded", {});
  }
}

async function appendEvent(client: PoolClient, runId: string, stepId: string | null, eventType: string, payload: Record<string, unknown>) {
  const sequence = await client.query<{ event_sequence: number }>(
    `update xh_canvas_runs set event_sequence=event_sequence+1, updated_at=now() where id=$1 returning event_sequence`,
    [runId],
  );
  await client.query(
    `insert into xh_canvas_run_events (id,run_id,run_step_id,sequence,event_type,payload) values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [`canvas_run_event_${randomUUID()}`, runId, stepId, Number(sequence.rows[0]?.event_sequence), eventType, JSON.stringify(payload)],
  );
}

async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function uniqueTexts(values: unknown[]) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function textArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
