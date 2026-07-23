import { randomUUID } from "node:crypto";
import {
  routeStateAfterCooldown,
  type ArtifactEvaluationResult,
  type ArtifactMediaKind,
  type ArtifactQualityProfile,
  type LlmRouteCandidate,
  type LlmRouteEntryState,
} from "@xinghuan/agent-core";
import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface QualityArtifactRow extends QueryResultRow {
  id: string;
  kind: ArtifactMediaKind;
  file_url: string;
  mime: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface PublishedQualityProfile extends ArtifactQualityProfile {
  databaseId: string;
}

export interface QualityContext {
  artifactIds: string[];
  mediaKind: ArtifactMediaKind;
  goal: string;
  profileKey: string;
  selectionPolicy: "best" | "top_k" | "threshold" | "diverse";
  selectionMaximum: number;
  selectionMinimumScore: number;
  currentIndex: number;
  evaluations: Array<{
    evaluationId: string;
    artifactId: string;
    fileUrl: string;
    createdAt: number;
    overallScore: number;
    confidence: number;
    technicalValidity?: number;
    promptAlignment?: number;
    visualQuality?: number;
    variableAlignment?: number;
    noteAlignment?: number;
    summary?: string;
  }>;
  smartCandidateSelector?: Record<string, unknown>;
  routeArtifactId?: string;
  routeCandidates?: LlmRouteCandidate[];
  routeOrderedEntryIds?: string[];
  routeRejected?: unknown[];
  routeReason?: string;
  routeIndex?: number;
  videoInputMode?: "native_video" | "sampled_frames";
  fallbackRouteOrderedEntryIds?: string[];
  fallbackRouteRejected?: unknown[];
  fallbackRouteReason?: string;
  agentRunId?: string;
  agentActionId?: string;
  halfOpenProbeEntryId?: string;
  halfOpenProbeOwner?: string;
  profile?: PublishedQualityProfile;
  sampledTimestampsMs?: number[];
}

export async function readOwnedArtifact(client: PoolClient, ownerId: string, artifactId: string, mediaKind: ArtifactMediaKind) {
  const result = await client.query<QualityArtifactRow>(
    `select id, kind, file_url, mime, metadata, created_at from xh_generation_artifacts
     where id = $1 and owner_id = $2 and kind = $3 and status in ('active','promoted') limit 1`,
    [artifactId, ownerId, mediaKind],
  );
  if (!result.rows[0]) throw new Error("ARTIFACT_EVALUATION_ARTIFACT_NOT_FOUND");
  return result.rows[0];
}

export async function readPublishedProfile(client: PoolClient, mediaKind: ArtifactMediaKind, profileKey: string, environment: "gray" | "production") {
  const result = await client.query(
    `select p.id, p.profile_key, p.version, p.media_kind, p.minimum_overall_score::text,
      p.minimum_confidence::text, p.weights
     from xh_artifact_quality_profiles p
     join xh_artifact_quality_profile_publications pub on pub.quality_profile_id = p.id
       and pub.environment = $2 and pub.retired_at is null
     where p.media_kind = $1 and p.status = 'approved' and ($3 = '' or p.profile_key = $3)
     order by p.version desc limit 1`,
    [mediaKind, environment, profileKey],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`ARTIFACT_QUALITY_PROFILE_NOT_PUBLISHED:${mediaKind}:${environment}`);
  return {
    databaseId: text(row.id),
    id: text(row.profile_key),
    version: Number(row.version),
    mediaKind: row.media_kind as ArtifactMediaKind,
    minimumOverallScore: Number(row.minimum_overall_score),
    minimumConfidence: Number(row.minimum_confidence),
    weights: object(row.weights) as Record<string, number>,
  };
}

export function qualitySamples(artifact: QualityArtifactRow) {
  if (artifact.kind === "image") return [{ url: artifact.file_url, timestampMs: 0 }];
  const metadata = object(artifact.metadata);
  const values = Array.isArray(metadata.sampledFrames) ? metadata.sampledFrames : [];
  return values.map(object).flatMap((item) => {
    const url = text(item.url);
    const timestampMs = Number(item.timestampMs);
    return url.startsWith("/files/") && Number.isFinite(timestampMs) && timestampMs >= 0 ? [{ url, timestampMs }] : [];
  }).slice(0, 12);
}

export function qualityMessages(mediaKind: ArtifactMediaKind, goal: string, artifactId: string, dataUrls: string[], timestamps: number[], inputMode?: QualityContext["videoInputMode"], smartCandidate = false) {
  const baseSchema = mediaKind === "image"
    ? { technicalValidity: 0, promptAlignment: 0, composition: 0, visualQuality: 0, defects: [""], evidence: [""], confidence: 0 }
    : { technicalValidity: 0, promptAlignment: 0, composition: 0, visualQuality: 0, temporalCoherence: 0, motionQuality: 0, keyframeConsistency: 0, defects: [""], evidence: [""], confidence: 0 };
  const schema = smartCandidate
    ? { ...baseSchema, variableAlignment: 0, noteAlignment: 0, summary: "" }
    : baseSchema;
  return [{
    role: "user",
    content: [
      { type: "text", text: `Evaluate ${mediaKind} artifact ${artifactId} against this goal: ${goal}. ${inputMode === "native_video" ? "Analyze the complete attached video, including temporal continuity and motion." : "Use the attached timestamped visual evidence."} Scores are 0-100 and confidence is 0-1. Return strict JSON only: ${JSON.stringify(schema)}` },
      ...dataUrls.map((url, index) => ({ type: "image_url", image_url: { url }, timestamp_ms: timestamps[index] || 0 })),
    ],
  }];
}

export async function qualityRuntimeEnabled(pool: Pool, environment: string) {
  if (environment === "local" || environment === "test") return true;
  const result = await pool.query(
    `select canvas_runs_enabled, quality_evaluation_enabled from xh_agent_runtime_controls where environment=$1 limit 1`,
    [environment],
  );
  return result.rows[0]?.canvas_runs_enabled === true && result.rows[0]?.quality_evaluation_enabled === true;
}

export function normalizeContext(value: unknown): QualityContext {
  const row = object(value);
  return {
    artifactIds: strings(row.artifactIds),
    mediaKind: row.mediaKind === "video" ? "video" : "image",
    goal: text(row.goal),
    profileKey: text(row.profileKey),
    selectionPolicy: qualityPolicy(row.selectionPolicy),
    selectionMaximum: boundedInteger(row.selectionMaximum, 1, 16, 1),
    selectionMinimumScore: boundedNumber(row.selectionMinimumScore, 0, 100, 0),
    currentIndex: boundedInteger(row.currentIndex, 0, 100, 0),
    evaluations: Array.isArray(row.evaluations) ? row.evaluations.map(object).flatMap((item) => text(item.artifactId) ? [{
      evaluationId: text(item.evaluationId), artifactId: text(item.artifactId), fileUrl: text(item.fileUrl),
      createdAt: Number(item.createdAt), overallScore: Number(item.overallScore), confidence: Number(item.confidence),
      technicalValidity: Number.isFinite(Number(item.technicalValidity)) ? Number(item.technicalValidity) : undefined,
      promptAlignment: Number.isFinite(Number(item.promptAlignment)) ? Number(item.promptAlignment) : undefined,
      visualQuality: Number.isFinite(Number(item.visualQuality)) ? Number(item.visualQuality) : undefined,
      variableAlignment: Number.isFinite(Number(item.variableAlignment)) ? Number(item.variableAlignment) : undefined,
      noteAlignment: Number.isFinite(Number(item.noteAlignment)) ? Number(item.noteAlignment) : undefined,
      summary: text(item.summary) || undefined,
    }] : []) : [],
    smartCandidateSelector: Object.keys(object(row.smartCandidateSelector)).length ? object(row.smartCandidateSelector) : undefined,
    routeArtifactId: text(row.routeArtifactId) || undefined,
    routeCandidates: Array.isArray(row.routeCandidates) ? row.routeCandidates as LlmRouteCandidate[] : undefined,
    routeOrderedEntryIds: strings(row.routeOrderedEntryIds),
    routeRejected: Array.isArray(row.routeRejected) ? row.routeRejected : undefined,
    routeReason: text(row.routeReason) || undefined,
    routeIndex: Number.isFinite(Number(row.routeIndex)) ? Number(row.routeIndex) : undefined,
    videoInputMode: row.videoInputMode === "native_video" || row.videoInputMode === "sampled_frames" ? row.videoInputMode : undefined,
    fallbackRouteOrderedEntryIds: strings(row.fallbackRouteOrderedEntryIds),
    fallbackRouteRejected: Array.isArray(row.fallbackRouteRejected) ? row.fallbackRouteRejected : undefined,
    fallbackRouteReason: text(row.fallbackRouteReason) || undefined,
    agentRunId: text(row.agentRunId) || undefined,
    agentActionId: text(row.agentActionId) || undefined,
    halfOpenProbeEntryId: text(row.halfOpenProbeEntryId) || undefined,
    halfOpenProbeOwner: text(row.halfOpenProbeOwner) || undefined,
    profile: isProfile(row.profile) ? row.profile : undefined,
    sampledTimestampsMs: Array.isArray(row.sampledTimestampsMs) ? row.sampledTimestampsMs.map(Number).filter(Number.isFinite) : undefined,
  };
}

export function currentRouteEntryId(context: QualityContext) {
  return context.routeOrderedEntryIds?.[context.routeIndex || 0] || "";
}

export function currentRouteCandidate(context: QualityContext) {
  const entryId = currentRouteEntryId(context);
  return context.routeCandidates?.find((candidate) => candidate.entryId === entryId);
}

export function scoreSnapshot(evaluation: ArtifactEvaluationResult) {
  const excluded = new Set(["artifactId", "mediaKind", "defects", "evidence", "sampledTimestampsMs", "confidence", "overallScore", "passed", "profileId", "profileVersion"]);
  return Object.fromEntries(Object.entries(evaluation).filter(([key, value]) => !excluded.has(key) && typeof value === "number"));
}

export function extractJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("ARTIFACT_EVALUATION_OUTPUT_INVALID");
  return trimmed.slice(first, last + 1);
}

