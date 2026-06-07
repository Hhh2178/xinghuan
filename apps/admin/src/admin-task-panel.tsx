import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { canCancelTask, canRetryTask } from "@xinghuan/shared";
import { AdminTable, FormPanel, StatusPill } from "./admin-common-components";
import { statusText, taskTone } from "./admin-view-model";
import type { TaskRecord } from "./main";

type AdminMutate = (path: string, payload: Record<string, unknown>, method?: string) => void;

export function TasksPanel({ tasks, mutate }: { tasks: TaskRecord[]; mutate: AdminMutate }) {
  const [title, setTitle] = useState("");
  return (
    <section className="panel-stack">
      <FormPanel title="创建测试任务" icon={PlayCircle}>
        <input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" onClick={() => mutate("/api/admin/tasks", { title, status: "queued" })}>创建任务</button>
      </FormPanel>
      <AdminTable title="任务监控">
        <thead><tr><th>任务</th><th>状态</th><th>Provider</th><th>模型</th><th>日志</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td><StatusPill tone={taskTone(task.status)}>{statusText(task.status)}</StatusPill></td>
              <td>{task.providerId || "-"}</td>
              <td>{task.modelId || "-"}</td>
              <td>{task.logs?.slice(-2).join(" / ") || "-"}</td>
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
