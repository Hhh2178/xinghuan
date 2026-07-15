import { describe, expect, it } from "vitest";
import {
  deniedWorkflowNodeTypes,
  filterNodeCatalogByPermissions,
  isNodeTypeAllowed,
} from "./permission-state";

const nodes = [
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "runninghub", label: "RH" },
];

describe("permission state", () => {
  it("omits denied node types without mutating the registry", () => {
    expect(filterNodeCatalogByPermissions(nodes, ["video"])).toEqual([
      nodes[0],
      nodes[2],
    ]);
    expect(nodes).toHaveLength(3);
  });

  it("supports an explicit deny-all compatibility policy", () => {
    expect(filterNodeCatalogByPermissions(nodes, ["*"])).toEqual([]);
  });

  it("applies the same denial to direct add and workflow insertion", () => {
    expect(isNodeTypeAllowed("video", ["video"])).toBe(false);
    expect(isNodeTypeAllowed("image", ["video"])).toBe(true);
    expect(deniedWorkflowNodeTypes(["image", "video", "video"], ["video"])).toEqual(["video"]);
  });
});
