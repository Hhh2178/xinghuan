import { describe, expect, it, vi } from "vitest";
import {
  createTaskRepository,
  type TaskListItemShape,
  type TaskOwnerGroupRecordShape,
  type TaskOwnerRecordShape,
  type TaskPostgresRowShape,
  type TaskRecordShape,
} from "./task-repository.js";

function taskRecord(overrides: Partial<TaskRecordShape> & { id: string }): TaskRecordShape {
  return {
    title: "Task",
    status: "queued",
    logs: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function ownerRecord(overrides: Partial<TaskOwnerRecordShape> & { id: string }): TaskOwnerRecordShape {
  return {
    email: `${overrides.id}@example.test`,
    name: "Owner",
    role: "member",
    passwordHash: "hash",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function ownerGroupRecord(overrides: Partial<TaskOwnerGroupRecordShape> & { id: string }): TaskOwnerGroupRecordShape {
  return {
    name: "Group",
    description: "",
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createDeps(overrides: Partial<Parameters<typeof createTaskRepository>[0]> = {}) {
  return {
    usePostgresRepository: () => false,
    getPostgresPool: async () => {
      throw new Error("not used");
    },
    readTaskRecords: async () => [],
    writeTaskRecords: async () => undefined,
    readTaskOwnerRecords: async () => ({ users: [], userGroups: [] }),
    toAdminTaskRecord: (row: TaskPostgresRowShape) => taskRecord({
      id: row.id,
      title: row.title,
      status: row.status === "succeeded" || row.status === "running" || row.status === "failed" || row.status === "cancelled"
        ? row.status
        : "queued",
      logs: [],
      createdAt: 1,
      updatedAt: 1,
    }),
    enrichAdminTaskRecord: (task: TaskRecordShape) => task,
    summarizeAdminTaskRecord: (task: TaskRecordShape): TaskListItemShape => ({
      id: task.id,
      title: task.title,
      status: task.status,
      ownerId: task.ownerId,
      ownerName: task.ownerName,
      ownerEmail: task.ownerEmail,
      ownerRemark: task.ownerRemark,
      ownerGroupId: task.ownerGroupId,
      ownerGroupName: task.ownerGroupName,
      ownerDeleted: task.ownerDeleted,
      providerId: task.providerId,
      modelId: task.modelId,
      displayStatus: task.displayStatus,
      displayMessage: task.displayMessage,
      displayTone: task.displayTone,
      runtimeStage: task.runtimeStage,
      providerState: task.providerState,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }),
    withUnifiedRuntimeDiagnostic: (task: TaskRecordShape) => task,
    safeText: (value: unknown, fallback = "") => typeof value === "string" ? value : fallback,
    plainObject: (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {},
    millisToDate: (value: number | undefined) => new Date(value ?? 0),
    ...overrides,
  } as Parameters<typeof createTaskRepository>[0];
}

describe("task repository", () => {
  it("reads a postgres task list page without selecting task payload result or logs", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("count(*)")) {
        expect(sql).toContain("from xh_tasks");
        expect(sql).toContain("payload->>'taskCapability'");
        expect(params).toEqual(["queued", "provider-1", "image"]);
        return { rows: [{ total: 2 }] };
      }
      expect(sql).toContain("select t.id");
      expect(sql).not.toContain("t.payload");
      expect(sql).not.toContain("t.result");
      expect(sql).not.toContain("t.logs");
      expect(params).toEqual(["queued", "provider-1", "image", 1, 0]);
      return { rows: [{ id: "task-1", title: "Task One", status: "queued" }] };
    });
    const repo = createTaskRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
      summarizeAdminTaskRecord: (task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        displayMessage: task.displayMessage,
      }),
      withUnifiedRuntimeDiagnostic: (task) => ({ ...task, displayMessage: "diagnostic" }),
    }));

    await expect(repo.readTaskListPage({
      page: 1,
      pageSize: 1,
      status: "queued",
      providerId: "provider-1",
      capability: "image",
    })).resolves.toMatchObject({
      items: [{ id: "task-1", title: "Task One", status: "queued", displayMessage: "diagnostic" }],
      total: 2,
      hasMore: true,
    });
  });

  it("reads a postgres task detail with heavy fields by id", async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      expect(sql).toContain("t.payload");
      expect(sql).toContain("t.result");
      expect(sql).toContain("t.logs");
      expect(sql).toContain("where t.id = $1");
      expect(params).toEqual(["task-1"]);
      return { rows: [{ id: "task-1", title: "Task One", status: "queued" }] };
    });
    const repo = createTaskRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
    }));

    await expect(repo.readTaskRecord("task-1")).resolves.toMatchObject({ id: "task-1", title: "Task One" });
  });

  it("writes postgres task records and logs without loading the full admin db", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toMatch(/insert into xh_tasks|update xh_tasks/);
      return { rows: [], rowCount: 1 };
    });
    const readTaskRecords = vi.fn(async () => []);
    const repo = createTaskRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
      readTaskRecords,
    }));

    await repo.insertTaskRecord(taskRecord({ id: "task-1", title: "Task One", payload: { prompt: "hello" }, result: {}, logs: ["created"] }));
    await repo.writeTaskRecord(taskRecord({ id: "task-1", title: "Task One", status: "running", payload: {}, result: {}, logs: ["created"] }));
    await repo.appendTaskLog("task-1", "queued");
    expect(query).toHaveBeenCalledTimes(3);
    expect(readTaskRecords).not.toHaveBeenCalled();
  });

  it("reads a file-backed task list page with filtering sorting enrichment and pagination", async () => {
    const enrichAdminTaskRecord = vi.fn((
      task: TaskRecordShape,
      usersById: Map<string, TaskOwnerRecordShape>,
      groupsById: Map<string, TaskOwnerGroupRecordShape>,
    ) => {
      const owner = task.ownerId ? usersById.get(task.ownerId) : undefined;
      const group = owner?.groupId ? groupsById.get(owner.groupId) : undefined;
      return {
        ...task,
        ownerEmail: owner?.email,
        ownerGroupName: group?.name,
      };
    });
    const repo = createTaskRepository(createDeps({
      readTaskRecords: async () => [
        taskRecord({ id: "task-old", ownerId: "u1", title: "Old", status: "queued", providerId: "provider-1", payload: { taskCapability: "image" }, createdAt: 10, updatedAt: 10 }),
        taskRecord({ id: "task-new", ownerId: "u1", title: "New", status: "queued", providerId: "provider-1", result: { raw: { capability: "image" } }, createdAt: 20, updatedAt: 20 }),
        taskRecord({ id: "task-video", ownerId: "u1", title: "Video", status: "queued", providerId: "provider-1", payload: { taskCapability: "video" }, createdAt: 30, updatedAt: 30 }),
      ],
      readTaskOwnerRecords: async () => ({
        users: [ownerRecord({ id: "u1", email: "owner@example.test", groupId: "g1" })],
        userGroups: [ownerGroupRecord({ id: "g1", name: "Group One" })],
      }),
      enrichAdminTaskRecord,
      summarizeAdminTaskRecord: (task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        ownerEmail: task.ownerEmail,
        ownerGroupName: task.ownerGroupName,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      }),
    }));

    await expect(repo.readTaskListPage({
      page: 2,
      pageSize: 1,
      status: "queued",
      providerId: "provider-1",
      capability: "image",
    })).resolves.toMatchObject({
      items: [{ id: "task-old", ownerEmail: "owner@example.test", ownerGroupName: "Group One" }],
      total: 2,
      hasMore: false,
    });
    expect(enrichAdminTaskRecord).toHaveBeenCalledTimes(2);
  });
});
