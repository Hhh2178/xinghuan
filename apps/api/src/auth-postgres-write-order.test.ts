import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("PostgreSQL authentication full replace", () => {
  it("restores users before policies that reference updated_by", async () => {
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    const usersRestore = serverSource.indexOf("for (const user of db.users)", serverSource.indexOf("async function writeAuthDbPostgres"));
    const policiesRestore = serverSource.indexOf("for (const policy of db.groupPermissionPolicies)", serverSource.indexOf("async function writeAuthDbPostgres"));

    expect(usersRestore).toBeGreaterThan(-1);
    expect(policiesRestore).toBeGreaterThan(-1);
    expect(usersRestore).toBeLessThan(policiesRestore);
  });

  it("creates a group and its default policy from the same replacement snapshot", async () => {
    const serverSource = await readFile(fileURLToPath(new URL("./server.ts", import.meta.url)), "utf8");
    const routeStart = serverSource.indexOf('if (url.pathname === "/api/admin/user-groups")');
    const postgresBranchStart = serverSource.indexOf("if (usePostgresRepository())", routeStart);
    const postgresBranchEnd = serverSource.indexOf("} else {", postgresBranchStart);
    const createRoute = serverSource.slice(routeStart, postgresBranchEnd);
    const postgresBranch = serverSource.slice(postgresBranchStart, postgresBranchEnd);

    expect(postgresBranch).not.toContain("insertUserGroupPostgres(group)");
    expect(createRoute).toContain("userGroups: [...authDb.userGroups, group]");
    expect(postgresBranch).toContain("writeAuthDb(nextAuthDb");
  });
});
