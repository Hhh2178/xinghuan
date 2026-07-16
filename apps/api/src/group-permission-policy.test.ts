import { describe, expect, it } from "vitest";

import { buildEffectivePermissions, policyForUser } from "./group-permission-policy.js";

const member = { id: "member-a", role: "member" as const, groupId: "new-group" };

describe("group permission defaults", () => {
  it("keeps a new or missing group open until an administrator adds denies", () => {
    expect(policyForUser(member, [])?.deny).toEqual({
      sharedResourceCategoryIds: [],
      sharedResourceItemIds: [],
      runningHubAppCatalogIds: [],
      runningHubWorkflowCatalogIds: [],
      nodeTypes: [],
    });
    expect(buildEffectivePermissions(member, []).deny.nodeTypes).toEqual([]);
  });
});
