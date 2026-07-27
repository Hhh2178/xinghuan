import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorRecoveryPanel } from "./ErrorRecoveryPanel.js";

describe("ErrorRecoveryPanel", () => {
  it("renders only the safe diagnostic message and recovery actions", () => {
    const markup = renderToStaticMarkup(
      <ErrorRecoveryPanel
        diagnostic={{
          id: "ui-node-renderer-test",
          scope: "node-renderer",
          code: "UI_NODE_RENDERER_ERROR",
          occurredAt: "2026-07-27T00:00:00.000Z",
          recoverable: true,
          userMessage: "此节点暂时无法显示，重试不会修改节点或画布内容。",
        }}
        onRetry={() => undefined}
        onReload={() => undefined}
      />,
    );

    expect(markup).toContain("此节点暂时无法显示");
    expect(markup).toContain("诊断 ID：ui-node-renderer-test");
    expect(markup).toContain("重试");
    expect(markup).toContain("刷新页面");
    expect(markup).not.toContain("secret.example");
  });
});
