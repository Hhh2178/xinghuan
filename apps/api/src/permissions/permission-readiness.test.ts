import { describe, expect, it } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { evaluatePermissionReadiness } from "./permission-readiness.js";

const subject = (overrides: Partial<PermissionSubject> = {}): PermissionSubject => ({
  subjectKey: "provider.model/model-a",
  domain: "provider",
  subjectType: "model",
  parentKeys: ["provider.model/*"],
  sourceId: "model-a",
  exposureState: "published",
  displayName: "Model A",
  metadata: {},
  revision: 1,
  ...overrides,
});

const rule = (overrides: Partial<PermissionRule> = {}): PermissionRule => ({
  id: "rule-a",
  principalType: "group",
  principalId: "group-a",
  subjectKey: "provider.model/model-a",
  action: "view",
  effect: "allow",
  revision: 1,
  ...overrides,
});

describe("permission readiness", () => {
  it("rejects the exact gray failure shape before enforced mode", () => {
    const report = evaluatePermissionReadiness({
      subjects: Array.from({ length: 124 }, (_, index) => subject({
        subjectKey: `provider.model/model-${index}`,
        sourceId: `model-${index}`,
        exposureState: "restricted",
      })),
      rules: [],
      groupIds: ["group-a", "group-b", "group-c"],
      users: [
        { id: "member-a", role: "member", groupId: "group-a" },
        { id: "member-b", role: "member" },
      ],
    });

    expect(report.ready).toBe(false);
    expect(report.failures.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      "NO_PUBLISHED_SUBJECTS",
      "NO_PERMISSION_RULES",
      "MISSING_PRINCIPAL_COVERAGE",
    ]));
  });

  it("accepts explicit coverage for every group and ungrouped", () => {
    const subjects = [subject()];
    const rules = [
      rule(),
      rule({ id: "rule-execute", action: "execute" }),
      rule({ id: "rule-ungrouped", principalId: "ungrouped" }),
      rule({ id: "rule-ungrouped-execute", principalId: "ungrouped", action: "execute" }),
    ];
    const report = evaluatePermissionReadiness({
      subjects,
      rules,
      groupIds: ["group-a"],
      users: [
        { id: "member-a", role: "member", groupId: "group-a" },
        { id: "member-b", role: "member" },
      ],
    });

    expect(report.ready).toBe(true);
    expect(report.failures).toEqual([]);
  });

  it("rejects users that reference a missing group", () => {
    const report = evaluatePermissionReadiness({
      subjects: [subject()],
      rules: [
        rule(),
        rule({ id: "rule-execute", action: "execute" }),
        rule({ id: "rule-ungrouped", principalId: "ungrouped" }),
        rule({ id: "rule-ungrouped-execute", principalId: "ungrouped", action: "execute" }),
      ],
      groupIds: ["group-a"],
      users: [{ id: "member-b", role: "member", groupId: "deleted-group" }],
    });

    expect(report.failures).toContainEqual(expect.objectContaining({ code: "INVALID_USER_GROUP_REFERENCE" }));
  });

  it("rejects partial action coverage even when every principal has a rule", () => {
    const report = evaluatePermissionReadiness({
      subjects: [subject()],
      rules: [rule(), rule({ id: "rule-ungrouped", principalId: "ungrouped" })],
      groupIds: ["group-a"],
      users: [{ id: "member-a", role: "member", groupId: "group-a" }],
    });

    expect(report.failures).toContainEqual(expect.objectContaining({
      code: "MISSING_SUBJECT_ACTION_COVERAGE",
      count: 2,
    }));
  });

  it("rejects rules for missing principals and retired subjects", () => {
    const retired = subject({ subjectKey: "provider.model/retired", sourceId: "retired", exposureState: "retired" });
    const report = evaluatePermissionReadiness({
      subjects: [subject(), retired],
      rules: [
        rule(),
        rule({ id: "rule-execute", action: "execute" }),
        rule({ id: "rule-ungrouped", principalId: "ungrouped" }),
        rule({ id: "rule-ungrouped-execute", principalId: "ungrouped", action: "execute" }),
        rule({ id: "orphan-user", principalType: "user", principalId: "deleted-user" }),
        rule({ id: "retired-rule", subjectKey: retired.subjectKey }),
      ],
      groupIds: ["group-a"],
      users: [{ id: "member-a", role: "member", groupId: "group-a" }],
    });

    expect(report.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ORPHAN_PERMISSION_PRINCIPAL" }),
      expect.objectContaining({ code: "RETIRED_SUBJECT_RULE" }),
    ]));
  });
});
