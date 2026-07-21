import { describe, expect, it } from "vitest";

import {
  finalizeTaskCost,
  normalizeModelPricingInput,
  resolveBillableSeconds,
} from "./task-cost-domain.js";

describe("task cost domain", () => {
  it("defaults model pricing to CNY and successful per-request charging", () => {
    expect(normalizeModelPricingInput({ unitPrice: "1.25" })).toEqual({
      billingUnit: "per_request",
      currency: "CNY",
      enabled: true,
      note: "",
      unitPrice: "1.250000",
    });
    expect(finalizeTaskCost({ status: "succeeded", billingUnit: "per_request", unitPrice: "1.25" })).toMatchObject({
      status: "charged",
      quantity: 1,
      amount: "1.250000",
      chargeReason: "task_succeeded",
    });
  });

  it("does not charge failed tasks or an upstream-confirmed cancellation", () => {
    expect(finalizeTaskCost({ status: "failed", billingUnit: "per_request", unitPrice: "2" }).status).toBe("not_charged");
    expect(finalizeTaskCost({
      status: "cancelled",
      billingUnit: "per_request",
      unitPrice: "2",
      result: { cancelScope: "upstream_confirmed", upstreamCancelled: true },
    })).toMatchObject({ status: "not_charged", amount: "0.000000", chargeReason: "upstream_cancelled" });
  });

  it("charges local-only and failed upstream cancellation attempts", () => {
    for (const cancelScope of ["local_only", "upstream_attempt_failed"]) {
      expect(finalizeTaskCost({
        status: "cancelled",
        billingUnit: "per_request",
        unitPrice: "2",
        result: { cancelScope, upstreamCancelled: false },
      })).toMatchObject({ status: "charged", quantity: 1, amount: "2.000000", chargeReason: "cancelled_without_upstream_confirmation" });
    }
  });

  it("uses billed, output, then requested duration and rounds positive seconds upward", () => {
    expect(resolveBillableSeconds({ payload: { durationSeconds: 9.1 }, result: { outputDurationSeconds: 7.2, billedSeconds: 3.01 } })).toEqual({ quantity: 4, source: "upstream_billed" });
    expect(resolveBillableSeconds({ payload: { durationSeconds: 9.1 }, result: { outputDurationSeconds: 7.2 } })).toEqual({ quantity: 8, source: "output_duration" });
    expect(resolveBillableSeconds({ payload: { durationSeconds: 9.1 }, result: {} })).toEqual({ quantity: 10, source: "requested_duration" });
    expect(finalizeTaskCost({ status: "succeeded", billingUnit: "per_second", unitPrice: "0.125", payload: { durationSeconds: 2.1 } })).toMatchObject({
      status: "charged",
      quantity: 3,
      amount: "0.375000",
      quantitySource: "requested_duration",
    });
  });
});