export function planSteps(value: unknown) {
  return Array.isArray(object(value).steps) ? object(value).steps as Array<Record<string, unknown>> : [];
}

export function qualityPolicy(value: unknown): QualityContext["selectionPolicy"] {
  const policy = text(value);
  return policy === "top_k" || policy === "threshold" || policy === "diverse" ? policy : "best";
}

export function releaseEnvironment(value: unknown): "gray" | "production" {
  return text(value) === "production" ? "production" : "gray";
}

export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function strings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
}

export function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function effectiveRouteState(row: Record<string, unknown>, policy: Record<string, unknown>): LlmRouteEntryState {
  const current = text(row.health_state || "healthy") as LlmRouteEntryState;
  const openedAt = row.circuit_opened_at ? new Date(String(row.circuit_opened_at)).getTime() : Number.NaN;
  const cooldownMs = boundedInteger(policy.cooldownMs, 1_000, 86_400_000, 60_000);
  return Number.isFinite(openedAt) ? routeStateAfterCooldown({ current, openedAt, now: Date.now(), cooldownMs }) : current;
}

export async function failQualityStep(client: PoolClient, step: { id: string; run_id: string }, code: string) {
  await client.query(
    `update xh_canvas_run_steps set status='failed', error=$2::jsonb, quality_task_id=null,
      quality_dispatch_enqueued_at=null, finalized_at=now(), updated_at=now() where id=$1`,
    [step.id, JSON.stringify({ code })],
  );
  await client.query(`update xh_canvas_runs set status='failed', finalized_at=now(), updated_at=now() where id=$1`, [step.run_id]);
  await appendEvent(client, step.run_id, step.id, "canvas_run.quality_failed", { code });
  await appendEvent(client, step.run_id, null, "canvas_run.failed", { stepId: step.id, code });
}

