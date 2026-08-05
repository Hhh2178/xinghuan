import { describe, expect, it, vi } from "vitest";
import { createAdminDirectoryReadRepository } from "./admin-directory-read-repository.js";

function deps() {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("xh_users") ? [{ id: "u1", email: "u@example.com", name: "U", role: "member", administrator_tier: null, password_hash: "hash", password_cipher: null, group_id: null, remark: "", disabled: false, created_at: 1, updated_at: 2 }] : [],
  }));
  return {
    usePostgresRepository: () => true,
    getPostgresPool: async () => ({ query }),
    readAuthDb: vi.fn(),
    dateToMillis: (value: unknown) => Number(value),
    normalizeAdministratorTier: (role: "admin" | "member", tier: unknown) => role === "admin" ? String(tier || "root") : "member",
    safeText: (value: unknown, fallback = "") => String(value ?? fallback),
    query,
  };
}

describe("admin directory read repository", () => {
  it("reads only the users projection for the users page", async () => {
    const fixture = deps();
    const repo = createAdminDirectoryReadRepository(fixture);
    await expect(repo.readUsers()).resolves.toHaveLength(1);
    expect(fixture.query).toHaveBeenCalledTimes(1);
    expect(fixture.query.mock.calls[0][0]).toContain("from xh_users");
    expect(fixture.query.mock.calls[0][0]).not.toContain("xh_sessions");
  });

  it("keeps file mode as a compatibility fallback", async () => {
    const readAuthDb = vi.fn(async () => ({ userGroups: [{ id: "g1" }] }));
    const repo = createAdminDirectoryReadRepository({ ...deps(), usePostgresRepository: () => false, readAuthDb });
    await expect(repo.readUserGroups()).resolves.toEqual([{ id: "g1" }]);
    expect(readAuthDb).toHaveBeenCalledTimes(1);
  });
});
