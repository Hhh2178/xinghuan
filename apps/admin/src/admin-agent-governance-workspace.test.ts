import { describe, expect, it } from "vitest";

import { canRenderGovernanceData } from "./admin-agent-governance-workspace.js";

describe("admin Agent governance workspace loading state", () => {
  it("does not render a data view after loading fails before data exists", () => {
    expect(canRenderGovernanceData(false, null)).toBe(false);
  });

  it("renders only after a complete data payload exists", () => {
    expect(canRenderGovernanceData(false, { overview: {}, models: {}, policies: {} })).toBe(true);
    expect(canRenderGovernanceData(true, { overview: {}, models: {}, policies: {} })).toBe(false);
  });
});
