import { describe, expect, it, vi } from "vitest";
import { createRetiredRuleCleanupAudit } from "./retired-rule-cleanup-audit.js";

describe("retired rule cleanup audit", () => {
  it("records the cleaned rule count and affected retired subjects", async () => {
    const appendAuditRecord = vi.fn(async () => undefined);
    const audit = createRetiredRuleCleanupAudit({ appendAuditRecord, now: () => 100 });

    await audit([
      { id: "rule-a", subjectKey: "provider.model/retired-a" },
      { id: "rule-b", subjectKey: "provider.model/retired-a" },
      { id: "rule-c", subjectKey: "provider.model/retired-b" },
    ] as never);

    expect(appendAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: "permission.rules.retired.cleanup",
      targetType: "permission-rule-batch",
      targetId: "provider.model/retired-a,provider.model/retired-b",
      summary: "retired permission rules cleanup: 3",
    }));
  });
});
