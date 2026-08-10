import { describe, expect, it } from "vitest";
import { adminMutationDomains } from "./admin-query-keys";

describe("admin mutation domains", () => {
  it("invalidates only related domains", () => {
    expect(adminMutationDomains("/api/admin/providers/p1")).toEqual(["providers", "models", "shell"]);
    expect(adminMutationDomains("/api/admin/tasks/t1")).toEqual(["tasks", "shell"]);
    expect(adminMutationDomains("/api/shared-resources/items/r1")).toEqual(["sharedResources", "permissions", "shell"]);
  });
});
