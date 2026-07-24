import {
  buildChannelHealthBucketRange,
  classifyChannelHealth,
  classifyProviderHealth,
  successRate,
  type ChannelFeedbackSummary,
  type ChannelFeedbackVote,
  type ChannelHealthFilters,
  type ChannelHealthModel,
  type ChannelHealthProvider,
  type ChannelHealthReport,
} from "@xinghuan/shared";

import type {
  ChannelFeedbackAggregateRow,
  ChannelHealthCatalogRow,
  ChannelHealthRepository,
  ChannelHealthSettledBucketRow,
} from "./channel-health-repository.js";

type ChannelHealthAudience = "member" | "admin";

interface ReadReportInput {
  audience: ChannelHealthAudience;
  ownerId?: string;
  filters?: ChannelHealthFilters;
}

interface AggregateReport {
  now: number;
  report: ChannelHealthReport;
  filters: ChannelHealthFilters;
}

interface CachedAggregate {
  expiresAt: number;
  filters: ChannelHealthFilters;
  promise: Promise<AggregateReport>;
}

interface ModelAccumulator {
  model: ChannelHealthModel;
  provider: ProviderAccumulator;
  providerSortOrder: number;
  modelSortOrder: number;
  bucketsByStart: Map<number, ChannelHealthModel["buckets"][number]>;
}

interface ProviderAccumulator {
  provider: ChannelHealthProvider;
  sortOrder: number;
  models: ModelAccumulator[];
}

export function createChannelHealthService(deps: {
  repository: ChannelHealthRepository;
  now?: () => number;
  cacheTtlMs?: number;
}) {
  const now = deps.now || (() => Date.now());
  const cacheTtlMs = deps.cacheTtlMs ?? 30_000;
  const aggregateCache = new Map<string, CachedAggregate>();

  return { readReport, submitVote, invalidateChannel };

  async function readReport(input: ReadReportInput): Promise<ChannelHealthReport> {
    const aggregate = await readAggregate(input.audience, input.filters || {});
    const viewerVotes = input.ownerId
      ? await deps.repository.readViewerVotes({ ownerId: input.ownerId, from: new Date(aggregate.now - 72 * HOUR_MS) })
      : [];
    const viewerVotesByChannel = new Map(viewerVotes.map((row) => [channelKey(row.providerId, row.modelRecordId), row]));
    const report = structuredClone(aggregate.report);
    const recentFeedbackStart = aggregate.now - 24 * HOUR_MS;

    for (const provider of report.providers) {
      for (const model of provider.models) {
        const viewerVote = viewerVotesByChannel.get(channelKey(provider.id, model.modelRecordId));
        model.feedback.viewerVote = viewerVote && (model.feedback.window === "72h_fallback" || viewerVote.updatedAt >= recentFeedbackStart)
          ? viewerVote.vote
          : null;
      }
    }
    return report;
  }

  async function submitVote(input: {
    ownerId: string;
    providerId: string;
    modelRecordId: string;
    vote: ChannelFeedbackVote;
  }) {
    const result = await deps.repository.upsertEligibleVote({
      ...input,
      eligibleSince: new Date(now() - 24 * HOUR_MS),
    });
    if (result.kind !== "saved") return result;
    invalidateChannel(input.providerId, input.modelRecordId);
    return {
      kind: "saved" as const,
      vote: result.vote,
      report: await readReport({ audience: "member", ownerId: input.ownerId }),
    };
  }

  function invalidateChannel(providerId: string, modelRecordId: string) {
    for (const [key, entry] of aggregateCache) {
      if (entry.filters.providerId && entry.filters.providerId !== providerId) continue;
      if (entry.filters.modelRecordId && entry.filters.modelRecordId !== modelRecordId) continue;
      aggregateCache.delete(key);
    }
  }

  async function readAggregate(audience: ChannelHealthAudience, filters: ChannelHealthFilters): Promise<AggregateReport> {
    const cacheKey = `${audience}:${filters.capability || ""}:${filters.providerId || ""}:${filters.modelRecordId || ""}`;
    const currentNow = now();
    const cached = aggregateCache.get(cacheKey);
    if (cached && cached.expiresAt > currentNow) return cached.promise;

    const promise = loadAggregate(audience, filters, currentNow).catch((error) => {
      if (aggregateCache.get(cacheKey)?.promise === promise) aggregateCache.delete(cacheKey);
      throw error;
    });
    aggregateCache.set(cacheKey, { expiresAt: currentNow + cacheTtlMs, filters: { ...filters }, promise });
    return promise;
  }

  async function loadAggregate(audience: ChannelHealthAudience, filters: ChannelHealthFilters, currentNow: number): Promise<AggregateReport> {
    const range = buildChannelHealthBucketRange(currentNow);
    const rangeStart = new Date(range.windowStartAt);
    const rangeEnd = new Date(currentNow);
    const recentStart = new Date(currentNow - 24 * HOUR_MS);
    const feedback72Start = new Date(currentNow - 72 * HOUR_MS);
    const [catalog, settledRows, recentRows, feedbackRows] = await Promise.all([
      deps.repository.readCatalog({ includeDisabled: audience === "admin" }),
      deps.repository.readSettledBuckets({ from: rangeStart, to: rangeEnd }),
      deps.repository.readSettledBuckets({ from: recentStart, to: rangeEnd }),
      deps.repository.readFeedbackAggregates({ from24h: recentStart, from72h: feedback72Start }),
    ]);

    return {
      now: currentNow,
      filters: { ...filters },
      report: buildReport({ audience, filters, range, generatedAt: currentNow, catalog, settledRows, recentRows, feedbackRows }),
    };
  }
}

