import { describe, expect, it } from "vitest";
import type { PermissionSubject } from "@xinghuan/shared";
import {
  createPermissionSubjectRegistrar,
  providerModelSubjectKey,
  resourceItemSubjectKey,
  runningHubAppSubjectKey,
} from "./permission-subject-registrars.js";

function subject(overrides: Partial<PermissionSubject> = {}): PermissionSubject {
  return {
    subjectKey: "provider.model/deleted",
    domain: "provider",
    subjectType: "model",
    parentKeys: ["provider.model/*"],
    sourceId: "model:deleted",
    exposureState: "published",
    displayName: "Deleted model",
    metadata: { managedBy: "first-wave" },
    revision: 1,
    ...overrides,
  };
}

describe("permission subject registrar", () => {
  it("registers all first-wave entries as restricted and retires removed managed entries", async () => {
    const stored = [subject()];
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: async (next) => {
        const index = stored.findIndex((item) => item.subjectKey === next.subjectKey);
        if (index >= 0) stored[index] = next;
        else stored.push(next);
        return next;
      },
      now: () => 100,
    });

    const report = await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [{ id: "cat-a", kind: "image", name: "Images" }],
      resourceItems: [{ id: "asset-a", kind: "image", title: "Cover", categoryId: "cat-a" }],
      runningHubItems: [{ catalogId: "rh-a", kind: "app", title: "Background remover", enabled: true }],
      nodeTypes: [{ type: "image", label: "Image", category: "core" }],
      providerModels: [{ id: "model-a", displayName: "Image Model", capability: "image", enabled: true }],
    });

    expect(report.registered).toBeGreaterThan(5);
    expect(stored.find((item) => item.subjectKey === resourceItemSubjectKey("asset-a"))).toMatchObject({
      exposureState: "restricted",
      parentKeys: ["resource.category/cat-a", "resource.category/*", "resource/*"],
    });
    expect(stored.find((item) => item.subjectKey === runningHubAppSubjectKey("rh-a"))).toMatchObject({
      exposureState: "restricted",
      metadata: expect.objectContaining({ enabled: true }),
    });
    expect(stored.find((item) => item.subjectKey === providerModelSubjectKey("model-a"))).toMatchObject({
      exposureState: "restricted",
    });
    expect(stored.find((item) => item.subjectKey === "provider.model/deleted")).toMatchObject({
      exposureState: "retired",
    });
  });

  it("preserves explicit publication while refreshing source metadata", async () => {
    const stored = [
      subject({
        subjectKey: "runninghub.app/rh-a",
        domain: "runninghub",
        subjectType: "app",
        parentKeys: ["runninghub.app/*"],
        sourceId: "app:rh-a",
        exposureState: "published",
        displayName: "Old title",
      }),
    ];
    const upsert = async (next: PermissionSubject) => {
      const index = stored.findIndex((item) => item.subjectKey === next.subjectKey);
      if (index >= 0) stored[index] = next;
      else stored.push(next);
      return next;
    };
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: upsert,
      now: () => 200,
    });

    await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [],
      resourceItems: [],
      runningHubItems: [{ catalogId: "rh-a", kind: "app", title: "New title", enabled: true }],
      nodeTypes: [],
      providerModels: [],
    });

    expect(stored.find((item) => item.subjectKey === "runninghub.app/rh-a")).toMatchObject({ exposureState: "published", displayName: "New title" });
  });
});
