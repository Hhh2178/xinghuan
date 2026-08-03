import { describe, expect, it } from "vitest";
import {
  ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT,
  LAST_ROOT_REQUIRED,
  USER_NOT_FOUND,
  assertAdministratorAccountMutation,
  canViewAdministratorIdentity,
  projectAuditForAdministrator,
  visibleUsersForAdministrator,
} from "./admin-user-visibility.js";

const root = { id: "root-1", role: "admin" as const, administratorTier: "root" as const };
const operator = { id: "operator-1", role: "admin" as const, administratorTier: "operator" as const };
const operatorTwo = { id: "operator-2", role: "admin" as const, administratorTier: "operator" as const };
const member = { id: "member-1", role: "member" as const };

describe("administrator visibility policy", () => {
  it("keeps root identities undiscoverable to operators", () => {
    expect(canViewAdministratorIdentity(root, root)).toBe(true);
    expect(canViewAdministratorIdentity(operator, root)).toBe(false);
    expect(canViewAdministratorIdentity(operator, operatorTwo)).toBe(true);
    expect(canViewAdministratorIdentity(operator, member)).toBe(true);
    expect(visibleUsersForAdministrator(operator, [root, operator, member])).toEqual([operator, member]);
  });

  it("uses non-disclosure errors for operator root targets", () => {
    expect(() => assertAdministratorAccountMutation({ viewer: operator, target: root, action: "update" })).toThrow(USER_NOT_FOUND);
    expect(() => assertAdministratorAccountMutation({ viewer: operator, target: operatorTwo, action: "update" })).toThrow(ADMINISTRATOR_MANAGEMENT_REQUIRES_ROOT);
    expect(() => assertAdministratorAccountMutation({ viewer: root, target: operator, action: "update" })).not.toThrow();
    expect(() => assertAdministratorAccountMutation({ viewer: root, target: root, action: "disable", enabledRootCount: 1 })).toThrow(LAST_ROOT_REQUIRED);
  });

  it("redacts root business audit actors", () => {
    expect(projectAuditForAdministrator(operator, { actorId: root.id, actorEmail: "root@example.test", action: "canvas.update" }, [root.id])).toMatchObject({ actorId: "", actorEmail: "系统操作" });
    expect(projectAuditForAdministrator(operator, { actorId: root.id, actorEmail: "root@example.test", action: "auth.admin_me" }, [root.id])).toBeNull();
  });
});
