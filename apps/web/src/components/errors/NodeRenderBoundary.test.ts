import { describe, expect, it } from "vitest";
import { nodeRenderResetKey } from "./NodeRenderBoundary.js";

describe("node render reset key", () => {
  it("changes only when node identity, type, or data revision changes", () => {
    expect(nodeRenderResetKey({ id: "n1", type: "image", data: { revision: 1 } })).toBe("n1:image:1");
    expect(nodeRenderResetKey({ id: "n1", type: "image", data: { revision: 1, transient: true } })).toBe("n1:image:1");
    expect(nodeRenderResetKey({ id: "n1", type: "image", data: { revision: 2 } })).toBe("n1:image:2");
  });
});
