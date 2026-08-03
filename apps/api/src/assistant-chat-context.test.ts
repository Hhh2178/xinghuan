import { describe, expect, it } from "vitest";
import { buildAssistantUserMessageContent } from "./assistant-chat-context.js";

describe("buildAssistantUserMessageContent", () => {
  it("sends uploaded images as multimodal image_url parts", () => {
    expect(buildAssistantUserMessageContent("看图", [{ kind: "image", payload: { url: "/files/output/shot.png" } }])).toEqual([
      { type: "text", text: "看图" },
      { type: "image_url", image_url: { url: "/files/output/shot.png", detail: "auto" } },
    ]);
  });

  it("does not turn invalid paths into model image parts", () => {
    expect(buildAssistantUserMessageContent("看图", [{ kind: "image", payload: { url: "C:\\\\tmp\\\\shot.png" } }])).toBe("看图");
  });
});
