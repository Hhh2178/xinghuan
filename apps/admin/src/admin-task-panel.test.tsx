import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TasksPanel } from "./admin-task-panel";
import type { TaskListPage } from "./admin-types";

const dataWorkbenchCss = readFileSync(new URL("./styles/admin-data-workbench.css", import.meta.url), "utf8");

function taskPage(overrides: Partial<TaskListPage> = {}): TaskListPage {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    windowLimit: 2_000,
    windowSize: 0,
    truncated: false,
    filters: { status: "", providerId: "", capability: "" },
    ...overrides,
  };
}

describe("Admin task data workbench", () => {
  it("renders realtime context, current-page summary, controls, and an explicit empty row", () => {
    const markup = renderToStaticMarkup(
      <TasksPanel taskPage={taskPage()} mutate={() => undefined} onQueryChange={() => undefined} />,
    );

    expect(markup).toContain('data-admin-template="data"');
    expect(markup).toContain('data-data-mode="realtime"');
    expect(markup).toContain('class="admin-data-context"');
    expect(markup).toContain('aria-label="当前页任务摘要"');
    expect(markup).toContain("创建任务");
    expect(markup).toContain("筛选任务");
    expect(markup).toContain('colSpan="8"');
    expect(markup).toContain("当前筛选暂无任务");
    expect(markup).toContain("当前第 1 / 1 页");
    expect(markup).not.toContain("<h1");
  });

  it("labels status counts as current-page values and preserves recovery actions", () => {
    const markup = renderToStaticMarkup(
      <TasksPanel
        taskPage={taskPage({
          total: 1,
          windowSize: 1,
          items: [{
            id: "task-1",
            title: "Failed task",
            status: "failed",
            logs: ["upstream failed"],
            updatedAt: 1,
            outputRecoveryAvailable: true,
          }],
        })}
        mutate={() => undefined}
        onQueryChange={() => undefined}
      />,
    );

    expect(markup).toContain("当前页失败");
    expect(markup).toContain("恢复结果");
    expect(markup).toContain("重新生成");
    expect(markup).toContain("upstream failed");
  });

  it("keeps the create command on one line beside a flexible title input", () => {
    expect(dataWorkbenchCss).toMatch(/\.admin-task-controls\s*>\s*\.form-panel:first-child\s+\.form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
    expect(dataWorkbenchCss).toMatch(/\.admin-task-controls\s*>\s*\.form-panel:first-child\s+button\s*\{[^}]*white-space:\s*nowrap/);
  });
});
