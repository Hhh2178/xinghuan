import { describe, expect, it } from "vitest";

import { executeDeterministicNode, NATIVE_DETERMINISTIC_NODE_TYPES } from "./index.js";

describe("deterministic Canvas Run nodes", () => {
  it("turns a text node into an explicit downstream binding without a Provider task", () => {
    expect(executeDeterministicNode({
      nodeType: "text",
      configuration: { executionPayload: { prompt: "a rainy street at night" } },
      upstreamOutputs: [],
    })).toEqual({ text: "a rainy street at night", prompt: "a rainy street at night", outputText: "a rainy street at night", textSegments: ["a rainy street at night"] });
  });

  it("keeps material set order and selects exactly one requested downstream input", () => {
    const materialSet = executeDeterministicNode({
      nodeType: "material-set",
      configuration: { executionPayload: { materialSetKind: "image", materialSetItems: [{ kind: "image", url: "/files/output/a.png" }, { kind: "image", url: "/files/output/b.png" }] } },
      upstreamOutputs: [],
    });
    const selected = executeDeterministicNode({
      nodeType: "pick-from-set",
      configuration: { executionPayload: { pickKind: "image", pickIndex: 2 } },
      upstreamOutputs: [materialSet],
    });

    expect(materialSet.imageUrls).toEqual(["/files/output/a.png", "/files/output/b.png"]);
    expect(selected).toMatchObject({ pickedKind: "image", pickedIndex: 2, imageUrls: ["/files/output/b.png"] });
  });

  it("merges relay inputs deterministically and reports invalid picks explicitly", () => {
    expect(executeDeterministicNode({
      nodeType: "relay",
      configuration: { executionPayload: {} },
      upstreamOutputs: [{ prompt: "first" }, { prompt: "second", imageUrls: ["/files/output/a.png"] }],
    })).toMatchObject({ text: "first\n\nsecond", imageUrls: ["/files/output/a.png"] });
    expect(() => executeDeterministicNode({
      nodeType: "pick-from-set",
      configuration: { executionPayload: { pickKind: "video", pickIndex: 1 } },
      upstreamOutputs: [{ imageUrls: ["/files/output/a.png"] }],
    })).toThrow("SET_EMPTY");
  });

  it("splits the locked prompt with the same storyboard semantics used by the canvas editor", () => {
    expect(executeDeterministicNode({
      nodeType: "text-split",
      configuration: {
        executionPayload: {
          sourceText: "镜头 1：雨夜街道\n霓虹反光\n\n镜头 2：咖啡店\n人物走入",
          splitMode: "storyboard",
          stripNumbering: true,
        },
      },
      upstreamOutputs: [],
    })).toMatchObject({
      textSegments: ["雨夜街道\n霓虹反光", "咖啡店\n人物走入"],
      text: "雨夜街道\n霓虹反光\n\n咖啡店\n人物走入",
    });
  });

  it("only declares explicitly implemented deterministic nodes server-native", () => {
    expect(NATIVE_DETERMINISTIC_NODE_TYPES).toEqual(new Set([
      "text",
      "upload",
      "material-set",
      "pick-from-set",
      "relay",
      "output",
      "text-split",
      "workflow-input",
      "workflow-output",
    ]));
  });
});
