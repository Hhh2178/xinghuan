import { Activity, Boxes, KeyRound, ScrollText, Users } from "lucide-react";
import { DataTable } from "./admin-common-components";
import { statusText } from "./admin-view-model";
import type { ModelRecord, ProviderRecord, Summary, TaskRecord } from "./admin-types";

export function Overview({
  summary,
  providers,
  models,
  tasks,
}: {
  summary: Summary | null;
  providers: ProviderRecord[];
  models: ModelRecord[];
  tasks: TaskRecord[];
}) {
  const cards = [
    { label: "成员", value: summary?.enabledUsers ?? 0, total: summary?.users ?? 0, icon: Users },
    { label: "Provider", value: summary?.enabledProviders ?? 0, total: summary?.providers ?? 0, icon: KeyRound },
    { label: "模型", value: summary?.enabledModels ?? 0, total: summary?.models ?? 0, icon: Boxes },
    { label: "任务", value: summary?.runningTasks ?? 0, total: summary?.tasks ?? 0, icon: Activity },
    { label: "审计", value: summary?.auditLogs ?? 0, total: summary?.auditLogs ?? 0, icon: ScrollText },
  ];
  return (
    <section className="panel-stack">
      <div className="metric-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="metric-card" key={card.label}>
              <Icon aria-hidden="true" />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>总数 {card.total}</small>
            </article>
          );
        })}
      </div>
      <div className="split-grid">
        <DataTable
          title="Provider 状态"
          columns={["名称", "Base URL", "状态", "Key"]}
          rows={providers.map((item) => [item.name, item.baseUrl || "-", item.enabled ? "启用" : "停用", item.hasApiKey ? item.apiKeyPreview : "未配置"])}
        />
        <DataTable
          title="最近任务"
          columns={["任务", "状态", "模型"]}
          rows={tasks.slice(0, 6).map((item) => [item.title, statusText(item.status), item.modelId || "-"])}
        />
      </div>
      <DataTable
        title="模型目录"
        columns={["Provider", "模型", "能力", "状态"]}
        rows={models.map((item) => [item.providerId, item.displayName, item.capability, item.enabled ? "启用" : "停用"])}
      />
    </section>
  );
}
