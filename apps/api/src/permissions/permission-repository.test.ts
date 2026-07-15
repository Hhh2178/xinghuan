import { describe, expect, it, vi } from "vitest";
import {
  createPermissionRepository,
  type PermissionFallbackAuthDb,
} from "./permission-repository.js";

describe("permission repository", () => {
  it("persists virtual ungrouped rules without requiring a user-group row", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "rule-ungrouped-view" }] }));
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
      expect.stringMatching(
        /insert into xh_permission_rules[\s\S]*where xh_permission_rules\.revision = excluded\.revision - 1[\s\S]*returning id/,
      ),
      expect.arrayContaining(["ungrouped"]),
    );
  });

  it("rejects a stale PostgreSQL subject revision atomically", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repository = createPermissionRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }) as never,
      now: () => 100,
    });

    await expect(
      repository.upsertSubject({
        subjectKey: "runninghub.app/example",
        domain: "runninghub",
        subjectType: "app",
        parentKeys: ["runninghub.app/*"],
        sourceId: "app:example",
        exposureState: "published",
        displayName: "Example",
        metadata: {},
        revision: 2,
      }),
    ).rejects.toThrow("PERMISSION_SUBJECT_REVISION_CONFLICT");

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(
        /where xh_permission_subjects\.revision = excluded\.revision - 1[\s\S]*metadata is not distinct from excluded\.metadata[\s\S]*returning subject_key/,
      ),
      expect.any(Array),
    );
  });

  it("allows an idempotent concurrent PostgreSQL subject registration", async () => {
    const query = vi.fn(async () => ({ rows: [{ subject_key: "canvas.node/image" }] }));
    const repository = createPermissionRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }) as never,
      now: () => 100,
    });

    await expect(repository.upsertSubject({
      subjectKey: "canvas.node/image",
      domain: "canvas",
      subjectType: "node",
      parentKeys: ["canvas.node/*"],
      sourceId: "node:image",
      exposureState: "restricted",
      displayName: "Image",
      metadata: { managedBy: "first-wave" },
      revision: 1,
    })).resolves.toMatchObject({ subjectKey: "canvas.node/image", revision: 1 });
  });

  it("rejects a stale PostgreSQL rule revision atomically", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repository = createPermissionRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }) as never,
      now: () => 100,
    });

    await expect(
      repository.upsertRule({
        id: "rule-1",
        principalType: "group",
        principalId: "group-a",
        subjectKey: "runninghub.app/example",
        action: "view",
        effect: "deny",
        revision: 2,
      }),
    ).rejects.toThrow("PERMISSION_RULE_REVISION_CONFLICT");
  });

  it("rejects a stale PostgreSQL rule deletion atomically", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repository = createPermissionRepository({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query }) as never,
      now: () => 100,
    });

    await expect(repository.deleteRule("rule-1", 2)).rejects.toThrow(
      "PERMISSION_RULE_REVISION_CONFLICT",
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/delete from xh_permission_rules[\s\S]*revision = \$2[\s\S]*returning id/),
      ["rule-1", 2],
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
