import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Overview } from "./admin-overview-panel";
import type { ModelRecord, ProviderRecord, Summary, TaskRecord } from "./admin-types";

describe("Admin overview Foundation pilot", () => {
  it("renders the shell-labelled workspace, key summary, and explicit empty states", () => {
    const markup = renderToStaticMarkup(
      <Overview summary={null} providers={[]} models={[]} tasks={[]} />,
    );

    expect(markup).toContain('class="admin-workspace-frame admin-overview"');
    expect(markup).toContain('aria-labelledby="admin-page-title"');
    expect(markup).toContain('aria-label="运营关键摘要"');
    expect(markup.match(/class="admin-summary-strip__item"/g)).toHaveLength(5);
    expect(markup.match(/class="admin-table-empty"/g)).toHaveLength(3);
    expect(markup).not.toContain("<h1");
  });

  it("keeps source values while adding text-backed semantic status treatment", () => {
    const summary = {
      users: 4,
      enabledUsers: 4,
      providers: 2,
      enabledProviders: 1,
      models: 1,
      enabledModels: 1,
      tasks: 8,
      runningTasks: 1,
      auditLogs: 12,
    } as Summary;
    const providers = [{
      id: "provider-1",
      name: "Provider A",
      baseUrl: "https://example.invalid/a/very/long/path",
      enabled: true,
      hasApiKey: false,
      apiKeyPreview: "",
    }] as ProviderRecord[];
    const models = [{
      id: "model-1",
      providerId: "provider-1",
      displayName: "Model A",
      capability: "chat",
      enabled: false,
    }] as ModelRecord[];
    const tasks = [{
      id: "task-1",
      title: "Task A",
      status: "running",
      modelId: "model-1",
    }] as TaskRecord[];

    const markup = renderToStaticMarkup(
      <Overview summary={summary} providers={providers} models={models} tasks={tasks} />,
    );

    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain('class="status-pill success"');
    expect(markup).toContain('class="status-pill warning"');
    expect(markup).toContain('class="status-pill muted"');
    expect(markup).toContain("启用");
    expect(markup).toContain("未配置");
    expect(markup).toContain("运行中");
    expect(markup).toContain("停用");
  });
});
