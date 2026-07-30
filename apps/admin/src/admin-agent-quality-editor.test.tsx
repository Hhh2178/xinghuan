import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminAgentQualityEditor } from "./admin-agent-quality-editor";

describe("Admin agent quality editor", () => {
  it("only offers publication for the current server environment", () => {
    const markup = renderToStaticMarkup(
      <AdminAgentQualityEditor
        environment="gray"
        value={[{
          id: "quality-v1",
          profileKey: "image-default",
          version: 1,
          status: "approved",
          mediaKind: "image",
          minimumOverallScore: 75,
          minimumConfidence: 0.7,
          instructions: "evaluate",
          weights: { technical: 0.3, semantic: 0.3, aesthetic: 0.25, safety: 0.15 },
          publications: [],
        }]}
        busy={false}
        mutate={async () => undefined}
        onDirtyChange={vi.fn()}
      />,
    );

    expect(markup).toContain("发布 Gray");
    expect(markup).not.toContain("发布 Production");
  });
});
