import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const systemSource = readFileSync(resolve(__dirname, "admin-readonly-panels.tsx"), "utf8");
const syncSource = readFileSync(resolve(__dirname, "admin-environment-sync-panel.tsx"), "utf8");

describe("System configuration workbenches", () => {
  it("presents runtime settings as a shared configuration surface while preserving revision writes", () => {
    expect(systemSource).toContain('from "./admin-configuration-workbench"');
    expect(systemSource).toContain("<AdminConfigurationWorkbench");
    expect(systemSource).toContain("<AdminConfigurationContext");
    expect(systemSource).toContain("runtimeSettingsDirty");
    expect(systemSource).toContain("await onSave({");
    expect(systemSource).toContain("taskQueueSettings: values");
    expect(systemSource).toContain("revision: system?.taskQueueSettingsRevision ?? 1");
  });

  it("uses shared context and rail/editor slots without changing preview, conflict, or apply behavior", () => {
    expect(syncSource).toContain('from "./admin-configuration-workbench"');
    expect(syncSource).toContain("<AdminConfigurationWorkbench");
    expect(syncSource).toContain("<AdminConfigurationContext");
    expect(syncSource).toContain("<AdminConfigurationLayout");
    expect(syncSource).not.toContain("AdminWorkspaceBand");
    expect(syncSource.match(/\/api\/admin\/environment-sync\/preview/g)).toHaveLength(1);
    expect(syncSource.match(/\/api\/admin\/environment-sync\/apply/g)).toHaveLength(1);
    expect(syncSource).toContain("decision: current[rowKey(row)]?.decision ?? row.defaultDecision");
    expect(syncSource).toContain("onConfirm: applySelection");
    expect(syncSource).toContain("<ConfirmActionDialog");
  });
});
