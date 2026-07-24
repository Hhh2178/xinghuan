import { describe, expect, it, vi } from "vitest";
import { createChannelHealthRepository } from "./channel-health-repository.js";

function createPool(rows: unknown[] = []) {
  const query = vi.fn(async (..._args: unknown[]) => ({ rows }));
  return { query };
}

describe("channel health repository", () => {
  it("aggregates only settled task counts using the canonical cost snapshot", async () => {
    const pool = createPool();
    const repository = createChannelHealthRepository({ getPostgresPool: async () => pool as any });

    await repository.readSettledBuckets({
      from: new Date("2026-07-21T06:00:00.000Z"),
      to: new Date("2026-07-24T08:00:00.000Z"),
    });

    const sql = String(pool.query.mock.calls[0][0]);
    expect(sql).toContain("t.status in ('succeeded', 'failed')");
    expect(sql).toContain("ci.cost_item_type = 'provider_cost'");
    expect(sql).toContain("coalesce(ci.provider_id_snapshot");
    expect(sql).not.toContain("owner_email");
  });

  it("uses an atomic owner-scoped upsert for feedback", async () => {
    const pool = createPool([{ channel_exists: true, vote: "up" }]);
    const repository = createChannelHealthRepository({
      getPostgresPool: async () => pool as any,
      newId: () => "feedback-1",
    });

    await repository.upsertEligibleVote({
      ownerId: "user-1",
      providerId: "provider-1",
      modelRecordId: "model-1",
      vote: "up",
      eligibleSince: new Date("2026-07-23T08:00:00.000Z"),
    });

    const sql = String(pool.query.mock.calls[0][0]);
    expect(sql).toContain("on conflict (owner_id, provider_id, model_id)");
    expect(sql).toContain("t.owner_id = $1");
    expect(sql).toContain("t.created_at >= $4");
  });
});
