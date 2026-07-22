import { describe, expect, it } from "vitest";

import { roundRobinOwnerOrder } from "./canvas-run-dispatch-fairness.js";

describe("canvas run dispatch fairness", () => {
  it("returns every ready owner once before wrapping to the start", () => {
    expect(roundRobinOwnerOrder(["owner-c", "owner-a", "owner-b", "owner-a"], "owner-b"))
      .toEqual(["owner-c", "owner-a", "owner-b"]);
  });

  it("starts from the first owner when the persisted cursor is empty or no longer ready", () => {
    expect(roundRobinOwnerOrder(["owner-c", "owner-a"], "")).toEqual(["owner-a", "owner-c"]);
    expect(roundRobinOwnerOrder(["owner-b", "owner-c"], "owner-z")).toEqual(["owner-b", "owner-c"]);
  });
});