export async function readQualityBudgetError(client: PoolClient, step: { run_id: string; budget_snapshot: Record<string, unknown>; run_created_at?: Date }) {
  const budget = object(step.budget_snapshot);
  const maxTaskCount = boundedInteger(budget.maxTaskCount, 1, 100_000, 100);
  const tasks = await client.query<{ count: number }>(
    `select count(*)::int as count from xh_tasks where payload->>'canvasRunId' = $1`,
    [step.run_id],
  );
  if (Number(tasks.rows[0]?.count || 0) >= maxTaskCount) return "CANVAS_RUN_MAX_TASK_COUNT";
  const maxDurationSeconds = boundedInteger(budget.maxDurationSeconds, 1, 31_536_000, 3_600);
  const createdAt = step.run_created_at ? new Date(step.run_created_at).getTime() : Date.now();
  if (Date.now() - createdAt >= maxDurationSeconds * 1_000) return "CANVAS_RUN_MAX_DURATION";
  const maxCost = Number(budget.maxCost || 0);
  if (Number.isFinite(maxCost) && maxCost > 0) {
    const currency = /^[A-Z]{3}$/.test(text(budget.currency)) ? text(budget.currency) : "CNY";
    const cost = await client.query<{ amount: string }>(
      `select coalesce(sum(c.amount),0)::text as amount from xh_task_cost_items c
       join xh_tasks t on t.id=c.task_id
       where t.payload->>'canvasRunId'=$1 and c.currency=$2 and c.status='charged'`,
      [step.run_id, currency],
    );
    if (Number(cost.rows[0]?.amount || 0) >= maxCost) return "CANVAS_RUN_MAX_COST";
  }
  return "";
}

export async function unlockDependents(client: PoolClient, runId: string) {
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

export async function finalizeRunIfComplete(client: PoolClient, runId: string) {
  const result = await client.query<{ status: string }>(`select status from xh_canvas_run_steps where run_id=$1`, [runId]);
  if (result.rows.length && result.rows.every((row) => ["succeeded", "skipped"].includes(row.status))) {
    await client.query(`update xh_canvas_runs set status='succeeded', finalized_at=now(), updated_at=now() where id=$1`, [runId]);
    await appendEvent(client, runId, null, "canvas_run.succeeded", {});
  }
}

export async function appendEvent(client: PoolClient, runId: string, stepId: string | null, eventType: string, payload: Record<string, unknown>) {
  const sequence = await client.query<{ event_sequence: number }>(
    `update xh_canvas_runs set event_sequence=event_sequence+1, updated_at=now() where id=$1 returning event_sequence`,
    [runId],
  );
  await client.query(
    `insert into xh_canvas_run_events (id,run_id,run_step_id,sequence,event_type,payload) values ($1,$2,$3,$4,$5,$6::jsonb)`,
    [`canvas_run_event_${randomUUID()}`, runId, stepId, Number(sequence.rows[0]?.event_sequence), eventType, JSON.stringify(payload)],
  );
}

function isProfile(value: unknown): value is PublishedQualityProfile {
  const row = object(value);
  return Boolean(text(row.databaseId) && text(row.id) && (row.mediaKind === "image" || row.mediaKind === "video"));
}
