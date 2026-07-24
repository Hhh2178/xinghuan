import { describe, expect, it } from "vitest";

import { manualRefreshCoolingDown, msUntilNextWholeHour, shouldRefreshOnVisibility } from "./channel-health-refresh.js";

describe("channel health refresh policy", () => {
  it("waits until the next whole hour", () => {
    expect(msUntilNextWholeHour(Date.parse("2026-07-24T07:31:00.000Z"))).toBe(1_740_000);
  });

  it("refreshes after a stale visibility return", () => {
    expect(shouldRefreshOnVisibility({ lastLoadedAt: 0, now: 700_000 })).toBe(true);
    expect(shouldRefreshOnVisibility({ lastLoadedAt: 200_000, now: 700_000 })).toBe(false);
  });

  it("holds a manual refresh for ten seconds", () => {
    expect(manualRefreshCoolingDown({ lastManualAt: 100_000, now: 109_999 })).toBe(true);
    expect(manualRefreshCoolingDown({ lastManualAt: 100_000, now: 110_000 })).toBe(false);
  });
});