const HOUR_MS = 60 * 60 * 1000;

function buildReport(input: {
  audience: ChannelHealthAudience;
  filters: ChannelHealthFilters;
  range: ReturnType<typeof buildChannelHealthBucketRange>;
  generatedAt: number;
  catalog: ChannelHealthCatalogRow[];
  settledRows: ChannelHealthSettledBucketRow[];
  recentRows: ChannelHealthSettledBucketRow[];
  feedbackRows: ChannelFeedbackAggregateRow[];
}): ChannelHealthReport {
  const providerAccumulators = new Map<string, ProviderAccumulator>();
  const modelAccumulators = new Map<string, ModelAccumulator>();
  const recentByChannel = new Map<string, { succeeded: number; failed: number }>();
  const feedbackByChannel = new Map(input.feedbackRows.map((row) => [channelKey(row.providerId, row.modelRecordId), row]));

  for (const row of input.catalog) ensureCatalogModel(row);
  for (const row of input.settledRows) {
    const accumulator = ensureSettledModel(row);
    if (!accumulator) continue;
    const endAt = row.bucketStartAt + 2 * HOUR_MS;
    if (row.bucketStartAt < input.range.windowStartAt || endAt > input.range.windowEndAt) continue;
    const current = accumulator.bucketsByStart.get(row.bucketStartAt) || {
      startAt: row.bucketStartAt,
      endAt,
      succeeded: 0,
      failed: 0,
      settled: 0,
      successRate: 0,
      sufficientSample: false,
    };
    current.succeeded += row.succeeded;
    current.failed += row.failed;
    current.settled = current.succeeded + current.failed;
    current.successRate = successRate(current.succeeded, current.failed) || 0;
    current.sufficientSample = current.settled >= 3;
    accumulator.bucketsByStart.set(row.bucketStartAt, current);
    accumulator.model.succeeded += row.succeeded;
    accumulator.model.failed += row.failed;
  }
  for (const row of input.recentRows) {
    const accumulator = ensureSettledModel(row);
    if (!accumulator) continue;
    const key = channelKey(row.providerId, row.modelRecordId);
    const current = recentByChannel.get(key) || { succeeded: 0, failed: 0 };
    current.succeeded += row.succeeded;
    current.failed += row.failed;
    recentByChannel.set(key, current);
  }

  for (const accumulator of modelAccumulators.values()) {
    const modelKey = channelKey(accumulator.model.providerId, accumulator.model.modelRecordId);
    const recent = recentByChannel.get(modelKey) || { succeeded: 0, failed: 0 };
    const feedback = feedbackByChannel.get(modelKey);
    const hasRecentUse = recent.succeeded + recent.failed > 0;
    accumulator.model.settled = accumulator.model.succeeded + accumulator.model.failed;
    accumulator.model.successRate = successRate(accumulator.model.succeeded, accumulator.model.failed);
    accumulator.model.state = classifyChannelHealth(recent.succeeded, recent.failed);
    accumulator.model.buckets = [...accumulator.bucketsByStart.values()].sort((left, right) => left.startAt - right.startAt);
    accumulator.model.feedback = feedbackSummary(feedback, hasRecentUse);
  }

  const providers = [...providerAccumulators.values()]
    .map((accumulator) => ({
      ...accumulator.provider,
      models: accumulator.models
        .sort((left, right) => left.modelSortOrder - right.modelSortOrder || left.model.displayName.localeCompare(right.model.displayName))
        .map((model) => model.model),
    }))
    .filter((provider) => provider.models.length > 0)
    .sort((left, right) => providerAccumulators.get(left.id)!.sortOrder - providerAccumulators.get(right.id)!.sortOrder || left.name.localeCompare(right.name));

  for (const provider of providers) provider.state = classifyProviderHealth(provider.models.map((model) => model.state));

  return {
    generatedAt: input.generatedAt,
    windowStartAt: input.range.windowStartAt,
    windowEndAt: input.range.windowEndAt,
    bucketHours: 2,
    bucketCount: 36,
    providers,
  };

  function ensureCatalogModel(row: ChannelHealthCatalogRow): ModelAccumulator | null {
    if (!matchesFilters(row, input.filters)) return null;
    const key = channelKey(row.providerId, row.modelRecordId);
    const existing = modelAccumulators.get(key);
    if (existing) return existing;
    const provider = ensureProvider({
      id: row.providerId,
      name: row.providerName,
      enabled: row.providerEnabled,
      sortOrder: row.providerSortOrder,
    });
    const accumulator: ModelAccumulator = {
      provider,
      providerSortOrder: row.providerSortOrder,
      modelSortOrder: row.modelSortOrder,
      bucketsByStart: new Map(),
      model: {
        providerId: row.providerId,
        modelRecordId: row.modelRecordId,
        nativeModelId: row.nativeModelId,
        displayName: row.displayName,
        capability: row.capability,
        enabled: row.modelEnabled,
        state: "no_recent_requests",
        succeeded: 0,
        failed: 0,
        settled: 0,
        successRate: null,
        buckets: [],
        feedback: emptyFeedback(),
      },
    };
    provider.models.push(accumulator);
    modelAccumulators.set(key, accumulator);
    return accumulator;
  }

  function ensureSettledModel(row: ChannelHealthSettledBucketRow): ModelAccumulator | null {
    const existing = modelAccumulators.get(channelKey(row.providerId, row.modelRecordId));
    if (existing) return existing;
    if (input.audience === "member" || !matchesFilters(row, input.filters)) return null;
    return ensureCatalogModel({
      providerId: row.providerId,
      providerName: row.providerName || row.providerId,
      providerEnabled: false,
      providerSortOrder: Number.MAX_SAFE_INTEGER,
      modelRecordId: row.modelRecordId,
      nativeModelId: row.nativeModelId || row.modelRecordId,
      displayName: row.displayName || row.modelRecordId,
      capability: row.capability,
      modelEnabled: false,
      modelSortOrder: Number.MAX_SAFE_INTEGER,
    });
  }

  function ensureProvider(inputProvider: { id: string; name: string; enabled: boolean; sortOrder: number }): ProviderAccumulator {
    const existing = providerAccumulators.get(inputProvider.id);
    if (existing) return existing;
    const accumulator: ProviderAccumulator = {
      sortOrder: inputProvider.sortOrder,
      models: [],
      provider: {
        id: inputProvider.id,
        name: inputProvider.name,
        enabled: inputProvider.enabled,
        state: "no_recent_requests",
        models: [],
      },
    };
    providerAccumulators.set(inputProvider.id, accumulator);
    return accumulator;
  }
}

function feedbackSummary(row: ChannelFeedbackAggregateRow | undefined, hasRecentUse: boolean): ChannelFeedbackSummary {
  const up = hasRecentUse ? row?.up24h || 0 : row?.up72h || 0;
  const down = hasRecentUse ? row?.down24h || 0 : row?.down72h || 0;
  const total = up + down;
  return {
    window: hasRecentUse ? "24h" : "72h_fallback",
    up,
    down,
    total,
    upRate: total > 0 ? up / total : null,
    viewerVote: null,
  };
}

function emptyFeedback(): ChannelFeedbackSummary {
  return { window: "24h", up: 0, down: 0, total: 0, upRate: null, viewerVote: null };
}

function matchesFilters(value: { providerId: string; modelRecordId: string; capability: string }, filters: ChannelHealthFilters): boolean {
  return (!filters.providerId || filters.providerId === value.providerId)
    && (!filters.modelRecordId || filters.modelRecordId === value.modelRecordId)
    && (!filters.capability || filters.capability === value.capability);
}

function channelKey(providerId: string, modelRecordId: string): string {
  return `${providerId}::${modelRecordId}`;
}
