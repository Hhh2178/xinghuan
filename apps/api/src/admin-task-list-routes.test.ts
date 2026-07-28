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
  it("queues artifact-only recovery without creating a new provider task", async () => {
    const task = {
      id: "task-recover",
      title: "Recover video",
      status: "failed",
      ownerId: "user-1",
      providerId: "provider-1",
      modelId: "model-1",
      payload: { taskCapability: "video" },
      result: { capability: "video", providerState: "completed", remoteVideoUrls: ["https://provider.test/video.mp4"] },
      logs: ["provider completed"],
      createdAt: 1000,
      updatedAt: 1000,
      finalizedAt: 2000,
    };
    const readTaskRecord = vi.fn(async () => task);
    const writeTaskRecord = vi.fn(async (updated: any) => Object.assign(task, updated));
    const enqueueTask = vi.fn(async () => ({ queued: true, reason: "", queueName: "xinghuan:video" }));
    const { deps, sent } = createBaseDeps({ readTaskRecord, writeTaskRecord, enqueueTask, normalizeTaskQueueCapability: () => "video" });
    const handler = createAdminTaskListRouteHandler(deps as any);

    await handler({
      request: { method: "POST" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/tasks/task-recover/recover-output"),
      currentUser: { id: "admin-1", role: "admin" },
    });

    expect(enqueueTask).toHaveBeenCalledWith("task-recover", "video");
    expect(writeTaskRecord).toHaveBeenCalledWith(expect.objectContaining({
      status: "queued",
      payload: expect.objectContaining({ outputRecoveryMode: "output_only" }),
      result: expect.objectContaining({ outputRecoveryMode: "output_only" }),
    }));
    expect(sent[0].data).toMatchObject({ status: "queued" });
  });

  it("queues provider polling recovery for an existing upstream video task", async () => {
    const task = {
      id: "task-provider-poll-recovery",
      title: "Recover Plato video",
      status: "failed",
      ownerId: "user-1",
      providerId: "provider-plato",
      modelId: "model-grok",
      payload: { taskCapability: "video" },
      result: {
        capability: "video",
        adapter: "apimart-video",
        upstreamTaskId: "upstream-existing-1",
        failureReason: "stream ended before completion",
      },
      logs: ["provider task created"],
      createdAt: 1000,
      updatedAt: 1000,
      finalizedAt: 2000,
    };
    const readTaskRecord = vi.fn(async () => task);
    const writeTaskRecord = vi.fn(async (updated: any) => Object.assign(task, updated));
    const enqueueTask = vi.fn(async () => ({ queued: true, reason: "", queueName: "xinghuan:video" }));
    const { deps } = createBaseDeps({ readTaskRecord, writeTaskRecord, enqueueTask, normalizeTaskQueueCapability: () => "video" });
    const handler = createAdminTaskListRouteHandler(deps as any);

    await handler({
      request: { method: "POST" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/tasks/task-provider-poll-recovery/recover-output"),
      currentUser: { id: "admin-1", role: "admin" },
    });

    expect(enqueueTask).toHaveBeenCalledWith("task-provider-poll-recovery", "video");
    expect(writeTaskRecord).toHaveBeenCalledWith(expect.objectContaining({
      status: "queued",
      payload: expect.objectContaining({ outputRecoveryMode: "provider_poll_resume" }),
      result: expect.objectContaining({
        outputRecoveryMode: "provider_poll_resume",
        upstreamTaskId: "upstream-existing-1",
      }),
    }));
  });

  it("returns complete logs without payload or result while preserving capability filters", async () => {
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
    expect(page.items[0]).toHaveProperty("logs", ["hidden log"]);
  });

  it("uses injected task repository page reader when provided", async () => {
    const readTaskListPage = vi.fn(async () => ({
      items: [{ id: "task-repo", title: "Repository task", status: "queued", logs: ["full log"], createdAt: 1, updatedAt: 1 }],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false,
      filters: { status: "", providerId: "", capability: "" },
    }));
    const { deps, sent } = createBaseDeps({ readTaskListPage });
    const handler = createAdminTaskListRouteHandler(deps as any);

    const handled = await handler({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/tasks?page=1&pageSize=10"),
      currentUser: { id: "admin-1", role: "admin" },
      requestContext: { requestId: "test" },
    });

    expect(handled).toBe(true);
    expect(readTaskListPage).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      status: "",
      providerId: "",
      capability: "",
    });
    expect(sent[0].data).toMatchObject({ total: 1, items: [{ id: "task-repo" }] });
    expect(deps.readAdminDb).not.toHaveBeenCalled();
  });

  it("selects logs but not payload or result for postgres list rows", async () => {
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
          logs: ["full postgres log"],
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
        logs: row.logs,
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

    const listSql = query.mock.calls.find(([sql]) => /\bt\.logs\b/.test(String(sql)))?.[0] as string;
    expect(listSql).toBeTruthy();
    expect(listSql).not.toMatch(/\bt\.payload\s*,/);
    expect(listSql).not.toMatch(/\bt\.result\s*,/);
    expect(listSql).toContain("t.payload->>'userId'");
    expect(listSql).toMatch(/\bt\.logs\b/);
    const page = sent[0].data as { items: Array<Record<string, unknown>> };
    expect(page.items[0]).not.toHaveProperty("payload");
    expect(page.items[0]).not.toHaveProperty("result");
    expect(page.items[0]).toHaveProperty("logs", ["full postgres log"]);
  });
});
