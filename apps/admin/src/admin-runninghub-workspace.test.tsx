import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(resolve(__dirname, "admin-runninghub-workspace.tsx"), "utf8");
const editorSource = readFileSync(resolve(__dirname, "admin-runninghub-item-editor.tsx"), "utf8");

describe("RunningHub configuration workbench", () => {
  it("uses shared object context and rail/editor slots without another page heading", () => {
    expect(workspaceSource).toContain('from "./admin-configuration-workbench"');
    expect(workspaceSource).toContain("<AdminConfigurationWorkbench");
    expect(workspaceSource).toContain("<AdminConfigurationContext");
    expect(workspaceSource).toContain("<AdminConfigurationLayout");
    expect(workspaceSource).not.toContain("admin-runninghub-workspace__hero");
    expect(workspaceSource).not.toContain("<h1");
    expect(workspaceSource).not.toContain("<h2");
  });

  it("retains catalog, key-pool, analysis, save, test, and validation behavior", () => {
    for (const method of [
      "adminRunningHubApi.listItems",
      "adminRunningHubApi.createItem",
      "adminRunningHubApi.updateItem",
      "adminRunningHubApi.deleteItem",
      "adminRunningHubApi.testItem",
      "adminRunningHubApi.analyzeItemDraft",
      "adminRunningHubApi.listKeyPool",
      "adminRunningHubApi.saveKeyPool",
      "adminRunningHubApi.deleteKeyPoolItem",
    ]) {
      expect(workspaceSource).toContain(method);
    }

    for (const handler of [
      "onSave={handleSave}",
      "onTest={handleTest}",
      "onDelete={handleDelete}",
      "onToggleEnabled={handleToggleEnabled}",
    ]) {
      expect(workspaceSource).toContain(handler);
    }

    expect(editorSource).toContain("parseObjectJson(parameterSchema)");
    expect(editorSource).toContain("parseAnyJson(testPayload");
    expect(editorSource).toContain("adminRunningHubApi.fetchRemoteAppInfo");
    expect(editorSource).toContain("await onSave(currentItem.catalogId");
    expect(editorSource).toContain("await onTest(currentItem.catalogId");
  });
});
