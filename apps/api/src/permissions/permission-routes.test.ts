import { describe, expect, it, vi } from "vitest";
import type { PermissionRule, PermissionSubject } from "@xinghuan/shared";
import { createPermissionRouteHandler } from "./permission-routes.js";

const subject: PermissionSubject = { subjectKey: "runninghub.app/example", domain: "runninghub", subjectType: "app", parentKeys: ["runninghub.app/*"], sourceId: "app:example", exposureState: "restricted", displayName: "Example", metadata: {}, revision: 1 };

class TestHttpError extends Error {
  constructor(public statusCode: number, message: string, public payload?: Record<string, unknown>) {
    super(message);
  }
}

function createHandler() {
  const subjects = [subject];
  const rules: PermissionRule[] = [];
  const sendT8 = vi.fn();
  return {
    sendT8,
    handler: createPermissionRouteHandler({
      sendT8,
      readJsonBody: async (request: any) => request.body,
      HttpError: TestHttpError,
      readAuthorizationState: async () => ({ subjects, rules }),
      upsertSubject: async (next) => { subjects[0] = next; return next; },
      upsertRule: async (next) => { rules.push(next); return next; },
      deleteRule: async (id) => { const index = rules.findIndex((item) => item.id === id); if (index >= 0) rules.splice(index, 1); },
      explain: async (user, subjectKey, action) => ({ allowed: user.id === "member-a" && subjectKey === subject.subjectKey && action === "view", reason: "group-rule" as const }),
      appendAudit: vi.fn(),
      createId: () => "rule-1",
      now: () => 100,
      readHealth: async () => ({ mode: "shadow", readiness: { ready: false } }),
      principalExists: async () => true,
    }),
    subjects,
    rules,
  };
}

