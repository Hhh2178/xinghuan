import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const overview = readFileSync(resolve(__dirname, "admin-comfyui-overview.tsx"), "utf8");
const detail = readFileSync(resolve(__dirname, "admin-comfyui-detail.tsx"), "utf8");

describe("ComfyUI visual-only configuration migration", () => {
  it("uses shared context, summaries, and semantic status without duplicate identity skins", () => {
    for (const source of [overview, detail]) {
      expect(source).toContain('from "./admin-configuration-workbench"');
      expect(source).toContain("<AdminConfigurationWorkbench");
      expect(source).toContain("<AdminConfigurationContext");
      expect(source).not.toContain("<h1");
    }

    expect(overview).toContain("<AdminSummaryStrip");
    expect(overview).toContain("<StatusPill");
    expect(overview).not.toContain("AdminWorkspaceBand");
    expect(overview).not.toContain("getStatusColor");
    expect(detail).toContain("<AdminSummaryStrip");
    expect(detail).not.toContain("admin-comfyui-detail-header");
    expect(detail).not.toContain("admin-comfyui-health-pill");
    expect(detail).not.toContain("admin-comfyui-summary-card");
  });

  it("keeps the frozen ComfyUI API surface unchanged", () => {
    const overviewMethods = ["listInstances", "testConnection"];
    const detailMethods = [
      "listInstances",
      "listWorkflows",
      "updateInstance",
      "createInstance",
      "deleteInstance",
      "createWorkflow",
      "updateWorkflow",
      "pushWorkflowToShared",
      "deleteWorkflow",
    ];

    for (const method of overviewMethods) {
      expect(overview.match(new RegExp(`adminComfyuiApi\\.${method}`, "g"))).toHaveLength(1);
    }
    for (const method of detailMethods) {
      expect(detail.match(new RegExp(`adminComfyuiApi\\.${method}`, "g"))).toHaveLength(1);
    }
  });
});
