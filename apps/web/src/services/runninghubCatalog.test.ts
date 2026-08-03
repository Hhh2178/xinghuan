import { describe, expect, it } from "vitest";
import { groupRunningHubCatalogItems } from "./runninghubCatalog";

const item = (catalogId: string, groupId?: string, groupName?: string) => ({
  catalogId,
  id: catalogId,
  kind: "workflow" as const,
  title: catalogId,
  note: "",
  thumbnail: "",
  enabled: true,
  providerId: "p",
  providerName: "RH",
  providerBaseUrl: "",
  groupId,
  groupName,
  inputSlots: [],
  execution: {} as never,
  pageId: catalogId,
  appId: "",
  workflowId: catalogId,
  runTargetId: catalogId,
  taskCapability: "video" as const,
  workflowJson: "",
  fields: [],
});

describe("RunningHub catalog grouping", () => {
  it("merges by group id and keeps ungrouped last", () => {
    const groups = groupRunningHubCatalogItems([
      item("a", "g1", "视频"),
      item("b"),
      item("c", "g1", "改名"),
      item("d", "g2", "图片"),
    ]);
    expect(groups.map((group) => [group.key, group.label, group.items.map((entry) => entry.catalogId)])).toEqual([
      ["g1", "视频", ["a", "c"]],
      ["g2", "图片", ["d"]],
      ["ungrouped", "未分组", ["b"]],
    ]);
  });
});
