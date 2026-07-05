import { describe, expect, it, vi } from "vitest";
import { createAdminUsageSummaryRepository } from "./admin-usage-summary-repository.js";

function createDeps(overrides: Partial<Parameters<typeof createAdminUsageSummaryRepository>[0]> = {}) {
  return {
    readAdminDb: vi.fn(async () => ({ tasks: [], providers: [], models: [] })),
    readAuthDb: vi.fn(async () => ({ users: [], userGroups: [] })),
    usePostgresRepository: () => false,
    getPostgresPool: async () => {
      throw new Error("not used");
    },
    millisToDate: (value: number) => new Date(value),
    dateToMillis: (value: unknown) => value instanceof Date ? value.getTime() : Number(value) || 0,
    normalizeTaskStatus: (value: unknown) => String(value || "queued"),
    safeText: (value: unknown, fallback = "") => String(value || fallback),
    plainObject: (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {},
    ...overrides,
  } as Parameters<typeof createAdminUsageSummaryRepository>[0];
}

describe("admin usage summary repository", () => {
  it("uses postgres usage queries without loading the full admin db", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).not.toContain("select id, name, base_url");
      expect(sql).not.toContain("from xh_audit_logs");
      if (sql.includes("from xh_tasks")) {
        expect(sql).toContain("where t.status = 'succeeded'");
        expect(sql).not.toContain("t.payload,");
        expect(sql).not.toContain("t.result,");
        expect(sql).toContain("jsonb_build_object");
        return {
          rows: [{
            id: "task-1",
            status: "succeeded",
            owner_id: "user-1",
            provider_id: "provider-1",
            provider_name: "Provider One",
            model_id: "model-record-1",
            model_record_id: "model-record-1",
            model_native_id: "image-model",
            model_display_name: "Image Model",
            payload: { taskCapability: "image" },
            result: {},
            created_at: new Date("2026-07-04T00:00:00.000Z"),
            owner_name: "User One",
            owner_email: "user@example.test",
            owner_group_id: "group-1",
            owner_group_name: "Group One",
            owner_deleted: false,
          }],
        };
      }
      if (sql.includes("from xh_user_groups")) return { rows: [{ id: "group-1", member_count: 1 }] };
      if (sql.includes("from xh_users where group_id is null")) return { rows: [{ member_count: 0 }] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const readAdminDb = vi.fn(async () => ({ tasks: [], providers: [], models: [] }));
    const repo = createAdminUsageSummaryRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
      readAdminDb,
    }));

    const result = await repo.readAdminUsageSummaryRecords({
      from: Date.parse("2026-07-01T00:00:00.000Z"),
      to: Date.parse("2026-07-05T00:00:00.000Z"),
    });

    expect(readAdminDb).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(3);
    expect(result.groupMemberCounts.get("group-1")).toBe(1);
    expect(result.tasks[0]).toMatchObject({
      id: "task-1",
      providerId: "provider-1",
      providerName: "Provider One",
      modelId: "image-model",
      modelRecordId: "model-record-1",
      modelDisplayName: "Image Model",
      ownerGroupId: "group-1",
      ownerGroupName: "Group One",
    });
  });
});
