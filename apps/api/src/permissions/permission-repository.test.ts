import { describe, expect, it, vi } from "vitest";
import {
  createPermissionRepository,
  type PermissionFallbackAuthDb,
} from "./permission-repository.js";

describe("permission repository", () => {
  it("persists virtual ungrouped rules without requiring a user-group row", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repository = createPermissionRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }) as never,
      now: () => 100,
    });

    await repository.upsertRule({
      id: "rule-ungrouped-view",
      principalType: "group",
      principalId: "ungrouped",
      subjectKey: "runninghub.app/example",
      action: "view",
      effect: "allow",
      revision: 1,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into xh_permission_rules"),
      expect.arrayContaining(["ungrouped"]),
    );
  });

  it("normalizes file-backed subjects and rules with inherited parent keys", async () => {
    let db: PermissionFallbackAuthDb = {
      permissionSubjects: [
        {
          subjectKey: "runninghub.app/*",
          domain: "runninghub",
          subjectType: "app-family",
          parentKey: "",
          sourceId: "*",
          exposureState: "published" as const,
          displayName: "RunningHub apps",
          metadata: {},
          revision: 1,
          createdAt: 10,
          updatedAt: 10,
        },
        {
          subjectKey: "runninghub.app/example",
          domain: "runninghub",
          subjectType: "app",
          parentKey: "runninghub.app/*",
          sourceId: "example",
          exposureState: "published" as const,
          displayName: "Example",
          metadata: { provider: "rh" },
          revision: 2,
          createdAt: 20,
          updatedAt: 20,
        },
      ],
      permissionRules: [],
    };
    const repository = createPermissionRepository({
      usePostgresRepository: () => false,
      getPostgresPool: async () => {
        throw new Error("postgres should not be used");
      },
      readAuthDb: async () => db,
      writeAuthDb: async (nextDb) => {
        db = nextDb;
      },
      now: () => 100,
    });

    const state = await repository.readAuthorizationState();

    expect(
      state.subjects.find(
        (item) => item.subjectKey === "runninghub.app/example",
      ),
    ).toMatchObject({
      parentKeys: ["runninghub.app/*"],
      metadata: { provider: "rh" },
    });

    await repository.upsertRule({
      id: "member-deny",
      principalType: "user",
      principalId: "member-1",
      subjectKey: "runninghub.app/example",
      action: "execute",
      effect: "deny",
      revision: 1,
    });

    expect(db.permissionRules).toEqual([
      expect.objectContaining({
        id: "member-deny",
        reason: "",
        createdAt: 100,
        updatedAt: 100,
      }),
    ]);
  });
});
