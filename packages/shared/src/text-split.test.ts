import { describe, expect, it } from "vitest";

import { splitText } from "./text-split.js";

describe("text split", () => {
  it("keeps storyboard headings with their content and applies numbered cleanup", () => {
    expect(splitText("镜头 1：雨夜街道\n霓虹反光\n\n镜头 2：咖啡店\n人物走入", {
      mode: "storyboard",
      stripNumbering: true,
    })).toEqual(["雨夜街道\n霓虹反光", "咖啡店\n人物走入"]);
  });

  it("uses capture groups for regex match mode and falls back safely for malformed patterns", () => {
    expect(splitText("[a] [b]", { mode: "regex", regexPattern: "\\[([^\\]]+)\\]", regexStrategy: "match" })).toEqual(["a", "b"]);
    expect(splitText("first\n\nsecond", { mode: "regex", regexPattern: "[" })).toEqual(["first", "second"]);
  });

  it("chunks text on a soft boundary and renders ordered prefix and suffix templates", () => {
    expect(splitText("第一句。第二句。第三句。", {
      mode: "char-chunk",
      chunkSize: 5,
      prefix: "{{index}}/{{total}}: ",
      suffix: "!",
    })).toEqual(["1/3: 第一句。!", "2/3: 第二句。!", "3/3: 第三句。!"]);
  });
});
