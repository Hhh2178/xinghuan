import { describe, expect, it } from "vitest";

import { shouldRunChannelHealthAutoRefresh } from "./admin-channel-health-refresh.js";

describe("admin channel health refresh", () => {
  it("runs only when the five-minute switch is enabled and the tab is visible", () => {
    expect(shouldRunChannelHealthAutoRefresh({ enabled: false, visibilityState: "visible" })).toBe(false);
    expect(shouldRunChannelHealthAutoRefresh({ enabled: true, visibilityState: "hidden" })).toBe(false);
    expect(shouldRunChannelHealthAutoRefresh({ enabled: true, visibilityState: "visible" })).toBe(true);
  });
});
