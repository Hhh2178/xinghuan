import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { shouldRunChannelHealthAutoRefresh } from "./admin-channel-health-refresh.js";

const dashboardSource = readFileSync(new URL("./admin-channel-health-dashboard.tsx", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("./admin-channel-health-dashboard.css", import.meta.url), "utf8");

describe("admin channel health refresh", () => {
  it("runs only when the five-minute switch is enabled and the tab is visible", () => {
    expect(shouldRunChannelHealthAutoRefresh({ enabled: false, visibilityState: "visible" })).toBe(false);
    expect(shouldRunChannelHealthAutoRefresh({ enabled: true, visibilityState: "hidden" })).toBe(false);
    expect(shouldRunChannelHealthAutoRefresh({ enabled: true, visibilityState: "visible" })).toBe(true);
  });

  it("selects the bounded Admin report surface explicitly", () => {
    expect(dashboardSource).toContain('surface="admin"');
    expect(dashboardSource).toContain('className="admin-channel-health__report"');
  });

  it("keeps the auto-refresh checkbox at a stable control size", () => {
    expect(dashboardCss).toMatch(/\.admin-channel-health__auto input\s*\{[^}]*width:\s*14px[^}]*height:\s*14px[^}]*\}/);
  });
});
