import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminSystemHealthDashboard } from "./components/observability/AdminSystemHealthDashboard.js";

describe("Admin system health data workbench", () => {
  it("renders the realtime workbench and preserves observability regions", () => {
    const markup = renderToStaticMarkup(<AdminSystemHealthDashboard system={null} />);

    expect(markup.match(/data-admin-template="data"/g)).toHaveLength(1);
    expect(markup).toContain('data-data-mode="realtime"');
    expect(markup).toContain('aria-label="当前运行态势"');
    expect(markup).toContain("当前无活动告警");
    expect(markup).toContain('aria-label="五个健康领域"');
    expect(markup).toContain("服务执行链路");
    expect(markup).toContain("任务结果趋势");
    expect(markup).toContain("队列与有效容量");
    expect(markup).toContain("活动事件");
    expect(markup).not.toContain("<h1");
  });
});
