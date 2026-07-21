import { describe, expect, it, vi } from "vitest";

import { createTaskCostRepository } from "./task-cost-repository.js";

describe("task cost repository member summary", () => {
  it("filters requested task ids by the authenticated task owner", async () => {
    const query = vi.fn(async () => ({
      rows: [{
        task_id: "task-a",
        pricing_version_id: "pricing-a",
        model_id_snapshot: "model-a",
        status: "charged",
        amount: "0.500000",
        currency: "CNY",
        billing_unit: "per_request",
        quantity: 1,
        charge_reason: "task_succeeded",
      }],
    }));
    const repository = createTaskCostRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
    });

    const result = await repository.readTaskCostSummary(["task-a", "task-a"], "owner-a");
    expect(result).toMatchObject({ visible: true, taskIds: ["task-a"] });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("and t.owner_id = $2"), [["task-a"], "owner-a"]);
  });

  it("returns a hidden summary outside PostgreSQL mode", async () => {
    const repository = createTaskCostRepository({
      usePostgresRepository: () => false,
      getPostgresPool: async () => { throw new Error("should not connect"); },
    });
    await expect(repository.readTaskCostSummary(["task-a"], "owner-a")).resolves.toMatchObject({ visible: false });
  });
});
