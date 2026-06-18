import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { canCancelTask, canRetryTask } from "@xinghuan/shared";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import { statusText, taskTone } from "./admin-view-model";
import type { TaskListPage, TaskRecord } from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

type TaskQuery = Pick<TaskListPage, "page" | "pageSize" | "filters">;

function ownerPrimary(task: TaskRecord) {
  if (task.ownerDeleted) return "已删除账号";
  return task.ownerRemark || task.ownerName || task.ownerEmail || "未知账号";
}

export function TasksPanel(
  { taskPage, mutate, onQueryChange }: { taskPage: TaskListPage; mutate: AdminMutate; onQueryChange: (next: TaskQuery) => void },
) {
  const [title, setTitle] = useState("");
  const providerOptions = Array.from(new Set(taskPage.items.map((task) => String(task.providerId || "").trim()).filter(Boolean))).sort();
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
          {providerOptions.map((providerId) => (
            <option key={providerId} value={providerId}>{providerId}</option>
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
        <thead><tr><th>任务</th><th>状态</th><th>发起账号</th><th>Provider</th><th>模型</th><th>日志</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          {taskPage.items.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td><StatusPill tone={taskTone(task.status)}>{statusText(task.status)}</StatusPill></td>
              <td>
                <div className="task-owner-meta">
                  <strong>{ownerPrimary(task)}</strong>
                  <span>
                    {task.ownerDeleted
                      ? (task.ownerEmail || "未知账号")
                      : [task.ownerEmail, task.ownerGroupName].filter(Boolean).join(" · ") || "-"}
                  </span>
                </div>
              </td>
              <td>{task.providerId || "-"}</td>
              <td>{task.modelId || "-"}</td>
              <td>
                {task.status === "failed" ? (
                  <span>{String(task.result?.failureReason || task.result?.error || task.logs?.slice(-1)[0] || "未知失败")}</span>
                ) : task.status === "cancelled" ? (
                  <span>{String(task.result?.cancellationMessage || task.logs?.slice(-1)[0] || "任务已取消")}</span>
                ) : (
                  <span>{task.logs?.slice(-2).join(" / ") || "-"}</span>
                )}
              </td>
              <td>{new Date(task.updatedAt).toLocaleString()}</td>
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
        <span>共 {taskPage.total} 条，当前第 {taskPage.page} / {pageCount} 页</span>
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
