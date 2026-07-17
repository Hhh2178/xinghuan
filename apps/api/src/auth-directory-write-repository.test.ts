import { describe, expect, it, vi } from "vitest";

import { createAuthDirectoryWriteRepository } from "./auth-directory-write-repository.js";

function repositoryHarness() {
  const query = vi.fn(async (_statement: string, _params?: unknown[]) => ({ rows: [], rowCount: 1 }));
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  const repository = createAuthDirectoryWriteRepository({
    getPostgresPool: async () => ({ connect, query } as any),
  });
  return { repository, query, release };
}

describe("auth directory write repository", () => {
  it("creates a group and its default policy without replacing users", async () => {
    const { repository, query, release } = repositoryHarness();

    await repository.createUserGroupWithPolicy(
      { id: "group-a", name: "Group A", description: "", sortOrder: 1, createdAt: 10, updatedAt: 10 },
      { groupId: "group-a", deny: { nodeTypes: [] }, updatedBy: "admin-a", updatedAt: 10 },
    );

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("insert into xh_user_groups");
    expect(sql).toContain("insert into xh_group_permission_policies");
    expect(sql).not.toContain("delete from xh_users");
    expect(release).toHaveBeenCalledOnce();
  });

  it("upserts one group policy without replacing users or sessions", async () => {
    const { repository, query } = repositoryHarness();

    await repository.upsertGroupPermissionPolicy({
      groupId: "group-a",
      deny: { nodeTypes: ["code"] },
      updatedBy: "admin-a",
      updatedAt: 20,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("on conflict (group_id) do update");
    expect(sql).not.toMatch(/delete from xh_(users|sessions|canvases|assets|projects)/);
  });
});
