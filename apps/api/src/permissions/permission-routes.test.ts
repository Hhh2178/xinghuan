import { describe, expect, it, vi } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { createPermissionRouteHandler } from "./permission-routes.js";

const subject: PermissionSubject = { subjectKey: "runninghub.app/example", domain: "runninghub", subjectType: "app", parentKeys: ["runninghub.app/*"], sourceId: "app:example", exposureState: "restricted", displayName: "Example", metadata: {}, revision: 1 };

function createHandler() {
  const subjects = [subject];
  const rules: PermissionRule[] = [];
  const sendT8 = vi.fn();
  return {
    sendT8,
    handler: createPermissionRouteHandler({
      sendT8,
      readJsonBody: async (request: any) => request.body,
      HttpError: class HttpError extends Error { constructor(public statusCode: number, message: string) { super(message); } },
      readAuthorizationState: async () => ({ subjects, rules }),
      upsertSubject: async (next) => { subjects[0] = next; return next; },
      upsertRule: async (next) => { rules.push(next); return next; },
      deleteRule: async (id) => { const index = rules.findIndex((item) => item.id === id); if (index >= 0) rules.splice(index, 1); },
      explain: async (user, subjectKey, action) => ({ allowed: user.id === "member-a" && subjectKey === subject.subjectKey && action === "view", reason: "group-rule" as const }),
      appendAudit: vi.fn(),
      createId: () => "rule-1",
      now: () => 100,
    }),
    subjects,
    rules,
  };
}

describe("permission routes", () => {
  it("lets an admin publish a subject and assign a group rule", async () => {
    const { handler, sendT8, subjects, rules } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await handler({ request: { method: "PUT", body: { exposureState: "published", revision: 1 } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-subjects/runninghub.app%2Fexample"), currentUser: admin });
    await handler({ request: { method: "POST", body: { principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin });
    expect(subjects[0].exposureState).toBe("published");
    expect(rules).toMatchObject([{ principalType: "group", principalId: "group-a", effect: "allow" }]);
    expect(sendT8).toHaveBeenCalledTimes(2);
  });

  it("rejects a member before returning administrator subject data", async () => {
    const { handler } = createHandler();
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://test/api/admin/permission-subjects"), currentUser: { id: "member-a", email: "member@test", name: "Member", role: "member" } })).rejects.toMatchObject({ statusCode: 403, message: "ADMIN_REQUIRED" });
  });
});
