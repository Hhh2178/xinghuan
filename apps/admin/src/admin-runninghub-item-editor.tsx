import type { RunningHubAdminItem } from "./admin-types";

export function AdminRunningHubItemEditor({
  item,
}: {
  item: RunningHubAdminItem | null;
}) {
  if (!item) {
    return (
      <section className="api-card admin-runninghub-editor admin-runninghub-editor--empty">
        <div className="admin-runninghub-editor__copy">
          <span>选择条目后可进入编辑壳子</span>
          <strong>当前未选择 RunningHub 条目</strong>
          <p>Task 3 会在这里补结构化字段编辑、工作流配置与验证动作。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="api-card admin-runninghub-editor">
      <div className="admin-runninghub-editor__head">
        <div className="admin-runninghub-editor__copy">
          <span>{item.kind === "app" ? "AI 应用" : "工作流"}</span>
          <strong>{item.title || item.catalogId}</strong>
          <p>{item.note || "当前条目尚未填写备注。"}</p>
        </div>
        <div className="admin-runninghub-editor__meta">
          <span>{item.providerName}</span>
          <span>{item.enabled ? "已启用" : "已停用"}</span>
        </div>
      </div>

      <dl className="admin-runninghub-editor__details">
        <div>
          <dt>catalogId</dt>
          <dd>{item.catalogId}</dd>
        </div>
        <div>
          <dt>运行目标</dt>
          <dd>{item.runTargetId || "未配置"}</dd>
        </div>
        <div>
          <dt>字段数</dt>
          <dd>{Array.isArray(item.fields) ? item.fields.length : 0}</dd>
        </div>
        <div>
          <dt>工作流 JSON</dt>
          <dd>{item.workflowJson ? "已保存" : "未保存"}</dd>
        </div>
      </dl>

      <div className="admin-runninghub-editor__placeholder">
        结构化编辑器将在 Task 3 接入。当前任务只提供工作台入口、列表和编辑区域壳子。
      </div>
    </section>
  );
}
