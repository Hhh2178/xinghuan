import { describe, expect, it } from "vitest";

import { toUiFailureDiagnostic } from "./ui-failure-diagnostic.js";

describe("UI failure diagnostic", () => {
  it("redacts raw URLs while keeping a recoverable node-renderer diagnostic", () => {
    const diagnostic = toUiFailureDiagnostic(
      new Error("Failed to load https://secret.example/path?token=leak"),
      "node-renderer",
    );

    expect(diagnostic).toMatchObject({
      scope: "node-renderer",
      code: "UI_NODE_RENDERER_ERROR",
      recoverable: true,
    });
    expect(diagnostic.id).toMatch(/^ui-node-renderer-/);
    expect(diagnostic.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnostic.userMessage).not.toContain("secret.example");
    expect(diagnostic.userMessage).not.toContain("token=");
  });

  it("marks an app-shell crash as requiring a reload instead of a local retry", () => {
    expect(toUiFailureDiagnostic(new Error("shell failed"), "app-shell")).toMatchObject({
      scope: "app-shell",
      code: "UI_APP_SHELL_ERROR",
      recoverable: false,
    });
  });
});
