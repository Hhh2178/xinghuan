import { describe, expect, it, vi } from "vitest";

import { createAdminTaskListRouteHandler } from "./admin-task-list-routes.js";

class TestHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public payload?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function createBaseDeps(overrides: Record<string, unknown> = {}) {
  const sent: Array<{ data: unknown; statusCode?: number }> = [];
  const deps = {
    sendT8: vi.fn((_response: unknown, data: unknown, statusCode?: number) => {
      sent.push({ data, statusCode });
    }),
    HttpError: TestHttpError,
    readAdminDb: vi.fn(async () => ({
      tasks: [
        {
          id: "task-image",
          title: "Image task",
          status: "queued",
          ownerId: "user-1",
          providerId: "provider-1",
          modelId: "model-1",
          payload: { taskCapability: "image", prompt: "secret prompt" },
          result: { capability: "image", raw: { capability: "image" } },
          logs: ["hidden log"],
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          id: "task-video",
          title: "Video task",
          status: "failed",
          ownerId: "user-2",
          providerId: "provider-2",
          modelId: "model-2",
          payload: { taskCapability: "video" },
          result: { capability: "video", error: "failed upstream" },
          logs: ["failed log"],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    })),
    readAuthDb: vi.fn(async () => ({
      users: [{ id: "user-1", name: "Alice", email: "alice@example.test", groupId: "group-1" }],
      userGroups: [{ id: "group-1", name: "Operators" }],
    })),
    usePostgresRepository: () => false,
    getPostgresPool: async () => {
      throw new Error("postgres should not be used");
    },
    readJsonBody: vi.fn(),
    appendAudit: vi.fn(async () => undefined),
    clampInteger: (value: unknown, min: number, max: number, fallback: number) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.min(max, Math.trunc(parsed)));
    },
    safeText: (value: unknown, fallback = "") => String(value ?? fallback).trim(),
    plainObject: (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}),
    withUnifiedRuntimeDiagnostic: (task: unknown) => task,
    toAdminTaskRecord: (row: unknown) => row,
    enrichAdminTaskRecord: (task: unknown) => task,
    normalizeTaskStatus: (value: unknown) => String(value || "queued"),
    normalizeTaskQueueCapability: (value: unknown) => value,
    enqueueTask: vi.fn(),
    readTaskRecord: vi.fn(),
    insertTaskRecord: vi.fn(),
    appendTaskLog: vi.fn(),
    createRetriedTask: vi.fn(),
    cancelTaskWithStrategy: vi.fn(),
    writeTaskRecord: vi.fn(),
    logApiEvent: vi.fn(),
    ...overrides,
  };
  return { deps, sent };
}

describe("admin task list routes", () => {
  it("returns list summary items without heavy task fields while preserving capability filters", async () => {
    const { deps, sent } = createBaseDeps();
    const handler = createAdminTaskListRouteHandler(deps as any);

    const handled = await handler({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/tasks?page=1&pageSize=10&capability=image"),
      currentUser: { id: "admin-1", role: "admin" },
      requestContext: { requestId: "test" },
    });

    expect(handled).toBe(true);
    expect(sent).toHaveLength(1);
    const page = sent[0].data as { items: Array<Record<string, unknown>>; total: number };
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: "task-image",
      title: "Image task",
      status: "queued",
    });
    expect(page.items[0]).not.toHaveProperty("payload");
    expect(page.items[0]).not.toHaveProperty("result");
    expect(page.items[0]).not.toHaveProperty("logs");
  });

  it("does not select payload result or logs for postgres list rows", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("count(*)")) return { rows: [{ total: 1 }] };
      return {
        rows: [{
          id: "task-image",
          owner_id: "user-1",
          title: "Image task",
          status: "queued",
          provider_id: "provider-1",
          model_id: "model-1",
          created_at: new Date(2000),
          updated_at: new Date(2000),
          owner_name: "Alice",
          owner_email: "alice@example.test",
          owner_remark: "",
          owner_group_id: "group-1",
          owner_group_name: "Operators",
          owner_deleted: false,
        }],
      };
    });
    const { deps, sent } = createBaseDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }),
      toAdminTaskRecord: (row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        ownerGroupId: row.owner_group_id,
        ownerGroupName: row.owner_group_name,
        providerId: row.provider_id,
        modelId: row.model_id,
        createdAt: 2000,
        updatedAt: 2000,
      }),
    });
    const handler = createAdminTaskListRouteHandler(deps as any);

    await handler({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/tasks?page=1&pageSize=10"),
      currentUser: { id: "admin-1", role: "admin" },
    });

    const listSql = query.mock.calls.find(([sql]) => String(sql).includes("from xh_tasks t"))?.[0] as string;
    expect(listSql).toBeTruthy();
    expect(listSql).not.toMatch(/\bt\.payload\b/);
    expect(listSql).not.toMatch(/\bt\.result\b/);
    expect(listSql).not.toMatch(/\bt\.logs\b/);
    const page = sent[0].data as { items: Array<Record<string, unknown>> };
    expect(page.items[0]).not.toHaveProperty("payload");
    expect(page.items[0]).not.toHaveProperty("result");
    expect(page.items[0]).not.toHaveProperty("logs");
  });
});
