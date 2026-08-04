import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(resolve(__dirname, "admin-runninghub-workspace.tsx"), "utf8");
const editorSource = readFileSync(resolve(__dirname, "admin-runninghub-item-editor.tsx"), "utf8");
const stylesSource = readFileSync(resolve(__dirname, "styles.css"), "utf8");

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

  it("uses the shared configuration rail as the only sticky owner and has no footer color block", () => {
    const railRules = [...stylesSource.matchAll(/\.admin-runninghub-workspace__rail\s*\{([^}]*)\}/g)].map((match) => match[1]);
    const footerRules = [...stylesSource.matchAll(/\.admin-runninghub-workspace__rail-footer\s*\{([^}]*)\}/g)].map((match) => match[1]);

    expect(railRules).not.toHaveLength(0);
    expect(footerRules).not.toHaveLength(0);
    expect(railRules.join("\n")).not.toContain("position: sticky");
    expect(footerRules.join("\n")).not.toContain("background:");
  });

  it("keeps group management in an explicit modal drawer instead of the item rail flow", () => {
    expect(workspaceSource).toContain("admin-runninghub-group-trigger");
    expect(workspaceSource).toContain("admin-runninghub-group-drawer");
    expect(workspaceSource).toContain('aria-modal="true"');
    expect(workspaceSource).toContain("onKeyDown");
    expect(stylesSource).toContain(".admin-runninghub-group-drawer__backdrop");
    expect(stylesSource).toContain("position: fixed;");
    expect(stylesSource).toContain(".admin-runninghub-group-manager__list");

    const railSource = workspaceSource.slice(
      workspaceSource.indexOf('rail={<div className="api-card admin-runninghub-workspace__rail">'),
      workspaceSource.indexOf("</AdminConfigurationLayout>")
    );
    expect(railSource.indexOf("<AdminRunningHubGroupManager")).toBe(-1);
  });
});
