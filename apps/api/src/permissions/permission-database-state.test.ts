import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectPermissionDatabase,
  readPermissionDatabaseState,
} from "./permission-database-state.js";

const pgState = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  end: vi.fn(async () => undefined),
  currentDatabase: "xinghuan_wrong",
}));

vi.mock("pg", () => ({
  Client: class FakeClient {
    connect = pgState.connect;
    end = pgState.end;

    async query(sql: string) {
      if (sql === "select current_database()") {
        return { rows: [{ current_database: pgState.currentDatabase }] };
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    }
  },
}));

afterEach(() => {
  delete process.env.XINGHUAN_DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete process.env.XINGHUAN_EXPECTED_DATABASE_NAME;
  pgState.connect.mockClear();
  pgState.end.mockClear();
  pgState.currentDatabase = "xinghuan_wrong";
});

describe("permission database state", () => {
  it("normalizes permission rows without changing administrator or ungrouped semantics", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("select subject_key")) {
        return {
          rows: [{
            subject_key: " provider.model/model-a ",
            domain: " provider ",
            subject_type: " model ",
            parent_key: " provider.model/* ",
            source_id: " model-a ",
            exposure_state: "published",
            display_name: " Model A ",
            metadata: { providerId: "provider-a" },
            revision: "3",
          }],
        };
      }
      if (sql.startsWith("select id, principal_type")) {
        return {
          rows: [{
            id: " rule-a ",
            principal_type: "user",
            principal_id: " admin-a ",
            subject_key: " provider.model/model-a ",
            action: "execute",
            effect: "allow",
            revision: 2,
          }],
        };
      }
      if (sql === "select id from xh_user_groups order by id") {
        return { rows: [{ id: " group-a " }, { id: " " }] };
      }
      if (sql.startsWith("select id, role, group_id")) {
        return {
          rows: [
            { id: " admin-a ", role: "admin", group_id: null },
            { id: " member-a ", role: "member", group_id: " " },
          ],
        };
      }
      if (sql.startsWith("select group_id, deny")) {
        return {
          rows: [{
            group_id: " group-a ",
            deny: { nodeTypes: [" image ", "image", ""] },
          }],
        };
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    const state = await readPermissionDatabaseState({ query } as never);

    expect(state).toEqual({
      subjects: [{
        subjectKey: "provider.model/model-a",
        domain: "provider",
        subjectType: "model",
        parentKeys: ["provider.model/*"],
        sourceId: "model-a",
        exposureState: "published",
        displayName: "Model A",
        metadata: { providerId: "provider-a" },
        revision: 3,
      }],
      rules: [{
        id: "rule-a",
        principalType: "user",
        principalId: "admin-a",
        subjectKey: "provider.model/model-a",
        action: "execute",
        effect: "allow",
        revision: 2,
      }],
      groupIds: ["group-a"],
      users: [
        { id: "admin-a", role: "admin", groupId: undefined },
        { id: "member-a", role: "member", groupId: undefined },
      ],
      legacyPolicies: [{
        groupId: "group-a",
        deny: {
          sharedResourceCategoryIds: [],
          sharedResourceItemIds: [],
          runningHubAppCatalogIds: [],
          runningHubWorkflowCatalogIds: [],
          nodeTypes: ["image"],
        },
      }],
    });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it("closes the connection and rejects an unexpected database target", async () => {
    process.env.XINGHUAN_DATABASE_URL = "postgres://ignored-by-test";
    process.env.XINGHUAN_EXPECTED_DATABASE_NAME = "xinghuan_expected";

    await expect(connectPermissionDatabase()).rejects.toThrow(
      "DATABASE_TARGET_MISMATCH:xinghuan_wrong",
    );
    expect(pgState.connect).toHaveBeenCalledOnce();
    expect(pgState.end).toHaveBeenCalledOnce();
  });
});
