import { describe, expect, it } from "vitest";
import { createCanvasPerformanceFixture, createCanvasPerformanceScenarios } from "./canvas-performance-fixtures";

describe("Canvas performance fixtures", () => {
  it("creates stable node and edge identities for every requested size", () => {
    const fixture = createCanvasPerformanceFixture(50);
    expect(fixture.nodes.filter((node) => node.type !== "group")).toHaveLength(50);
    expect(fixture.edges).toHaveLength(49);
    expect(fixture.nodes[0]).toMatchObject({ id: "perf-node-1", type: "text", position: { x: 0, y: 0 } });
    expect(fixture.nodes.at(-1)?.type).toBe("group");
  });

  it("ships only deterministic, bounded scenarios", () => {
    const scenarios = createCanvasPerformanceScenarios();
    expect(scenarios.map((item) => item.name)).toEqual(["canvas-0-nodes", "canvas-50-nodes", "canvas-100-nodes", "canvas-200-nodes"]);
    expect(JSON.stringify(scenarios)).toBe(JSON.stringify(createCanvasPerformanceScenarios()));
  });
});
