import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "admin-api-settings-panel.tsx"), "utf8");

describe("Provider and model configuration workbench", () => {
  it("adopts the shared configuration template without a second page identity", () => {
    expect(source).toContain('from "./admin-configuration-workbench"');
    expect(source).toContain("<AdminConfigurationWorkbench");
    expect(source).toContain("<AdminConfigurationContext");
    expect(source).toContain("<AdminConfigurationLayout");
    expect(source).toContain('className="provider-rail"');
    expect(source).toContain('className="api-settings-content"');
    expect(source).not.toContain("api-settings-inline-status");
    expect(source).not.toContain("<h1");
  });

  it("retains Provider and model actions and their existing API routes", () => {
    for (const handler of [
      "onClick={saveProvider}",
      "onClick={probeProvider}",
      "onClick={fetchModels}",
      "onUpdate={updateModel}",
      "onDelete={requestDeleteModel}",
      "onTest={testModel}",
      "onMove={moveModel}",
    ]) {
      expect(source).toContain(handler);
    }

    for (const route of [
      "/api/admin/providers",
      "/api/admin/providers/reorder",
      "/api/admin/providers/probe",
      "/api/admin/providers/fetch-models",
      "/api/admin/models",
      "/api/admin/models/reorder",
    ]) {
      expect(source).toContain(route);
    }

    expect(source).toContain('hidden={activeView !== "providers"}');
    expect(source).toContain('activeView === "models"');
  });
});
