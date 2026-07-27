export interface CanvasPerformanceNode {
  id: string;
  type: "text" | "image" | "video" | "output" | "group";
  position: { x: number; y: number };
  data: { fixture: true; index: number; runtimeProjection?: { status: "idle" | "running" | "succeeded" } };
}

export interface CanvasPerformanceFixture {
  name: string;
  nodes: CanvasPerformanceNode[];
  edges: Array<{ id: string; source: string; target: string }>;
}

export function createCanvasPerformanceFixture(count: number): CanvasPerformanceFixture {
  const size = Math.max(0, Math.floor(count));
  const nodes: CanvasPerformanceNode[] = Array.from({ length: size }, (_, index) => ({
    id: `perf-node-${index + 1}`,
    type: index % 4 === 0 ? "text" : index % 4 === 1 ? "image" : index % 4 === 2 ? "video" : "output",
    position: { x: (index % 10) * 260, y: Math.floor(index / 10) * 180 },
    data: { fixture: true, index, runtimeProjection: { status: index % 7 === 0 ? "running" : "idle" } },
  }));
  const groups = Math.floor(size / 25);
  for (let index = 0; index < groups; index += 1) {
    nodes.push({
      id: `perf-group-${index + 1}`,
      type: "group",
      position: { x: (index % 4) * 700, y: Math.floor(index / 4) * 900 },
      data: { fixture: true, index: size + index },
    });
  }
  const edges = Array.from({ length: Math.max(0, size - 1) }, (_, index) => ({
    id: `perf-edge-${index + 1}`,
    source: `perf-node-${index + 1}`,
    target: `perf-node-${index + 2}`,
  }));
  return { name: `canvas-${size}-nodes`, nodes, edges };
}

export function createCanvasPerformanceScenarios() {
  return [0, 50, 100, 200].map(createCanvasPerformanceFixture);
}
