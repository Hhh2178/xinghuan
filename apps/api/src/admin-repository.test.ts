import { describe, expect, it, vi } from "vitest";
import { createAdminRepository, type AdminDbShape } from "./admin-repository.js";

function createDeps(overrides: Partial<Parameters<typeof createAdminRepository>[0]> = {}): Parameters<typeof createAdminRepository>[0] {
  const db: AdminDbShape = {
    providers: [],
    models: [],
    tasks: [],
    announcements: [],
    auditLogs: [],
  };
  return {
    usePostgresRepository: () => false,
    getPostgresPool: async () => {
      throw new Error("not used");
    },
    readAdminDb: async () => db,
    writeAdminDb: async () => undefined,
    dateToMillis: (value: unknown) => (value instanceof Date ? value.getTime() : Number(value) || 0),
    millisToDate: (value: number | undefined) => new Date(value || 0),
    safeText: (value: unknown, fallback = "") => String(value ?? fallback).trim(),
    ...overrides,
  };
}

describe("admin repository", () => {
  it("reads postgres admin summary without selecting heavy task fields", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("provider_summary");
      expect(sql).toContain("task_summary");
      expect(sql).not.toContain("payload");
      expect(sql).not.toContain("result");
      expect(sql).not.toContain("t.logs");
      expect(sql).not.toContain(" logs,");
      return {
        rows: [{
          providers: "5",
          enabled_providers: "4",
          models: "9",
          enabled_models: "7",
          tasks: "20",
          running_tasks: "3",
          audit_logs: "11",
        }],
      };
    });
    const repo = createAdminRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query, connect: vi.fn() } as any),
    }));

    await expect(repo.readAdminSummary(
      { users: 3, enabledUsers: 2 },
      { users: 3, canvases: 2, resources: 1, inputFiles: 4, outputFiles: 5 },
    )).resolves.toMatchObject({
      users: 3,
      enabledUsers: 2,
      providers: 5,
      enabledProviders: 4,
      models: 9,
      enabledModels: 7,
      tasks: 20,
      runningTasks: 3,
      auditLogs: 11,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("reads postgres audit records without loading tasks", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      expect(sql).toContain("from xh_audit_logs");
      expect(sql).not.toContain("xh_tasks");
      expect(sql).not.toContain("payload");
      expect(params).toEqual([200]);
      return {
        rows: [{
          id: "audit-1",
          actor_id: "u1",
          actor_email: "admin@example.test",
          action: "models.read",
          target_type: "model",
          target_id: "models-list",
          summary: "查看模型列表",
          request_id: "req-1",
          ip: "127.0.0.1",
          user_agent: "test",
          created_at: new Date("2026-07-04T00:00:00.000Z"),
        }],
      };
    });
    const repo = createAdminRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query, connect: vi.fn() } as any),
    }));

    await expect(repo.readAuditRecords(200)).resolves.toEqual([
      expect.objectContaining({
        id: "audit-1",
        actorId: "u1",
        requestId: "req-1",
        createdAt: Date.parse("2026-07-04T00:00:00.000Z"),
      }),
    ]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("appends postgres audit records without opening a full replace transaction", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      expect(sql).toContain("insert into xh_audit_logs");
      expect(sql).not.toContain("delete from");
      expect(params).toEqual([
        "audit-1",
        "u1",
        "admin@example.test",
        "models.read",
        "model",
        "models-list",
        "查看模型列表",
        "req-1",
        "127.0.0.1",
        "test-agent",
        new Date("2026-07-04T00:00:00.000Z"),
      ]);
      return { rows: [], rowCount: 1 };
    });
    const connect = vi.fn(async () => {
      throw new Error("appendAuditRecord should not open a full replace transaction");
    });
    const repo = createAdminRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query, connect } as any),
      millisToDate: (value) => new Date(value || 0),
    }));

    await expect(repo.appendAuditRecord({
      id: "audit-1",
      actorId: "u1",
      actorEmail: "admin@example.test",
      action: "models.read",
      targetType: "model",
      targetId: "models-list",
      summary: "查看模型列表",
      requestId: "req-1",
      ip: "127.0.0.1",
      userAgent: "test-agent",
      createdAt: Date.parse("2026-07-04T00:00:00.000Z"),
    })).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it("preserves the rest of admin json when writing file-backed announcements and audit logs", async () => {
    const db: AdminDbShape = {
      providers: [{ enabled: true }],
      models: [{ enabled: false }],
      tasks: [{ status: "queued" }],
      announcements: [],
      auditLogs: [],
    };
    const writeAdminDb = vi.fn(async (next: AdminDbShape) => {
      Object.assign(db, next);
    });
    const repo = createAdminRepository(createDeps({
      readAdminDb: async () => db,
      writeAdminDb,
    }));

    await repo.writeAnnouncementRecords([{
      id: "a1",
      title: "Announcement",
      summary: "Summary",
      content: "Content",
      type: "manual",
      priority: "normal",
      status: "draft",
      scope: "all-users",
      pinned: false,
      strongReminder: false,
      popupEnabled: true,
      createdBy: "admin@example.test",
      createdAt: 1,
      updatedAt: 1,
    }]);
    await repo.appendAuditRecord({
      id: "audit-1",
      actorId: "u1",
      actorEmail: "admin@example.test",
      action: "announcement.read",
      targetType: "announcement",
      targetId: "announcements",
      summary: "查看公告列表",
      createdAt: 2,
    });

    expect(db.providers).toHaveLength(1);
    expect(db.models).toHaveLength(1);
    expect(db.tasks).toHaveLength(1);
    expect(db.announcements).toHaveLength(1);
    expect(db.auditLogs).toHaveLength(1);
    expect(writeAdminDb).toHaveBeenCalledTimes(2);
  });
});
