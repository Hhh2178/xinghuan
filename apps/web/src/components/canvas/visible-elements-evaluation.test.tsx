import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getNodesBounds, getNodesInside, isEdgeVisible, type InternalNodeBase, type NodeBase } from "@xyflow/system";

type EvaluationNode = NodeBase<{ runtimeStage?: string; progress?: string }>;

function internalNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<Pick<EvaluationNode, "parentId" | "selected">> = {},
): InternalNodeBase<EvaluationNode> {
  const userNode: EvaluationNode = {
    id,
    position: { x, y },
    data: {},
    type: "default",
    ...options,
  };
  return {
    ...userNode,
    measured: { width, height },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode,
      handleBounds: { source: [], target: [] },
    },
  };
}

describe("Canvas visibility rendering evaluation", () => {
  it("keeps grouped off-screen nodes, connected edges, selection, fit-view and runtime projection coherent", () => {
    const group = internalNode("group", 0, 0, 1_400, 700);
    const near = internalNode("near", 100, 100, 180, 120);
    const far = internalNode("far", 1_180, 100, 180, 120, { parentId: "group", selected: true });
    const farChild = internalNode("far-child", 1_300, 300, 120, 90, { parentId: "group" });
    const nodes = new Map([group, near, far, farChild].map((node) => [node.id, node] as const));
    const viewport = { x: 0, y: 0, width: 800, height: 600 };
    const transform: [number, number, number] = [0, 0, 1];

    const visibleIds = getNodesInside(nodes, viewport, transform, true).map((node) => node.id);
    expect(visibleIds).toEqual(["group", "near"]);
    expect(far.selected).toBe(true);

    expect(isEdgeVisible({ sourceNode: near, targetNode: far, width: viewport.width, height: viewport.height, transform })).toBe(true);
    expect(isEdgeVisible({ sourceNode: far, targetNode: farChild, width: viewport.width, height: viewport.height, transform })).toBe(false);

    const fitBounds = getNodesBounds([...nodes.values()]);
    expect(fitBounds).toEqual({ x: 0, y: 0, width: 1_420, height: 700 });

    const projected = [...nodes.values()].map((node) => node.id === "far"
      ? { ...node, data: { ...node.data, runtimeStage: "polling", progress: "45%" } }
      : node);
    expect(projected.find((node) => node.id === "far")?.data).toMatchObject({ runtimeStage: "polling", progress: "45%" });
    expect(visibleIds).not.toContain("far");
  });

  it("keeps React Flow visibility pruning disabled until the above invariants have a renderer-level proof", async () => {
    const source = await readFile(new URL("../Canvas.tsx", import.meta.url), "utf8");
    const regionSource = await readFile(new URL("./WorkflowRegionLayer.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("onlyRenderVisibleElements");
    expect(regionSource).toContain("<ViewportPortal>");
    expect(regionSource).toContain("workflows.map");
  });
});
