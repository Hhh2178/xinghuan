import { randomUUID } from "node:crypto";
import type { ArtifactEvaluationResult, ArtifactMediaKind, ArtifactQualityProfile, ArtifactCandidateSelection } from "@xinghuan/agent-core";
import type { Pool, PoolClient } from "pg";

export interface QualityArtifactRecord {
  id: string;
  ownerId: string;
  kind: ArtifactMediaKind;
  fileUrl: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
}

export function createArtifactQualityRepository(deps: { getPostgresPool: () => Promise<Pool>; newId?: (prefix: string) => string }) {
  const newId = deps.newId || ((prefix: string) => `${prefix}_${randomUUID()}`);

  async function readOwnedArtifact(ownerId: string, artifactId: string): Promise<QualityArtifactRecord | null> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, owner_id, kind, file_url, source_url, metadata from xh_generation_artifacts
        where id = $1 and owner_id = $2 and status in ('active', 'promoted') limit 1`,
      [artifactId, ownerId],
    );
    const row = result.rows[0];
    return row ? { id: String(row.id), ownerId: String(row.owner_id), kind: row.kind, fileUrl: String(row.file_url), sourceUrl: row.source_url ? String(row.source_url) : null, metadata: objectValue(row.metadata) } : null;
  }

  async function readPublishedProfile(mediaKind: ArtifactMediaKind, environment: "gray" | "production"): Promise<ArtifactQualityProfile & { databaseId: string } | null> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select id, profile_key, version, media_kind, minimum_overall_score::text, minimum_confidence::text, weights
       from xh_artifact_quality_profiles p
       join xh_artifact_quality_profile_publications pub on pub.quality_profile_id = p.id and pub.environment = $2 and pub.retired_at is null
       where p.media_kind = $1 and p.status = 'approved'
       order by version desc limit 1`,
      [mediaKind, environment],
    );
    const row = result.rows[0];
    return row ? { databaseId: String(row.id), id: String(row.profile_key), version: Number(row.version), mediaKind: row.media_kind, minimumOverallScore: Number(row.minimum_overall_score), minimumConfidence: Number(row.minimum_confidence), weights: objectValue(row.weights) as Record<string, number> } : null;
  }

  async function readOwnedEvaluations(ownerId: string, evaluationIds: string[]) {
    const ids = [...new Set(evaluationIds)].slice(0, 100);
    if (ids.length === 0) return [];
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `select e.id as evaluation_id, e.artifact_id, e.overall_score::text, e.confidence::text,
        extract(epoch from a.created_at) * 1000 as artifact_created_at_ms
       from xh_artifact_evaluations e join xh_generation_artifacts a on a.id = e.artifact_id and a.owner_id = e.owner_id
       where e.owner_id = $1 and e.id = any($2::text[])`,
      [ownerId, ids],
    );
    return result.rows.map((row) => ({ evaluationId: String(row.evaluation_id), artifactId: String(row.artifact_id), overallScore: Number(row.overall_score), confidence: Number(row.confidence), createdAt: Number(row.artifact_created_at_ms) }));
  }

  async function recordEvaluation(input: {
    ownerId: string;
    artifact: QualityArtifactRecord;
    canvasRunId?: string;
    runStepId?: string;
    agentRunId?: string;
    profileDatabaseId: string;
    evaluation: ArtifactEvaluationResult;
    evaluatorEntryId?: string;
    evaluatorProviderId?: string;
    evaluatorModelId?: string;
    sampleSnapshot: Record<string, unknown>;
    idempotencyKey: string;
  }) {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      `insert into xh_artifact_evaluations
        (id, owner_id, artifact_id, canvas_run_id, run_step_id, agent_run_id, quality_profile_id, media_kind,
         evaluator_entry_id, evaluator_provider_id_snapshot, evaluator_model_id_snapshot, score_snapshot,
         evidence_snapshot, defect_snapshot, sample_snapshot, overall_score, confidence, passed, idempotency_key)
       select $1, $2, a.id, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18, $19
       from xh_generation_artifacts a where a.id = $3 and a.owner_id = $2
       on conflict (owner_id, idempotency_key) do nothing returning id`,
      [newId("artifact_evaluation"), input.ownerId, input.artifact.id, input.canvasRunId || null, input.runStepId || null, input.agentRunId || null,
        input.profileDatabaseId, input.evaluation.mediaKind, input.evaluatorEntryId || null, input.evaluatorProviderId || null, input.evaluatorModelId || null,
        JSON.stringify(scoreSnapshot(input.evaluation)), JSON.stringify(input.evaluation.evidence), JSON.stringify(input.evaluation.defects), JSON.stringify(input.sampleSnapshot),
        input.evaluation.overallScore, input.evaluation.confidence, input.evaluation.passed, input.idempotencyKey],
    );
    if (result.rows[0]) return String(result.rows[0].id);
    const replay = await pool.query(`select id, artifact_id from xh_artifact_evaluations where owner_id = $1 and idempotency_key = $2 limit 1`, [input.ownerId, input.idempotencyKey]);
    if (!replay.rows[0] || replay.rows[0].artifact_id !== input.artifact.id) throw new Error("ARTIFACT_EVALUATION_IDEMPOTENCY_CONFLICT");
    return String(replay.rows[0].id);
  }

  async function recordSelection(input: {
    ownerId: string;
    canvasRunId: string;
    runStepId: string;
    bindingKey: string;
    sourceArtifactIds: string[];
    evaluationIds: string[];
    selection: ArtifactCandidateSelection;
    evaluatorVersion: string;
  }) {
    const pool = await deps.getPostgresPool();
    return withTransaction(pool, async (client) => {
      const uniqueArtifactIds = [...new Set(input.sourceArtifactIds)];
      const ownership = await client.query(
        `select count(*)::int as total from xh_generation_artifacts where owner_id = $1 and id = any($2::text[])`,
        [input.ownerId, uniqueArtifactIds],
      );
      if (Number(ownership.rows[0]?.total || 0) !== uniqueArtifactIds.length) throw new Error("ARTIFACT_SELECTION_SOURCE_NOT_OWNED");
      const selectionId = newId("artifact_selection");
      const result = await client.query(
        `insert into xh_artifact_selections
          (id, owner_id, canvas_run_id, run_step_id, binding_key, policy, source_artifact_ids, selected_artifact_ids,
           rejected_artifact_ids, evaluation_ids, reason, confidence, evaluator_version, binding_snapshot)
         select $1, $2, r.id, s.id, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb
         from xh_canvas_runs r join xh_canvas_run_steps s on s.run_id = r.id
         where r.id = $3 and r.owner_id = $2 and s.id = $4
         on conflict (run_step_id, binding_key) do nothing returning id`,
        [selectionId, input.ownerId, input.canvasRunId, input.runStepId, input.bindingKey, input.selection.policy,
          JSON.stringify(input.sourceArtifactIds), JSON.stringify(input.selection.selectedArtifactIds), JSON.stringify(input.selection.rejectedArtifactIds), JSON.stringify(input.evaluationIds),
          input.selection.reason, input.selection.confidence, input.evaluatorVersion, JSON.stringify({ executionMode: input.selection.executionMode })],
      );
      let effectiveId = result.rows[0] ? String(result.rows[0].id) : "";
      if (!effectiveId) {
        const replay = await client.query(
          `select id, selected_artifact_ids from xh_artifact_selections where run_step_id = $1 and binding_key = $2 limit 1`,
          [input.runStepId, input.bindingKey],
        );
        if (!replay.rows[0] || JSON.stringify(replay.rows[0].selected_artifact_ids) !== JSON.stringify(input.selection.selectedArtifactIds)) throw new Error("ARTIFACT_SELECTION_IDEMPOTENCY_CONFLICT");
        effectiveId = String(replay.rows[0].id);
      }
      const binding = {
        selectionId: effectiveId,
        policy: input.selection.policy,
        executionMode: input.selection.executionMode,
        sourceArtifactIds: input.sourceArtifactIds,
        selectedArtifactIds: input.selection.selectedArtifactIds,
        rejectedArtifactIds: input.selection.rejectedArtifactIds,
      };
      const updated = await client.query(
        `update xh_canvas_run_steps s set input_binding = jsonb_set(s.input_binding, $4::text[], $5::jsonb, true), updated_at = now()
         from xh_canvas_runs r where s.id = $1 and s.run_id = $2 and r.id = s.run_id and r.owner_id = $3 returning s.id`,
        [input.runStepId, input.canvasRunId, input.ownerId, [input.bindingKey], JSON.stringify(binding)],
      );
      if (!updated.rows[0]) throw new Error("ARTIFACT_SELECTION_STEP_NOT_OWNED");
      return effectiveId;
    });
  }

  return { readOwnedArtifact, readOwnedEvaluations, readPublishedProfile, recordEvaluation, recordSelection };
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

function scoreSnapshot(evaluation: ArtifactEvaluationResult) {
  const excluded = new Set(["artifactId", "mediaKind", "defects", "evidence", "sampledTimestampsMs", "confidence", "overallScore", "passed", "profileId", "profileVersion"]);
  return Object.fromEntries(Object.entries(evaluation).filter(([key, value]) => !excluded.has(key) && typeof value === "number"));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
