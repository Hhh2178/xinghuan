import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { canCancelTask, canRetryTask } from "@xinghuan/shared";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import { statusText, taskTone } from "./admin-view-model";
import type { TaskRecord } from "./admin-types";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

export function TasksPanel({ tasks, mutate }: { tasks: TaskRecord[]; mutate: AdminMutate }) {
  const [title, setTitle] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedCapability, setSelectedCapability] = useState("");
  const providerOptions = Array.from(new Set(tasks.map((task) => String(task.providerId || "").trim()).filter(Boolean))).sort();
  const filteredTasks = tasks.filter((task) => {
    if (selectedStatus && task.status !== selectedStatus) return false;
    if (selectedProvider && task.providerId !== selectedProvider) return false;
    if (selectedCapability) {
      const resultRow = (task.result && typeof task.result === "object" ? task.result : {}) as Record<string, unknown>;
      const rawRow = (resultRow.raw && typeof resultRow.raw === "object" ? resultRow.raw : {}) as Record<string, unknown>;
      const taskCapability = String(task.payload?.taskCapability || resultRow.capability || rawRow.capability || "").trim();
      if (taskCapability !== selectedCapability) return false;
    }
    return true;
  });
  return (
    <section className="panel-stack">
      <FormPanel title="创建任务" icon={PlayCircle}>
        <input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={() => mutate("/api/admin/tasks", { title, status: "queued" })}>创建任务</button>
      </FormPanel>
      <FormPanel title="筛选任务" icon={PlayCircle}>
        <select value={selectedCapability} onChange={(e) => setSelectedCapability(e.target.value)}>
          <option value="">全部能力</option>
          <option value="image">图像</option>
          <option value="video">视频</option>
          <option value="audio">音频</option>
        </select>
        <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
          <option value="">全部 Provider</option>
          {providerOptions.map((providerId) => (
            <option key={providerId} value={providerId}>{providerId}</option>
          ))}
        </select>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="succeeded">succeeded</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </FormPanel>
      <AdminTable title="任务监控">
        <thead><tr><th>任务</th><th>状态</th><th>Provider</th><th>模型</th><th>日志</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          {filteredTasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td><StatusPill tone={taskTone(task.status)}>{statusText(task.status)}</StatusPill></td>
              <td>{task.providerId || "-"}</td>
              <td>{task.modelId || "-"}</td>
              <td>
                {task.status === "failed" ? (
                  <span>{String(task.result?.failureReason || task.result?.error || task.logs?.slice(-1)[0] || "未知失败")}</span>
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
    </section>
  );
}
