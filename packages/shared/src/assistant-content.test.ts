import { describe, expect, it } from "vitest";
import {
  ASSISTANT_CONTENT_FORMAT,
  createAssistantContent,
  createAssistantContentStreamFilter,
  normalizeAssistantContent,
} from "./assistant-content.js";

describe("assistant content protocol", () => {
  it("preserves ordinary GFM markdown", () => {
    const markdown = "## Result\n\n- **one**\n- `two`\n\n| A | B |\n| - | - |\n| 1 | 2 |";

    expect(normalizeAssistantContent(markdown)).toBe(markdown);
    expect(createAssistantContent(markdown)).toEqual({
      format: ASSISTANT_CONTENT_FORMAT,
      version: 1,
      text: markdown,
    });
  });

  it("removes reasoning tags and internal channel lines", () => {
    expect(normalizeAssistantContent([
      "analysis: inspect private state",
      "<think>hidden chain of thought</think>",
      "context: internal-only context",
      "## Final\n\nVisible answer.",
    ].join("\n"))).toBe("## Final\n\nVisible answer.");
  });

  it("filters reasoning tags split across chunks without leaking tag prefixes", () => {
    const filter = createAssistantContentStreamFilter();
    const chunks = ["Visible ", "<thi", "nk>secret", "</th", "ink>answer"];
    const output = chunks.map((chunk) => filter.push(chunk)).join("") + filter.finish();

    expect(output).toBe("Visible answer");
  });

  it("suppresses the remainder of an unclosed reasoning block", () => {
    const filter = createAssistantContentStreamFilter();
    const output = filter.push("Final before.<think>never expose") + filter.finish();

    expect(output).toBe("Final before.");
  });

  it("filters internal channel prefixes split across chunks", () => {
    const filter = createAssistantContentStreamFilter();
    const chunks = ["ana", "lysis: hidden", "\nFinal", " answer"];
    const output = chunks.map((chunk) => filter.push(chunk)).join("") + filter.finish();

    expect(output).toBe("Final answer");
  });
});