describe("permission routes", () => {
  it("lets an admin publish a subject and assign a group rule", async () => {
    const { handler, sendT8, subjects, rules } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await handler({ request: { method: "PUT", body: { exposureState: "published", revision: 1, reason: "release" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-subjects/runninghub.app%2Fexample"), currentUser: admin });
    await handler({ request: { method: "POST", body: { principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow", reason: "grant" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin });
    expect(subjects[0].exposureState).toBe("published");
    expect(rules).toMatchObject([{ principalType: "group", principalId: "group-a", effect: "allow" }]);
    expect(sendT8).toHaveBeenCalledTimes(2);
  });

  it("rejects manual global exposure changes for catalog-managed provider models", async () => {
    const { handler, subjects } = createHandler();
    subjects[0] = {
      ...subject,
      subjectKey: "provider.model/model-a",
      domain: "provider",
      subjectType: "model",
      sourceId: "model:model-a",
      exposureState: "published",
      metadata: { managedBy: "first-wave", enabled: true },
    };
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };

    await expect(handler({
      request: { method: "PUT", body: { exposureState: "restricted", revision: 1, reason: "hide" } } as any,
      response: {} as any,
      url: new URL("http://test/api/admin/permission-subjects/provider.model%2Fmodel-a"),
      currentUser: admin,
    })).rejects.toMatchObject({
      statusCode: 409,
      message: "PERMISSION_SUBJECT_EXPOSURE_MANAGED_BY_CATALOG",
    });
  });

  it("requires an audit reason for permission mutations", async () => {
    const { handler } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await expect(handler({ request: { method: "POST", body: { principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin })).rejects.toMatchObject({ statusCode: 400, message: "PERMISSION_CHANGE_REASON_REQUIRED" });
  });

  it("requires an audit reason when deleting a rule", async () => {
    const { handler } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await expect(handler({ request: { method: "DELETE", body: {} } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules/rule-1"), currentUser: admin })).rejects.toMatchObject({ statusCode: 400, message: "PERMISSION_CHANGE_REASON_REQUIRED" });
  });

  it("returns the current subject revision when preflight rejects a stale update", async () => {
    const { handler } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };

    await expect(handler({
      request: { method: "PUT", body: { exposureState: "published", revision: 0, reason: "release" } } as any,
      response: {} as any,
      url: new URL("http://test/api/admin/permission-subjects/runninghub.app%2Fexample"),
      currentUser: admin,
    })).rejects.toMatchObject({
      statusCode: 409,
      message: "PERMISSION_SUBJECT_REVISION_CONFLICT",
      payload: { currentRevision: 1 },
    });
  });

  it("rejects a stale rule revision", async () => {
    const { handler } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    const body = { principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow", reason: "grant" };
    await handler({ request: { method: "POST", body } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin });
    await expect(handler({ request: { method: "POST", body: { ...body, effect: "deny", revision: 0 } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin })).rejects.toMatchObject({ statusCode: 409, message: "PERMISSION_RULE_REVISION_CONFLICT" });
  });

  it("maps repository revision races to 409 after the preflight check", async () => {
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    const base = createHandler();
    const handler = createPermissionRouteHandler({
      sendT8: base.sendT8,
      readJsonBody: async (request: any) => request.body,
      HttpError: TestHttpError,
      readAuthorizationState: async () => ({ subjects: base.subjects, rules: base.rules }),
      upsertSubject: async () => { throw new Error("PERMISSION_SUBJECT_REVISION_CONFLICT"); },
      upsertRule: async () => { throw new Error("PERMISSION_RULE_REVISION_CONFLICT"); },
      deleteRule: async () => { throw new Error("PERMISSION_RULE_REVISION_CONFLICT"); },
      explain: async () => ({ allowed: false, reason: "no-matching-rule" as const }),
      appendAudit: vi.fn(),
      createId: () => "rule-1",
      now: () => 100,
      principalExists: async () => true,
    });

    await expect(handler({ request: { method: "PUT", body: { exposureState: "published", revision: 1, reason: "release" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-subjects/runninghub.app%2Fexample"), currentUser: admin })).rejects.toMatchObject({ statusCode: 409, message: "PERMISSION_SUBJECT_REVISION_CONFLICT", payload: { currentRevision: 1 } });
    await expect(handler({ request: { method: "POST", body: { principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow", reason: "grant" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules"), currentUser: admin })).rejects.toMatchObject({ statusCode: 409, message: "PERMISSION_RULE_REVISION_CONFLICT" });
    base.rules.push({ id: "rule-delete", principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow", revision: 1 });
    await expect(handler({ request: { method: "DELETE", body: { revision: 1, reason: "remove" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules/rule-delete"), currentUser: admin })).rejects.toMatchObject({ statusCode: 409, message: "PERMISSION_RULE_REVISION_CONFLICT" });
  });

  it("rejects a stale rule revision before deletion", async () => {
    const { handler, rules } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    rules.push({ id: "rule-delete", principalType: "group", principalId: "group-a", subjectKey: subject.subjectKey, action: "view", effect: "allow", revision: 2 });

    await expect(handler({ request: { method: "DELETE", body: { revision: 1, reason: "remove" } } as any, response: {} as any, url: new URL("http://test/api/admin/permission-rules/rule-delete"), currentUser: admin })).rejects.toMatchObject({ statusCode: 409, message: "PERMISSION_RULE_REVISION_CONFLICT" });
  });

  it("rejects a member before returning administrator subject data", async () => {
    const { handler } = createHandler();
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://test/api/admin/permission-subjects"), currentUser: { id: "member-a", email: "member@test", name: "Member", role: "member" } })).rejects.toMatchObject({ statusCode: 403, message: "ADMIN_REQUIRED" });
  });

  it("returns admin-only runtime health without exposing it to members", async () => {
    const { handler, sendT8 } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://test/api/admin/permission-health"), currentUser: admin });
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: "shadow" }));
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://test/api/admin/permission-health"), currentUser: { id: "member-a", email: "member@test", name: "Member", role: "member" } })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns batch effective decisions for the unified admin panel", async () => {
    const { handler, sendT8 } = createHandler();
    const admin = { id: "admin-a", email: "admin@test", name: "Admin", role: "admin" as const };
    await handler({
      request: { method: "POST", body: { user: { id: "member-a", role: "member" }, checks: [{ subjectKey: subject.subjectKey, action: "view" }, { subjectKey: subject.subjectKey, action: "execute" }] } } as any,
      response: {} as any,
      url: new URL("http://test/api/admin/permission-explain"),
      currentUser: admin,
    });
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), {
      decisions: [
        expect.objectContaining({ subjectKey: subject.subjectKey, action: "view", allowed: true }),
        expect.objectContaining({ subjectKey: subject.subjectKey, action: "execute", allowed: false }),
      ],
    });
  });
});
