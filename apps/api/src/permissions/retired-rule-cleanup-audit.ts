import type { PermissionRuleRecord } from "./permission-repository.js";

interface RetiredRuleCleanupAuditRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: number;
}

export function createRetiredRuleCleanupAudit(deps: {
  appendAuditRecord: (record: RetiredRuleCleanupAuditRecord) => Promise<void>;
  now: () => number;
}) {
  return async (rules: PermissionRuleRecord[]) => {
    const subjectKeys = [...new Set(rules.map((rule) => rule.subjectKey))];
    const now = deps.now();
    await deps.appendAuditRecord({
      id: `audit-${now}-permission-cleanup`,
      actorId: "system:permission-reconciliation",
      actorEmail: "system:permission-reconciliation",
      action: "permission.rules.retired.cleanup",
      targetType: "permission-rule-batch",
      targetId: subjectKeys.join(",").slice(0, 240) || "retired-subjects",
      summary: `retired permission rules cleanup: ${rules.length}`,
      createdAt: now,
    });
  };
}
