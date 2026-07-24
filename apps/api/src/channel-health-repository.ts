import type { Pool, QueryResultRow } from "pg";

import type { ChannelFeedbackVote, ChannelHealthCapability } from "@xinghuan/shared";

export interface ChannelHealthCatalogRow {
  providerId: string;
  providerName: string;
  providerEnabled: boolean;
  providerSortOrder: number;
  modelRecordId: string;
  nativeModelId: string;
  displayName: string;
  capability: ChannelHealthCapability;
  modelEnabled: boolean;
  modelSortOrder: number;
}

export interface ChannelHealthSettledBucketRow {
  providerId: string;
  providerName: string;
  modelRecordId: string;
  nativeModelId: string;
  displayName: string;
  capability: ChannelHealthCapability;
  bucketStartAt: number;
  succeeded: number;
  failed: number;
}

export interface ChannelFeedbackAggregateRow {
  providerId: string;
  modelRecordId: string;
  up24h: number;
  down24h: number;
  up72h: number;
  down72h: number;
  latestVoteAt: number | null;
}

export interface ChannelViewerVoteRow {
  providerId: string;
  modelRecordId: string;
  vote: ChannelFeedbackVote;
}

export type ChannelFeedbackWriteResult =
  | { kind: "saved"; vote: ChannelFeedbackVote }
  | { kind: "ineligible" }
  | { kind: "channel_missing" };

export interface ChannelHealthRepository {
  readCatalog(input: { includeDisabled: boolean }): Promise<ChannelHealthCatalogRow[]>;
  readSettledBuckets(input: { from: Date; to: Date }): Promise<ChannelHealthSettledBucketRow[]>;
  readFeedbackAggregates(input: { from24h: Date; from72h: Date }): Promise<ChannelFeedbackAggregateRow[]>;
  readViewerVotes(input: { ownerId: string; from: Date }): Promise<ChannelViewerVoteRow[]>;
  upsertEligibleVote(input: {
    ownerId: string;
    providerId: string;
    modelRecordId: string;
    vote: ChannelFeedbackVote;
    eligibleSince: Date;
  }): Promise<ChannelFeedbackWriteResult>;
}

interface CatalogPostgresRow extends QueryResultRow {
  provider_id: string;
  provider_name: string;
  provider_enabled: boolean;
  provider_sort_order: number;
  model_record_id: string;
  native_model_id: string;
  display_name: string;
  capability: string;
  model_enabled: boolean;
  model_sort_order: number;
}

interface SettledBucketPostgresRow extends QueryResultRow {
  provider_id: string;
  provider_name: string;
  model_record_id: string;
  native_model_id: string;
  display_name: string;
  capability: string;
  bucket_start: unknown;
  succeeded: unknown;
  failed: unknown;
}

interface FeedbackAggregatePostgresRow extends QueryResultRow {
  provider_id: string;
  model_id: string;
  up_24h: unknown;
  down_24h: unknown;
  up_72h: unknown;
  down_72h: unknown;
  latest_vote_at: unknown;
}

interface ViewerVotePostgresRow extends QueryResultRow {
  provider_id: string;
  model_id: string;
  vote: string;
}

interface VoteWritePostgresRow extends QueryResultRow {
  channel_exists: unknown;
  vote: unknown;
}

