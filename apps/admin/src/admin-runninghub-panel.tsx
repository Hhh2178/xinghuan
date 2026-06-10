import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  RunningHubEntry,
  RunningHubFieldDefinition,
} from "./admin-types";

/* ── helpers ──────────────────────────────────────────────────────────── */

function parseRunningHubRef(value: string) {
  const text = value.trim();
  const match = text.match(
    /\/run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i,
  );
  if (match)
    return {
      type: (match[1].toLowerCase() === "ai-app"
        ? "app"
        : "workflow") as "app" | "workflow",
      id: match[2],
    };
  const plain = text.match(/^[0-9A-Za-z_-]{6,}$/);
  return plain ? ({ type: "workflow" as const, id: text } as const) : null;
}

function stringifyRunningHubFields(
  fields: RunningHubFieldDefinition[] | undefined,
) {
  return fields?.length ? JSON.stringify(fields, null, 2) : "";
}

/* ── RunningHubPanel ──────────────────────────────────────────────────── */

function BlockTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="block-title">
      <strong>{title}</strong>
      <span>{sub}</span>
    </div>
  );
}

export function RunningHubPanel({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: RunningHubEntry[];
  onChange: (entries: RunningHubEntry[]) => void;
}) {
  function update(index: number, patch: Partial<RunningHubEntry>) {
    onChange(
      entries.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function addEntry() {
    onChange([
      ...entries,
      {
        id: `rh-${Date.now()}`,
        title: "",
        enabled: true,
        kind: "workflow",
        workflowId: "",
        runTargetId: "",
      },
    ]);
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <section className="api-card rh-panel">
      <div className="model-section-head">
        <BlockTitle title={title} sub="管理 RunningHub 应用或工作流" />
        <button type="button" className="ghost-action" onClick={addEntry}>
          <Plus aria-hidden="true" /> 条目
        </button>
      </div>
      {entries.length ? (
        entries.map((entry, i) => (
          <RunningHubEntryPanel
            key={entry.id}
            entry={entry}
            onUpdate={(p) => update(i, p)}
            onDelete={() => removeEntry(i)}
          />
        ))
      ) : (
        <div className="empty-models">暂无条目</div>
      )}
    </section>
  );
}

/* ── RunningHubEntryPanel ─────────────────────────────────────────────── */

function RunningHubEntryPanel({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: RunningHubEntry;
  onUpdate: (patch: Partial<RunningHubEntry>) => void;
  onDelete: () => void;
}) {
  const [workflowJsonText, setWorkflowJsonText] = useState(
    entry.workflowJson || "",
  );
  const [fieldsText, setFieldsText] = useState(
    stringifyRunningHubFields(entry.fields),
  );
  const [workflowJsonError, setWorkflowJsonError] = useState("");
  const [fieldsError, setFieldsError] = useState("");

  useEffect(() => {
    setWorkflowJsonText(entry.workflowJson || "");
    setFieldsText(stringifyRunningHubFields(entry.fields));
    setWorkflowJsonError("");
    setFieldsError("");
  }, [entry.workflowJson, entry.fields]);

  function applyWorkflowJson() {
    const text = workflowJsonText.trim();
    if (!text) {
      onUpdate({ workflowJson: "" });
      setWorkflowJsonError("");
      return;
    }
    try {
      JSON.parse(text);
      onUpdate({ workflowJson: text });
      setWorkflowJsonError("");
    } catch {
      setWorkflowJsonError("工作流 JSON 不是合法 JSON");
    }
  }

  function applyFields() {
    const text = fieldsText.trim();
    if (!text) {
      onUpdate({ fields: [] });
      setFieldsError("");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("字段映射必须是数组");
      onUpdate({ fields: parsed as RunningHubFieldDefinition[] });
      setFieldsError("");
    } catch (error) {
      setFieldsError(
        error instanceof Error ? error.message : "字段映射 JSON 无效",
      );
    }
  }

  return (
    <div className="rh-entry-block">
      <div className="rh-entry-row">
        <div className="rh-entry-id">
          {`/run/workflow/${entry.workflowId || entry.id}`}
        </div>
        <input
          value={entry.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <input
          value={entry.note || ""}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="备注"
        />
        <button
          type="button"
          className="icon-soft"
          onClick={() => onUpdate({ enabled: !entry.enabled })}
        >
          {entry.enabled ? "启用" : "停用"}
        </button>
        <button type="button" className="icon-soft" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      <div className="field-note">
        运行目标 ID：画布节点选中该工作流后，会默认注入到 `webappId`。
      </div>
      <input
        value={entry.runTargetId || entry.workflowId || entry.id}
        onChange={(e) => onUpdate({ runTargetId: e.target.value })}
        placeholder="运行目标 ID"
      />
      <label>工作流 JSON</label>
      <textarea
        value={workflowJsonText}
        onChange={(e) => setWorkflowJsonText(e.target.value)}
        onBlur={applyWorkflowJson}
        placeholder='{"nodes":[],"links":[]}'
        rows={6}
      />
      {workflowJsonError ? (
        <div className="probe-note">失败: {workflowJsonError}</div>
      ) : null}
      <label>字段映射 JSON</label>
      <textarea
        value={fieldsText}
        onChange={(e) => setFieldsText(e.target.value)}
        onBlur={applyFields}
        placeholder={`[
  {
    "nodeId": "12",
    "fieldName": "prompt",
    "fieldType": "TEXT",
    "description": "正向提示词",
    "fieldValue": ""
  }
]`}
        rows={10}
      />
      {fieldsError ? (
        <div className="probe-note">失败: {fieldsError}</div>
      ) : null}
    </div>
  );
}

