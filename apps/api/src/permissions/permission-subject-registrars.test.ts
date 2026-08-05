import { describe, expect, it } from "vitest";
import type { PermissionSubject } from "@xinghuan/shared";
import {
  createPermissionSubjectRegistrar,
  providerModelSubjectKey,
  resourceItemSubjectKey,
  runningHubGroupSubjectKey,
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
  it("publishes enabled provider models and repairs stale restricted catalog state", async () => {
    const stored = [
      subject({
        subjectKey: "provider.model/model-a",
        sourceId: "model:model-a",
        exposureState: "restricted",
        displayName: "Image Model",
        metadata: { managedBy: "first-wave", capability: "image", enabled: true },
        revision: 4,
      }),
    ];
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: async (next) => {
        const index = stored.findIndex((item) => item.subjectKey === next.subjectKey);
        if (index >= 0) stored[index] = next;
        else stored.push(next);
        return next;
      },
    });

    await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [],
      resourceItems: [],
      runningHubItems: [],
      nodeTypes: [],
      providerModels: [
        { id: "model-a", displayName: "Image Model", capability: "image", enabled: true },
        { id: "model-b", displayName: "Video Model", capability: "video", enabled: true },
      ],
    });

    expect(stored.find((item) => item.subjectKey === providerModelSubjectKey("model-a"))).toMatchObject({
      exposureState: "published",
      revision: 5,
    });
    expect(stored.find((item) => item.subjectKey === providerModelSubjectKey("model-b"))).toMatchObject({
      exposureState: "published",
    });
  });

  it("publishes permission-manageable entries, restricts disabled models, and retires removed managed entries", async () => {
    const stored = [subject()];
    const deletedRuleIds: string[] = [];
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: async (next) => {
        const index = stored.findIndex((item) => item.subjectKey === next.subjectKey);
        if (index >= 0) stored[index] = next;
        else stored.push(next);
        return next;
      },
      deleteRulesForRetiredSubjects: async () => {
        deletedRuleIds.push("legacy-rule");
        return [{ id: "legacy-rule" } as never];
      },
      now: () => 100,
    });

    const report = await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [{ id: "cat-a", kind: "image", name: "Images" }],
      resourceItems: [{ id: "asset-a", kind: "image", title: "Cover", categoryId: "cat-a" }],
      runningHubItems: [{ catalogId: "rh-a", kind: "app", title: "Background remover", enabled: true }],
      runningHubGroups: [{ id: "group-a", providerId: "provider-a", name: "Images", enabled: true }],
      nodeTypes: [{ type: "image", label: "Image", category: "core" }],
      providerModels: [{ id: "model-a", displayName: "Image Model", capability: "image", enabled: true }],
    });

    expect(report.registered).toBeGreaterThan(5);
    expect(stored.find((item) => item.subjectKey === resourceItemSubjectKey("asset-a"))).toMatchObject({
      exposureState: "published",
      parentKeys: ["resource.category/cat-a", "resource.category/*", "resource/*"],
    });
    expect(stored.find((item) => item.subjectKey === runningHubAppSubjectKey("rh-a"))).toMatchObject({
      exposureState: "published",
      metadata: expect.objectContaining({ enabled: true }),
    });
    expect(stored.find((item) => item.subjectKey === runningHubGroupSubjectKey("provider-a", "group-a"))).toMatchObject({
      subjectType: "group",
      exposureState: "published",
    });
    expect(stored.find((item) => item.subjectKey === providerModelSubjectKey("model-a"))).toMatchObject({
      exposureState: "published",
    });
    expect(stored.find((item) => item.subjectKey === "provider.model/deleted")).toMatchObject({
      exposureState: "retired",
    });
    expect(report.rulesDeleted).toBe(1);
    expect(deletedRuleIds).toEqual(["legacy-rule"]);
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

  it("repairs stale restricted resource entries so their child rules are editable", async () => {
    const stored = [subject({
      subjectKey: resourceItemSubjectKey("asset-a"),
      domain: "resource",
      subjectType: "item",
      parentKeys: ["resource/*"],
      sourceId: "item:asset-a",
      exposureState: "restricted",
    })];
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: async (next) => { stored[0] = next; return next; },
    });

    await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [],
      resourceItems: [{ id: "asset-a", kind: "image", title: "Cover" }],
      runningHubItems: [],
      nodeTypes: [],
      providerModels: [],
    });

    expect(stored[0].exposureState).toBe("published");
  });

  it("does not increment revision when postgres jsonb returns metadata keys in a different order", async () => {
    const stored = [
      subject({
        subjectKey: "provider.model/model-a",
        sourceId: "model:model-a",
        displayName: "Image Model",
        metadata: { enabled: true, managedBy: "first-wave", capability: "image" },
        revision: 7,
      }),
    ];
    const upserted: PermissionSubject[] = [];
    const registrar = createPermissionSubjectRegistrar({
      listSubjects: async () => stored,
      upsertSubject: async (next) => {
        upserted.push(next);
        return next;
      },
      now: () => 300,
    });

    await registrar.reconcileFirstWavePermissionSubjects({
      resourceCategories: [],
      resourceItems: [],
      runningHubItems: [],
      nodeTypes: [],
      providerModels: [{ id: "model-a", displayName: "Image Model", capability: "image", enabled: true }],
    });

    expect(upserted.find((item) => item.subjectKey === "provider.model/model-a")).toBeUndefined();
    expect(stored[0].revision).toBe(7);
  });
});