export function createChannelHealthRepository(deps: {
  getPostgresPool: () => Promise<Pool>;
  newId?: () => string;
}): ChannelHealthRepository {
  const newId = deps.newId || (() => `channel_feedback_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  return {
    readCatalog,
    readSettledBuckets,
    readFeedbackAggregates,
    readViewerVotes,
    upsertEligibleVote,
  };

  async function readCatalog(input: { includeDisabled: boolean }): Promise<ChannelHealthCatalogRow[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<CatalogPostgresRow>(
      `select p.id as provider_id,
              p.name as provider_name,
              p.enabled as provider_enabled,
              p.sort_order as provider_sort_order,
              m.id as model_record_id,
              m.model_id as native_model_id,
              m.display_name,
              m.capability,
              m.enabled as model_enabled,
              m.sort_order as model_sort_order
         from xh_models m
         join xh_providers p on p.id = m.provider_id
        where $1::boolean = true or (p.enabled = true and m.enabled = true)
        order by p.sort_order asc, p.created_at desc, p.id asc,
                 m.capability asc, m.sort_order asc, m.created_at desc, m.id asc`,
      [input.includeDisabled],
    );
    return result.rows.flatMap((row) => {
      const capability = normalizeCapability(row.capability);
      if (!capability) return [];
      return [{
        providerId: row.provider_id,
        providerName: row.provider_name,
        providerEnabled: Boolean(row.provider_enabled),
        providerSortOrder: numberValue(row.provider_sort_order),
        modelRecordId: row.model_record_id,
        nativeModelId: row.native_model_id,
        displayName: row.display_name,
        capability,
        modelEnabled: Boolean(row.model_enabled),
        modelSortOrder: numberValue(row.model_sort_order),
      }];
    });
  }

  async function readSettledBuckets(input: { from: Date; to: Date }): Promise<ChannelHealthSettledBucketRow[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<SettledBucketPostgresRow>(
      `with dimensions as (
         select coalesce(ci.provider_id_snapshot, t.provider_id, m.provider_id) as provider_id,
                coalesce(nullif(ci.provider_name_snapshot, ''), p.name, '') as provider_name,
                coalesce(ci.model_id_snapshot, t.model_id, m.id) as model_record_id,
                coalesce(nullif(ci.model_native_id_snapshot, ''), m.model_id, '') as native_model_id,
                coalesce(nullif(ci.model_name_snapshot, ''), m.display_name, '') as display_name,
                case lower(coalesce(m.capability, t.payload ->> 'taskCapability', t.result ->> 'capability', ''))
                  when 'text' then 'chat'
                  when 'llm' then 'chat'
                  when 'chat' then 'chat'
                  when 'image' then 'image'
                  when 'video' then 'video'
                  when 'audio' then 'audio'
                  else ''
                end as capability,
                date_bin('2 hours', t.created_at, timestamptz '2000-01-01 00:00:00+08') as bucket_start,
                t.status
           from xh_tasks t
           left join xh_task_cost_items ci on ci.task_id = t.id and ci.cost_item_type = 'provider_cost'
           left join xh_models m on m.id = t.model_id
           left join xh_providers p on p.id = coalesce(ci.provider_id_snapshot, t.provider_id, m.provider_id)
          where t.status in ('succeeded', 'failed')
            and t.created_at >= $1
            and t.created_at < $2
       )
       select provider_id,
              provider_name,
              model_record_id,
              native_model_id,
              display_name,
              capability,
              bucket_start,
              count(*) filter (where status = 'succeeded')::int as succeeded,
              count(*) filter (where status = 'failed')::int as failed
         from dimensions
        where capability in ('chat', 'image', 'video', 'audio')
          and provider_id is not null
          and model_record_id is not null
        group by provider_id, provider_name, model_record_id, native_model_id, display_name, capability, bucket_start
        order by provider_id, model_record_id, bucket_start asc`,
      [input.from, input.to],
    );

    return result.rows.flatMap((row) => {
      const capability = normalizeCapability(row.capability);
      if (!capability) return [];
      return [{
        providerId: row.provider_id,
        providerName: row.provider_name,
        modelRecordId: row.model_record_id,
        nativeModelId: row.native_model_id,
        displayName: row.display_name,
        capability,
        bucketStartAt: dateValue(row.bucket_start),
        succeeded: numberValue(row.succeeded),
        failed: numberValue(row.failed),
      }];
    });
  }

  async function readFeedbackAggregates(input: { from24h: Date; from72h: Date }): Promise<ChannelFeedbackAggregateRow[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<FeedbackAggregatePostgresRow>(
      `select provider_id,
              model_id,
              count(*) filter (where vote = 'up' and updated_at >= $1)::int as up_24h,
              count(*) filter (where vote = 'down' and updated_at >= $1)::int as down_24h,
              count(*) filter (where vote = 'up')::int as up_72h,
              count(*) filter (where vote = 'down')::int as down_72h,
              max(updated_at) as latest_vote_at
         from xh_channel_feedback
        where updated_at >= $2
        group by provider_id, model_id`,
      [input.from24h, input.from72h],
    );
    return result.rows.map((row) => ({
      providerId: row.provider_id,
      modelRecordId: row.model_id,
      up24h: numberValue(row.up_24h),
      down24h: numberValue(row.down_24h),
      up72h: numberValue(row.up_72h),
      down72h: numberValue(row.down_72h),
      latestVoteAt: row.latest_vote_at ? dateValue(row.latest_vote_at) : null,
    }));
  }

  async function readViewerVotes(input: { ownerId: string; from: Date }): Promise<ChannelViewerVoteRow[]> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<ViewerVotePostgresRow>(
      `select provider_id, model_id, vote
         from xh_channel_feedback
        where owner_id = $1
          and updated_at >= $2`,
      [input.ownerId, input.from],
    );
    return result.rows.flatMap((row) => row.vote === "up" || row.vote === "down"
      ? [{ providerId: row.provider_id, modelRecordId: row.model_id, vote: row.vote }]
      : []);
  }

  async function upsertEligibleVote(input: {
    ownerId: string;
    providerId: string;
    modelRecordId: string;
    vote: ChannelFeedbackVote;
    eligibleSince: Date;
  }): Promise<ChannelFeedbackWriteResult> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query<VoteWritePostgresRow>(
      `with channel as (
         select m.id as model_id, m.provider_id
           from xh_models m
          where m.id = $2
            and m.provider_id = $3
       ),
       eligible as (
         select t.id
           from xh_tasks t
           left join xh_models m on m.id = t.model_id
          where t.owner_id = $1
            and t.model_id = $2
            and (t.provider_id = $3 or (t.provider_id is null and m.provider_id = $3))
            and t.status in ('succeeded', 'failed')
            and t.created_at >= $4
          order by t.created_at desc
          limit 1
       ),
       saved as (
         insert into xh_channel_feedback (id, owner_id, provider_id, model_id, vote, eligible_task_id, created_at, updated_at)
         select $5, $1, channel.provider_id, channel.model_id, $6, eligible.id, now(), now()
           from channel cross join eligible
         on conflict (owner_id, provider_id, model_id)
         do update set vote = excluded.vote,
                       eligible_task_id = excluded.eligible_task_id,
                       updated_at = now()
         returning vote
       )
       select exists(select 1 from channel) as channel_exists,
              (select vote from saved) as vote`,
      [input.ownerId, input.modelRecordId, input.providerId, input.eligibleSince, newId(), input.vote],
    );
    const row = result.rows[0];
    if (!row || !Boolean(row.channel_exists)) return { kind: "channel_missing" };
    if (row.vote !== "up" && row.vote !== "down") return { kind: "ineligible" };
    return { kind: "saved", vote: row.vote };
  }
}

function normalizeCapability(value: unknown): ChannelHealthCapability | null {
  const capability = String(value || "").toLowerCase();
  if (capability === "text" || capability === "llm") return "chat";
  return capability === "chat" || capability === "image" || capability === "video" || capability === "audio"
    ? capability
    : null;
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dateValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
