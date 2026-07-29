import { Activity, Boxes, KeyRound, ScrollText, Users } from "lucide-react";
import { AdminSummaryStrip, AdminWorkspaceFrame, DataTable, StatusPill } from "./admin-common-components";
import { statusText, taskTone, type StatusTone } from "./admin-view-model";
import type { ModelRecord, ProviderRecord, Summary, TaskRecord } from "./admin-types";

function availabilityTone(enabled: number, total: number): StatusTone {
  if (!total) return "muted";
  return enabled === total ? "success" : "warning";
}

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
    { label: "成员", value: summary?.enabledUsers ?? 0, detail: `总数 ${summary?.users ?? 0}`, icon: Users, tone: availabilityTone(summary?.enabledUsers ?? 0, summary?.users ?? 0) },
    { label: "Provider", value: summary?.enabledProviders ?? 0, detail: `总数 ${summary?.providers ?? 0}`, icon: KeyRound, tone: availabilityTone(summary?.enabledProviders ?? 0, summary?.providers ?? 0) },
    { label: "模型", value: summary?.enabledModels ?? 0, detail: `总数 ${summary?.models ?? 0}`, icon: Boxes, tone: availabilityTone(summary?.enabledModels ?? 0, summary?.models ?? 0) },
    { label: "任务", value: summary?.runningTasks ?? 0, detail: `总数 ${summary?.tasks ?? 0}`, icon: Activity, tone: summary?.runningTasks ? "warning" as const : "muted" as const },
    { label: "审计", value: summary?.auditLogs ?? 0, detail: `总数 ${summary?.auditLogs ?? 0}`, icon: ScrollText, tone: "muted" as const },
  ];
  return (
    <AdminWorkspaceFrame className="admin-overview">
      <AdminSummaryStrip label="运营关键摘要" items={cards} />
      <div className="split-grid">
        <DataTable
          title="Provider 状态"
          columns={["名称", "Base URL", "状态", "Key"]}
          rows={providers.map((item) => [
            item.name,
            item.baseUrl || "-",
            <StatusPill tone={item.enabled ? "success" : "muted"}>{item.enabled ? "启用" : "停用"}</StatusPill>,
            <StatusPill tone={item.hasApiKey ? "success" : "warning"}>{item.hasApiKey ? item.apiKeyPreview : "未配置"}</StatusPill>,
          ])}
          emptyLabel="暂无 Provider"
        />
        <DataTable
          title="最近任务"
          columns={["任务", "状态", "模型"]}
          rows={tasks.slice(0, 6).map((item) => [
            item.title,
            <StatusPill tone={taskTone(item.status)}>{statusText(item.status)}</StatusPill>,
            item.modelId || "-",
          ])}
          emptyLabel="暂无最近任务"
        />
      </div>
      <DataTable
        title="模型目录"
        columns={["Provider", "模型", "能力", "状态"]}
        rows={models.map((item) => [
          item.providerId,
          item.displayName,
          item.capability,
          <StatusPill tone={item.enabled ? "success" : "muted"}>{item.enabled ? "启用" : "停用"}</StatusPill>,
        ])}
        emptyLabel="暂无模型"
      />
    </AdminWorkspaceFrame>
  );
}
