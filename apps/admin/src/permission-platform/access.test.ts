import { describe, expect, it } from "vitest";
import type { PermissionDecision, PermissionSubject } from "./types";
import { nextScopedEffect, scopedAccessState } from "./access";

const modelSubject: PermissionSubject = {
  subjectKey: "provider.model/example",
  domain: "provider",
  subjectType: "model",
  parentKeys: ["provider.model/*"],
  sourceId: "example",
  exposureState: "published",
  displayName: "Example",
  metadata: {},
  revision: 1,
};

function decisions(view: boolean, execute: boolean): Record<string, PermissionDecision> {
  return {
    [`${modelSubject.subjectKey}\u0000view`]: {
      subjectKey: modelSubject.subjectKey,
      action: "view",
      allowed: view,
      reason: "group-rule",
    },
    [`${modelSubject.subjectKey}\u0000execute`]: {
      subjectKey: modelSubject.subjectKey,
      action: "execute",
      allowed: execute,
      reason: "group-rule",
    },
  };
}

describe("scoped permission access", () => {
  it("toggles the selected principal instead of global subject exposure", () => {
    expect(scopedAccessState(modelSubject, decisions(false, false))).toBe("denied");
    expect(nextScopedEffect("denied")).toBe("allow");
    expect(scopedAccessState(modelSubject, decisions(true, true))).toBe("allowed");
    expect(nextScopedEffect("allowed")).toBe("deny");
  });

  it("reports partial rules without pretending the principal is fully enabled", () => {
    expect(scopedAccessState(modelSubject, decisions(true, false))).toBe("partial");
    expect(nextScopedEffect("partial")).toBe("allow");
  });

  it("does not present account rules as an override for a globally restricted subject", () => {
    expect(scopedAccessState(
      { ...modelSubject, exposureState: "restricted" },
      decisions(true, true),
    )).toBe("global-restricted");
  });
});
