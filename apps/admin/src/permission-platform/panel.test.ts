import { describe, expect, it } from "vitest";
import type { PermissionSubject } from "./types";
import { filterPermissionSubjects } from "./panel";

function subject(overrides: Partial<PermissionSubject> = {}): PermissionSubject {
  return {
    subjectKey: "provider.model/live",
    domain: "provider",
    subjectType: "model",
    parentKeys: ["provider.model/*"],
    sourceId: "model:live",
    exposureState: "published",
    displayName: "Live model",
    metadata: {},
    revision: 1,
    ...overrides,
  };
}

describe("permission subject list filtering", () => {
  it("hides retired subjects from the default active list", () => {
    const result = filterPermissionSubjects([
      subject(),
      subject({
        subjectKey: "provider.model/retired",
        sourceId: "model:retired",
        displayName: "Retired model",
        exposureState: "retired",
      }),
    ], { domain: "all", query: "", lifecycle: "active" });

    expect(result.map((item) => item.subjectKey)).toEqual(["provider.model/live"]);
  });

  it("keeps retired subjects available in the explicit archive view", () => {
    const result = filterPermissionSubjects([
      subject(),
      subject({
        subjectKey: "provider.model/retired",
        sourceId: "model:retired",
        displayName: "Retired model",
        exposureState: "retired",
      }),
    ], { domain: "all", query: "retired", lifecycle: "retired" });

    expect(result.map((item) => item.subjectKey)).toEqual(["provider.model/retired"]);
  });
});
