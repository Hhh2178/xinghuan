import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "./assistant-markdown.js";

describe("AssistantMarkdown", () => {
  it("renders GFM without executing or preserving raw HTML", () => {
    const html = renderToStaticMarkup(
      <AssistantMarkdown markdown={'## Result\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<img src=x onerror="alert(1)">'} />,
    );

    expect(html).toContain("<h3>Result</h3>");
    expect(html).toContain("<table>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("blocks dangerous links and hardens external links", () => {
    const html = renderToStaticMarkup(
      <AssistantMarkdown markdown={'[bad](javascript:alert(1)) [good](https://example.com/path)'} />,
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("replaces remote images with accessible text", () => {
    const html = renderToStaticMarkup(
      <AssistantMarkdown markdown={'![private diagram](https://example.com/private.png)'} />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("private diagram");
  });

  it("restricts heading levels to panel semantics", () => {
    const html = renderToStaticMarkup(<AssistantMarkdown markdown={'# One\n\n###### Six'} />);

    expect(html).not.toContain("<h1>");
    expect(html).not.toContain("<h6>");
    expect(html).toContain("<h3>One</h3>");
    expect(html).toContain("<h5>Six</h5>");
  });

  it("adds opt-in copy controls only to reusable semantic blocks", () => {
    const html = renderToStaticMarkup(<AssistantMarkdown copyableBlocks markdown={'Plain paragraph.\n\n1. First\n2. Second\n\n```json\n{"ok":true}\n```'} />);

    expect(html.match(/aria-label="复制此块"/g)).toHaveLength(2);
    expect(html).toContain('data-kind="steps"');
    expect(html).toContain('data-kind="code"');
  });
});
