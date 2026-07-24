import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { canCancelTask, canRetryTask } from "@xinghuan/shared";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import { taskDisplayTone, taskStatusText } from "./admin-view-model";
import type { TaskListPage, TaskRecord } from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

type TaskQuery = Pick<TaskListPage, "page" | "pageSize" | "filters">;

function ownerPrimary(task: TaskRecord) {
  if (task.ownerDeleted) return "已删除账号";
  return task.ownerRemark || task.ownerName || task.ownerEmail || "未知账号";
}

function taskMessage(task: TaskRecord) {
  const logs = Array.isArray(task.logs) ? task.logs.map((line) => String(line).trim()).filter(Boolean) : [];
  return logs.length > 0 ? logs.join("\n") : task.displayMessage || "-";
}

function finalStatusTime(task: TaskRecord) {
  return task.finalizedAt ? new Date(task.finalizedAt).toLocaleString() : "--";
}

function TaskIdentityCell({ primary, secondary, title }: { primary: string; secondary: string; title: string }) {
  return <span className="task-monitor-identity" title={title}><strong>{primary || "-"}</strong>{secondary && secondary !== primary ? <small>{secondary}</small> : null}</span>;
}

export function TasksPanel(
  { taskPage, mutate, onQueryChange }: { taskPage: TaskListPage; mutate: AdminMutate; onQueryChange: (next: TaskQuery) => void },
) {
  const [title, setTitle] = useState("");
  const providerOptions = Array.from(taskPage.items.reduce((options, task) => {
    const value = String(task.providerId || "").trim();
    if (value && !options.has(value)) options.set(value, String(task.providerName || value).trim());
    return options;
  }, new Map<string, string>())).map(([value, label]) => ({ value, label })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  const pageCount = Math.max(1, Math.ceil(taskPage.total / taskPage.pageSize));
  return (
    <section className="panel-stack">
      <FormPanel title="创建任务" icon={PlayCircle}>
        <input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={() => mutate("/api/admin/tasks", { title, status: "queued" })}>创建任务</button>
      </FormPanel>
      <FormPanel title="筛选任务" icon={PlayCircle}>
        <select
          value={taskPage.filters.capability}
          onChange={(e) => onQueryChange({ page: 1, pageSize: taskPage.pageSize, filters: { ...taskPage.filters, capability: e.target.value } })}
        >
          <option value="">全部能力</option>
          <option value="image">图像</option>
          <option value="video">视频</option>
          <option value="audio">音频</option>
        </select>
        <select
          value={taskPage.filters.providerId}
          onChange={(e) => onQueryChange({ page: 1, pageSize: taskPage.pageSize, filters: { ...taskPage.filters, providerId: e.target.value } })}
        >
          <option value="">全部 Provider</option>
          {providerOptions.map((providerOption) => (
            <option key={providerOption.value} value={providerOption.value}>{providerOption.label}</option>
          ))}
        </select>
        <select
          value={taskPage.filters.status}
          onChange={(e) => onQueryChange({ page: 1, pageSize: taskPage.pageSize, filters: { ...taskPage.filters, status: e.target.value } })}
        >
          <option value="">全部状态</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="succeeded">succeeded</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select
          value={String(taskPage.pageSize)}
          onChange={(e) => onQueryChange({ page: 1, pageSize: Number(e.target.value) || 20, filters: taskPage.filters })}
        >
          <option value="10">10 / 页</option>
          <option value="20">20 / 页</option>
          <option value="50">50 / 页</option>
        </select>
      </FormPanel>
      <AdminTable title="任务监控">
        <thead><tr><th>任务</th><th>状态</th><th>最终状态时间</th><th>发起账号</th><th>Provider</th><th>模型</th><th>日志</th><th>操作</th></tr></thead>
        <tbody>
          {taskPage.items.map((task) => (
            <tr key={task.id} className="task-monitor-row">
              <td><span className="task-monitor-cell" title={task.title}>{task.title}</span></td>
              <td><StatusPill tone={taskDisplayTone(task)}>{taskStatusText(task)}</StatusPill></td>
              <td><span className="task-monitor-cell task-monitor-cell--time" title={task.finalizedAt ? new Date(task.finalizedAt).toLocaleString() : "任务尚未结束"}>{finalStatusTime(task)}</span></td>
              <td><span className="task-monitor-cell" title={ownerPrimary(task)}>{ownerPrimary(task)}</span></td>
              <td><TaskIdentityCell primary={task.providerName || task.providerId || ""} secondary={task.providerId || ""} title={[task.providerName, task.providerId].filter(Boolean).join(" · ") || "-"} /></td>
              <td><TaskIdentityCell primary={task.modelName || task.providerModelId || task.modelId || ""} secondary={task.providerModelId || task.modelId || ""} title={[task.modelName, task.providerModelId, task.modelId].filter(Boolean).join(" · ") || "-"} /></td>
              <td><pre className="task-monitor-log">{taskMessage(task)}</pre></td>
              <td>
                {canCancelTask(task.status) ? (
                  <button type="button" onClick={() => mutate(`/api/admin/tasks/${task.id}`, { action: "cancel" }, "PATCH")}>
                    取消
                  </button>
                ) : canRetryTask(task.status) ? (
                  <button type="button" onClick={() => mutate(`/api/admin/tasks/${task.id}/retry`, {}, "POST")}>
                    重试
                  </button>
                ) : (
                  <span>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
      <div className="table-toolbar">
        <span>{taskPage.truncated ? "仅显示最近 2,000 条任务记录" : `显示全部 ${taskPage.windowSize} 条最近任务`}，当前第 {taskPage.page} / {pageCount} 页</span>
        <div className="row-actions">
          <button
            type="button"
            disabled={taskPage.page <= 1}
            onClick={() => onQueryChange({ page: taskPage.page - 1, pageSize: taskPage.pageSize, filters: taskPage.filters })}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={!taskPage.hasMore}
            onClick={() => onQueryChange({ page: taskPage.page + 1, pageSize: taskPage.pageSize, filters: taskPage.filters })}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
