import { describe, expect, it } from "vitest";

import { resolveNodeDisplayIdentity } from "./node-display-identity.js";

describe("resolveNodeDisplayIdentity", () => {
  it("uses the catalog label and the final safe id token", () => {
    expect(resolveNodeDisplayIdentity({
      nodeId: "smart-candidate-selector-1784938612965-ydhc",
      nodeType: "smart-candidate-selector",
      catalogLabel: "智能候选选择器",
    })).toEqual({
      label: "智能候选选择器",
      suffix: "ydhc",
      displayName: "智能候选选择器 #ydhc",
    });
  });

  it("prefers a trimmed custom label and bounds the suffix", () => {
    expect(resolveNodeDisplayIdentity({
      nodeId: "image-1784938575967-v3uy!unsafe",
      customLabel: "  人物生成  ",
      catalogLabel: "图像",
    })).toEqual({
      label: "人物生成",
      suffix: "v3uyunsa",
      displayName: "人物生成 #v3uyunsa",
    });
  });

  it("falls back to a bounded safe full id suffix and an unknown label", () => {
    expect(resolveNodeDisplayIdentity({
      nodeId: "legacy@node#123456789-!!!",
    })).toEqual({
      label: "未知节点",
      suffix: "23456789",
      displayName: "未知节点 #23456789",
    });
  });
});
