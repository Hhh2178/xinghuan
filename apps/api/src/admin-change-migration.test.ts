import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin change revision migration", () => {
  it("creates the revision table and all supported domains", () => {
    const sql = readFileSync(new URL("../db/050_admin_change_revisions.sql", import.meta.url), "utf8");
    expect(sql).toContain("xh_admin_change_revisions");
    for (const domain of ["shell", "providers", "models", "directory", "permissions", "runninghub", "comfyui", "shared-resources", "tasks", "content", "analytics", "system"]) {
      expect(sql).toContain(`'${domain}'`);
    }
  });
});
