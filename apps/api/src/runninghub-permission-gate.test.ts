import { describe, expect, it } from "vitest";
import { decideRunningHubAccess } from "./runninghub-permission-gate.js";

describe("RunningHub group permission gate", () => {
  const item = { catalogId: "p:workflow:w1", kind: "workflow" as const, providerId: "p", groupId: "g1" };
  const group = { id: "g1", providerId: "p", enabled: true };

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ] as const)("group=%s item=%s -> %s", async (groupAllowed, itemAllowed, expected) => {
    const result = await decideRunningHubAccess({
      item,
      group,
      action: "execute",
      decide: async (subjectKey) => ({
        allowed: subjectKey.startsWith("runninghub.group/") ? groupAllowed : itemAllowed,
        reason: "test",
      }),
    });
    expect(result.allowed).toBe(expected);
  });

  it("disables a group as a hard deny", async () => {
    const result = await decideRunningHubAccess({
      item,
      group: { ...group, enabled: false },
      action: "view",
      decide: async () => ({ allowed: true }),
    });
    expect(result.allowed).toBe(false);
    expect(result.groupDecision?.reason).toBe("group-disabled");
  });
});
