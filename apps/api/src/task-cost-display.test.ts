import { describe, expect, it } from "vitest";

import { buildMemberTaskCostSummary } from "./task-cost-display.js";

describe("member task cost display summary", () => {
  it("hides tasks without a configured pricing snapshot", () => {
    expect(buildMemberTaskCostSummary([item({ pricingVersionId: "", status: "unpriced" })])).toMatchObject({
      visible: false,
      totals: [],
    });
  });

  it("adds batch amounts with fixed six-decimal semantics", () => {
    expect(buildMemberTaskCostSummary([
      item({ taskId: "task-a", amount: "0.100001" }),
      item({ taskId: "task-b", amount: "0.200009" }),
    ])).toMatchObject({
      visible: true,
      status: "charged",
      taskIds: ["task-a", "task-b"],
      totals: [{ currency: "CNY", amount: "0.300010" }],
    });
  });

  it("keeps currencies separate and gives pending state priority", () => {
    expect(buildMemberTaskCostSummary([
      item({ taskId: "task-a", status: "pending", amount: "0", currency: "CNY" }),
      item({ taskId: "task-b", amount: "1.5", currency: "USD" }),
    ])).toMatchObject({
      visible: true,
      status: "pending",
      totals: [
        { currency: "CNY", amount: "0.000000" },
        { currency: "USD", amount: "1.500000" },
      ],
    });
  });
});

function item(patch: Record<string, unknown> = {}) {
  return {
    taskId: "task-a",
    pricingVersionId: "price-a",
    modelId: "model-a",
    status: "charged" as const,
    amount: "0.1",
    currency: "CNY",
    billingUnit: "per_request" as const,
    quantity: 1,
    chargeReason: "task_succeeded",
    ...patch,
  };
}
