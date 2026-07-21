import { describe, expect, it } from "vitest";

import { buildAdminCostSummary } from "./admin-cost-analytics.js";

describe("admin cost analytics", () => {
  it("aggregates charged costs by frozen dimensions without floating point drift", () => {
    const summary = buildAdminCostSummary({
      currency: "CNY",
      from: Date.UTC(2026, 6, 20),
      to: Date.UTC(2026, 6, 21, 23, 59),
      historicalUnpriced: 4,
      items: [
        { status: "charged", amount: "0.100000", quantity: 1, billingUnit: "per_request", createdAt: Date.UTC(2026, 6, 20), providerId: "p1", providerName: "服务商一", modelId: "m1", modelName: "模型一", groupId: "g1", groupName: "一组", ownerId: "u1", ownerEmail: "a@test" },
        { status: "charged", amount: "0.200000", quantity: 2, billingUnit: "per_second", createdAt: Date.UTC(2026, 6, 20), providerId: "p1", providerName: "服务商一", modelId: "m2", modelName: "模型二", groupId: "g1", groupName: "一组", ownerId: "u2", ownerEmail: "b@test" },
        { status: "unpriced", amount: "0", quantity: 0, billingUnit: null, createdAt: Date.UTC(2026, 6, 21), providerId: "p2", providerName: "服务商二", modelId: "m3", modelName: "模型三", groupId: "g2", groupName: "二组", ownerId: "u3", ownerEmail: "c@test" },
      ],
    });
    expect(summary.totals).toEqual({ amount: "0.300000", chargedTasks: 2, billedRequests: 1, billedSeconds: 2, unpricedTasks: 5 });
    expect(summary.providers[0]).toMatchObject({ id: "p1", label: "服务商一", amount: "0.300000" });
    expect(summary.groups[0]).toMatchObject({ id: "g1", label: "一组", amount: "0.300000" });
    expect(summary.accounts).toHaveLength(2);
    expect(summary.daily[0]).toMatchObject({ day: "2026-07-20", amount: "0.300000" });
  });
});
