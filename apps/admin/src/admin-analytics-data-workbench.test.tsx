import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminChannelHealthDashboard } from "./admin-channel-health-dashboard.js";
import { AdminCostDashboard } from "./admin-cost-dashboard.js";
import { AuditPanel } from "./admin-readonly-panels.js";
import { AdminUsageDashboard } from "./admin-usage-dashboard.js";

const usageSource = readFileSync(new URL("./admin-usage-dashboard.tsx", import.meta.url), "utf8");
const costSource = readFileSync(new URL("./admin-cost-dashboard.tsx", import.meta.url), "utf8");
const channelSource = readFileSync(new URL("./admin-channel-health-dashboard.tsx", import.meta.url), "utf8");
const readonlySource = readFileSync(new URL("./admin-readonly-panels.tsx", import.meta.url), "utf8");

const usageProps = {
  usageSummary: null,
  usageSummaryLoading: true,
  usageSummaryError: "用量统计失败",
  usageFilters: { range: "30d" as const, groupId: "", capability: "" as const, providerId: "" },
  selectedUsageUserId: "",
  users: [],
  userGroups: [],
  providers: [],
  onUsageFiltersChange: () => undefined,
  onSelectedUsageUserIdChange: () => undefined,
};

function expectAnalyticsWorkbench(markup: string) {
  expect([...markup.matchAll(/data-admin-template="data"/g)]).toHaveLength(1);
  expect(markup).toContain('data-data-mode="analytics"');
  expect(markup).toContain('class="admin-data-context');
  expect(markup).not.toContain("<h1");
}

describe("Admin analytics data workbenches", () => {
  it("renders usage loading and error states inside the shared analytics context", () => {
    const markup = renderToStaticMarkup(<AdminUsageDashboard {...usageProps} />);

    expectAnalyticsWorkbench(markup);
    expect(markup).toContain("正在加载成功用量统计...");
    expect(markup).toContain("用量统计失败");
  });

  it("renders the cost CNY loading shell inside the shared analytics context", () => {
    const markup = renderToStaticMarkup(<AdminCostDashboard users={[]} userGroups={[]} providers={[]} models={[]} />);

    expectAnalyticsWorkbench(markup);
    expect(markup).toContain("正在汇总费用...");
    expect(markup).toContain("人民币（CNY）");
  });

  it("renders reliability filters and an explicit initial empty state", () => {
    const markup = renderToStaticMarkup(<AdminChannelHealthDashboard />);

    expectAnalyticsWorkbench(markup);
    expect(markup).toContain('aria-label="渠道健康筛选"');
    expect(markup).toContain("等待渠道健康数据");
  });

  it("renders the seven-column audit empty state inside the shared analytics context", () => {
    const markup = renderToStaticMarkup(
      <AuditPanel
        activeView="audit"
        auditLogs={[]}
        {...usageProps}
        models={[]}
      />,
    );

    expectAnalyticsWorkbench(markup);
    expect(markup).toContain("操作者");
    expect(markup).toContain("请求");
    expect(markup).toContain("来源");
    expect(markup).toContain("暂无审计记录");
  });

  it("preserves request, filter, stale-data, and raw audit ownership", () => {
    expect(usageSource).toContain("onUsageFiltersChange");
    expect(usageSource).toContain("onSelectedUsageUserIdChange");
    expect(costSource).toContain('currency: "CNY"');
    expect(costSource).toContain("active && setSummary(result)");
    expect(costSource).toContain("不会使用当前价格反向补算");
    expect(channelSource).toContain('useRef("")');
    expect(channelSource).toContain("setStale(Boolean(reportRef.current))");
    expect(channelSource).toContain("useState(false)");
    expect(channelSource).toContain("document.visibilityState");
    expect(readonlySource).toContain('columns={["时间", "操作者", "动作", "对象", "请求", "来源", "说明"]}');
  });
});
