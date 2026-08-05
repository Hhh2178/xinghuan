import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getModelCatalog: vi.fn() }));

vi.mock("../services/api", () => ({ getModelCatalog: mocks.getModelCatalog }));

import { useModelCatalogStore } from "./modelCatalog";

describe("model catalog store loading", () => {
  beforeEach(() => {
    mocks.getModelCatalog.mockReset();
    useModelCatalogStore.setState({
      catalog: { all: [], chatModels: [], imageModels: [], videoModels: [], audioModels: [] },
      loading: false,
      error: null,
      loaded: false,
      lastLoadedAt: 0,
      inFlight: null,
    });
  });

  it("merges concurrent model catalog loads", async () => {
    let resolve!: (value: Record<string, unknown>) => void;
    mocks.getModelCatalog.mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = useModelCatalogStore.getState().load();
    const second = useModelCatalogStore.getState().load();
    resolve({ all: [{ id: "m1" }] });
    await Promise.all([first, second]);
    expect(mocks.getModelCatalog).toHaveBeenCalledTimes(1);
    expect(useModelCatalogStore.getState().catalog.all).toEqual([{ id: "m1" }]);
  });
});
