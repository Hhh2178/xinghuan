import { describe, expect, it } from "vitest";
import type { RhCatalogGroup, RhCatalogItem } from "./runninghub.js";

describe("RunningHub catalog groups", () => {
  it("keeps group identity independent from catalog identity", () => {
    const group: RhCatalogGroup = {
      id: "rhg-video",
      providerId: "runninghub",
      name: "视频生成",
      description: "",
      enabled: true,
      sortOrder: 10,
      createdAt: 1,
      updatedAt: 1,
    };
    const item = { catalogId: "runninghub:workflow:wf-1", groupId: group.id, groupName: group.name } as RhCatalogItem;
    expect(item.catalogId).toBe("runninghub:workflow:wf-1");
    expect(item.groupId).toBe("rhg-video");
  });
});
