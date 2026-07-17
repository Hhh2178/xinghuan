import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("PostgreSQL authentication writes", () => {
  it("does not expose a runtime full-replace implementation", async () => {
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    expect(serverSource).not.toContain("async function writeAuthDbPostgres");
    expect(serverSource).not.toContain("async function writeAdminDbPostgres");
    expect(serverSource).not.toContain('await client.query("delete from xh_users")');
    expect(serverSource).not.toContain('await client.query("delete from xh_tasks")');
  });

  it("creates a group and its default policy through the targeted repository", async () => {
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    const routeStart = serverSource.indexOf('if (url.pathname === "/api/admin/user-groups")');
    const postgresBranchStart = serverSource.indexOf("if (usePostgresRepository())", routeStart);
    const postgresBranchEnd = serverSource.indexOf("} else {", postgresBranchStart);
    const createRoute = serverSource.slice(routeStart, postgresBranchEnd);
    const postgresBranch = serverSource.slice(postgresBranchStart, postgresBranchEnd);

    expect(createRoute).toContain("userGroups: [...authDb.userGroups, group]");
    expect(postgresBranch).toContain("authDirectoryWriteRepository.createUserGroupWithPolicy");
    expect(postgresBranch).not.toContain("writeAuthDb(");
  });
});
