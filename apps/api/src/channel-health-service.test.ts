import { describe, expect, it, vi } from "vitest";

import type { ChannelHealthRepository } from "./channel-health-repository.js";
import { createChannelHealthService } from "./channel-health-service.js";

const NOW = Date.parse("2026-07-24T08:00:00.000Z");

function createRepository(overrides: Partial<ChannelHealthRepository> = {}): ChannelHealthRepository {
  return {
    readCatalog: vi.fn(async () => [{
      providerId: "provider-1",
      providerName: "Provider One",
      providerEnabled: true,
      providerSortOrder: 0,
      modelRecordId: "model-1",
      nativeModelId: "native-1",
      displayName: "Model One",
      capability: "image" as const,
      modelEnabled: true,
      modelSortOrder: 0,
    }]),
    readSettledBuckets: vi.fn(async ({ from }: { from: Date }) => from.getTime() < NOW - 24 * 60 * 60 * 1000
      ? [{
          providerId: "provider-1",
          providerName: "Provider One",
          modelRecordId: "model-1",
          nativeModelId: "native-1",
          displayName: "Model One",
          capability: "image" as const,
          bucketStartAt: NOW - 2 * 60 * 60 * 1000,
          succeeded: 19,
          failed: 1,
        }]
      : [{
          providerId: "provider-1",
          providerName: "Provider One",
          modelRecordId: "model-1",
          nativeModelId: "native-1",
          displayName: "Model One",
          capability: "image" as const,
          bucketStartAt: NOW - 2 * 60 * 60 * 1000,
          succeeded: 19,
          failed: 1,
        }]),
    readFeedbackAggregates: vi.fn(async () => [{
      providerId: "provider-1",
      modelRecordId: "model-1",
      up24h: 8,
      down24h: 2,
      up72h: 12,
      down72h: 3,
      latestVoteAt: NOW - 60_000,
    }]),
    readViewerVotes: vi.fn(async ({ ownerId }) => ownerId === "user-up"
      ? [{ providerId: "provider-1", modelRecordId: "model-1", vote: "up" as const, updatedAt: NOW - 60_000 }]
      : []),
    upsertEligibleVote: vi.fn(async () => ({ kind: "saved" as const, vote: "up" as const })),
    ...overrides,
  };
}

describe("channel health service", () => {
  it("builds success totals, a healthy current state, and a populated bucket", async () => {
    const service = createChannelHealthService({ repository: createRepository(), now: () => NOW });
    const report = await service.readReport({ audience: "member", ownerId: "user-up" });
    const model = report.providers[0].models[0];

    expect(model.state).toBe("healthy");
    expect(model.successRate).toBe(0.95);
    expect(model.buckets).toHaveLength(1);
    expect(model.buckets[0]).toMatchObject({ succeeded: 19, failed: 1, sufficientSample: true });
    expect(model.feedback).toMatchObject({ window: "24h", up: 8, down: 2, viewerVote: "up" });
  });

  it("uses an insufficient sample state for fewer than three recent settled tasks", async () => {
    const repository = createRepository({
      readSettledBuckets: vi.fn(async () => [{
        providerId: "provider-1",
        providerName: "Provider One",
        modelRecordId: "model-1",
        nativeModelId: "native-1",
        displayName: "Model One",
        capability: "image" as const,
        bucketStartAt: NOW - 2 * 60 * 60 * 1000,
        succeeded: 2,
        failed: 0,
      }]),
    });
    const service = createChannelHealthService({ repository, now: () => NOW });
    const report = await service.readReport({ audience: "member", ownerId: "user-none" });

    expect(report.providers[0].models[0].state).toBe("insufficient_sample");
    expect(report.providers[0].models[0].buckets[0].sufficientSample).toBe(false);
  });

  it("uses the 72-hour feedback fallback when the channel has no recent settled use", async () => {
    const repository = createRepository({
      readSettledBuckets: vi.fn(async ({ from }: { from: Date }) => from.getTime() < NOW - 24 * 60 * 60 * 1000
        ? [{
            providerId: "provider-1",
            providerName: "Provider One",
            modelRecordId: "model-1",
            nativeModelId: "native-1",
            displayName: "Model One",
            capability: "image" as const,
            bucketStartAt: NOW - 26 * 60 * 60 * 1000,
            succeeded: 6,
            failed: 1,
          }]
        : []),
    });
    const service = createChannelHealthService({ repository, now: () => NOW });
    const report = await service.readReport({ audience: "member", ownerId: "user-none" });

    expect(report.providers[0].models[0].feedback).toMatchObject({ window: "72h_fallback", up: 12, down: 3 });
    expect(report.providers[0].models[0].state).toBe("no_recent_requests");
  });

  it("shares aggregate reads while keeping viewer votes isolated", async () => {
    const repository = createRepository();
    const service = createChannelHealthService({ repository, now: () => NOW, cacheTtlMs: 30_000 });

    const [withVote, withoutVote] = await Promise.all([
      service.readReport({ audience: "member", ownerId: "user-up" }),
      service.readReport({ audience: "member", ownerId: "user-none" }),
    ]);

    expect(repository.readCatalog).toHaveBeenCalledTimes(1);
    expect(withVote.providers[0].models[0].feedback.viewerVote).toBe("up");
    expect(withoutVote.providers[0].models[0].feedback.viewerVote).toBeNull();
  });
});
