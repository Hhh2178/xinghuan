import { describe, expect, it } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { resolvePermission } from "./authorization-resolver.js";

const subject = (overrides: Partial<PermissionSubject> = {}): PermissionSubject => ({
  subjectKey: "runninghub.app/example",
  domain: "runninghub",
  subjectType: "app",
  parentKeys: ["runninghub.app/*"],
  sourceId: "example",
  exposureState: "published",
  displayName: "Example",
  metadata: {},
  revision: 1,
  ...overrides,
});

const rule = (overrides: Partial<PermissionRule> = {}): PermissionRule => ({
  id: "rule-1",
  principalType: "group",
  principalId: "group-a",
  subjectKey: "runninghub.app/example",
  action: "execute",
  effect: "allow",
  revision: 1,
  ...overrides,
});

const member = { id: "user-a", role: "member" as const, groupId: "group-a" };

describe("resolvePermission", () => {
  it("denies restricted subjects before matching member rules", () => {
    expect(resolvePermission({ user: member, subject: subject({ exposureState: "restricted" }), action: "view", rules: [rule({ action: "view" })] }).allowed).toBe(false);
  });

  it("allows an account rule over a group deny", () => {
    const result = resolvePermission({ user: member, subject: subject(), action: "execute", rules: [rule({ effect: "deny" }), rule({ id: "user-allow", principalType: "user", principalId: "user-a", effect: "allow" })] });
    expect(result.allowed).toBe(true);
    expect(result.ruleId).toBe("user-allow");
  });

  it("prefers a more specific deny over a parent group allow", () => {
    const result = resolvePermission({ user: member, subject: subject(), action: "execute", rules: [rule({ subjectKey: "runninghub.app/*", effect: "allow" }), rule({ id: "exact-deny", effect: "deny" })] });
    expect(result.allowed).toBe(false);
    expect(result.ruleId).toBe("exact-deny");
  });

  it("allows published frontend capabilities when no rule matches", () => {
    expect(resolvePermission({ user: member, subject: subject(), action: "execute", rules: [] })).toMatchObject({
      allowed: true,
      reason: "published-default-allow",
    });
  });
});
