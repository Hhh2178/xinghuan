import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listCanvases: vi.fn() }));

vi.mock("../services/api", () => ({
  listCanvases: mocks.listCanvases,
  createCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
  renameCanvas: vi.fn(),
}));

import { useCanvasStore } from "./canvas";

describe("canvas store loading", () => {
  beforeEach(() => {
    mocks.listCanvases.mockReset();
    useCanvasStore.setState({ canvases: [], activeId: null, loading: false, error: null, lastLoadedAt: 0, inFlight: null });
  });

  it("merges concurrent canvas list loads", async () => {
    let resolve!: (value: Array<{ id: string; name: string; updatedAt: number }>) => void;
    mocks.listCanvases.mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = useCanvasStore.getState().loadCanvases();
    const second = useCanvasStore.getState().loadCanvases();
    resolve([{ id: "c1", name: "Canvas", updatedAt: 1 }]);
    await Promise.all([first, second]);
    expect(mocks.listCanvases).toHaveBeenCalledTimes(1);
    expect(useCanvasStore.getState().canvases).toHaveLength(1);
  });
});
