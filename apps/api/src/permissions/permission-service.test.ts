import { describe, expect, it, vi } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { createPermissionService, PermissionDeniedError } from "./permission-service.js";

const subject: PermissionSubject = {
  subjectKey: "runninghub.app/example",
  domain: "runninghub",
  subjectType: "app",
  parentKeys: ["runninghub.app/*"],
  sourceId: "app:example",
  exposureState: "published",
  displayName: "Example",
  metadata: {},
  revision: 1,
};

const groupAllow: PermissionRule = {
  id: "group-allow",
  principalType: "group",
  principalId: "group-a",
  subjectKey: subject.subjectKey,
  action: "execute",
  effect: "allow",
  revision: 1,
};

const groupDenies: PermissionRule[] = (["view", "execute"] as const).map((action) => ({
  id: `group-deny-${action}`,
  principalType: "group",
  principalId: "group-a",
  subjectKey: subject.subjectKey,
  action,
  effect: "deny",
  revision: 1,
}));

describe("permission service", () => {
  it("uses the same denial for a hidden catalog item and direct execution", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({ subjects: [subject], rules: groupDenies }),
    });
    const member = { id: "member-a", role: "member" as const, groupId: "group-a" };

    await expect(service.filter(member, [subject], "view")).resolves.toEqual([]);
    await expect(service.assertAllowed(member, subject.subjectKey, "execute")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("reports the matching explicit allow rule when one exists", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({ subjects: [subject], rules: [groupAllow] }),
    });
    const member = { id: "member-a", role: "member" as const, groupId: "group-a" };

    await expect(service.can(member, subject.subjectKey, "execute")).resolves.toMatchObject({ allowed: true, ruleId: "group-allow" });
    await expect(service.assertAllowed(member, subject.subjectKey, "execute")).resolves.toBeUndefined();
  });

  it("does not expose subject metadata through denial errors", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({
        subjects: [subject],
        rules: [{ ...groupDenies[0], id: "ungrouped-deny-view", principalId: "ungrouped" }],
      }),
    });

    await expect(service.assertAllowed({ id: "member-a", role: "member" }, subject.subjectKey, "view")).rejects.toEqual(new PermissionDeniedError());
  });

  it("shares one authorization snapshot across concurrent catalog decisions", async () => {
    const readAuthorizationState = vi.fn(async () => ({
      subjects: [subject],
      rules: [groupAllow],
    }));
    const service = createPermissionService({ readAuthorizationState });
    const member = { id: "member-a", role: "member" as const, groupId: "group-a" };

    await Promise.all([
      service.can(member, subject.subjectKey, "execute"),
      service.can(member, subject.subjectKey, "execute"),
      service.can(member, subject.subjectKey, "execute"),
    ]);

    expect(readAuthorizationState).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await service.can(member, subject.subjectKey, "execute");
    expect(readAuthorizationState).toHaveBeenCalledTimes(2);
  });
});
