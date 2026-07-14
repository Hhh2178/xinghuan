import { describe, expect, it } from "vitest";
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

describe("permission service", () => {
  it("uses the same denial for a hidden catalog item and direct execution", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({ subjects: [subject], rules: [] }),
    });
    const member = { id: "member-a", role: "member" as const, groupId: "group-a" };

    await expect(service.filter(member, [subject], "view")).resolves.toEqual([]);
    await expect(service.assertAllowed(member, subject.subjectKey, "execute")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("allows a published action only when its matching rule exists", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({ subjects: [subject], rules: [groupAllow] }),
    });
    const member = { id: "member-a", role: "member" as const, groupId: "group-a" };

    await expect(service.can(member, subject.subjectKey, "execute")).resolves.toMatchObject({ allowed: true, ruleId: "group-allow" });
    await expect(service.assertAllowed(member, subject.subjectKey, "execute")).resolves.toBeUndefined();
  });

  it("does not expose subject metadata through denial errors", async () => {
    const service = createPermissionService({
      readAuthorizationState: async () => ({ subjects: [subject], rules: [] }),
    });

    await expect(service.assertAllowed({ id: "member-a", role: "member" }, subject.subjectKey, "view")).rejects.toEqual(new PermissionDeniedError());
  });
});
