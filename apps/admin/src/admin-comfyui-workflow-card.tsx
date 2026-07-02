import { Check, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComfyuiWorkflowDraft, ComfyuiWorkflowFieldDraft, ComfyuiWorkflowOutputDraft } from "./admin-types";

export interface ComfyuiWorkflowEditPayload {
  title: string;
  description?: string;
  exposedFields: ComfyuiWorkflowFieldDraft[];
  defaultValues: Record<string, unknown>;
  hiddenFields: string[];
  outputSchema: ComfyuiWorkflowOutputDraft[];
}

interface ComfyuiWorkflowCardProps {
  workflow: ComfyuiWorkflowDraft;
  onSave: (workflowId: string, payload: ComfyuiWorkflowEditPayload) => Promise<void> | void;
  onPushToShared: (workflowId: string) => Promise<void> | void;
  onDelete: (workflowId: string) => Promise<void> | void;
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return "";
  }
}

function parseJson<T>(text: string, fallback: T): T {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed) as T;
}

function parseList(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdminComfyuiWorkflowCard({ workflow, onSave, onPushToShared, onDelete }: ComfyuiWorkflowCardProps) {
  const [title, setTitle] = useState(workflow.title);
  const [description, setDescription] = useState(workflow.description || "");
  const [exposedFieldsText, setExposedFieldsText] = useState(prettyJson(workflow.exposedFields));
  const [defaultValuesText, setDefaultValuesText] = useState(prettyJson(workflow.defaultValues));
  const [hiddenFieldsText, setHiddenFieldsText] = useState(workflow.hiddenFields.join(", "));
  const [outputSchemaText, setOutputSchemaText] = useState(prettyJson(workflow.outputSchema));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "shared" | "delete" | "">("");

  useEffect(() => {
    setTitle(workflow.title);
    setDescription(workflow.description || "");
    setExposedFieldsText(prettyJson(workflow.exposedFields));
    setDefaultValuesText(prettyJson(workflow.defaultValues));
    setHiddenFieldsText(workflow.hiddenFields.join(", "));
    setOutputSchemaText(prettyJson(workflow.outputSchema));
    setMessage("");
    setBusy("");
  }, [workflow]);

  const sharedLabel = useMemo(() => (workflow.sharedWorkflowId ? `已发布为 ${workflow.sharedWorkflowId}` : "未发布到共享区"), [workflow.sharedWorkflowId]);

  async function handleSave() {
    setBusy("save");
    setMessage("");
    try {
      const payload: ComfyuiWorkflowEditPayload = {
        title: title.trim() || workflow.title,
        description: description.trim(),
        exposedFields: parseJson<ComfyuiWorkflowFieldDraft[]>(exposedFieldsText, workflow.exposedFields),
        defaultValues: parseJson<Record<string, unknown>>(defaultValuesText, workflow.defaultValues),
        hiddenFields: parseList(hiddenFieldsText),
        outputSchema: parseJson<ComfyuiWorkflowOutputDraft[]>(outputSchemaText, workflow.outputSchema),
      };
      await onSave(workflow.id, payload);
      setMessage("已保存工作流草稿");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  async function handlePushToShared() {
    setBusy("shared");
    setMessage("");
    try {
      await onPushToShared(workflow.id);
      setMessage("已推送到共享区");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`删除工作流「${workflow.title}」？`)) return;
    setBusy("delete");
    setMessage("");
    try {
      await onDelete(workflow.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="data-panel admin-comfyui-workflow-card">
      <header className="admin-comfyui-workflow-card__header">
        <div>
          <h3>{workflow.title}</h3>
          <p>{workflow.instanceId} · {sharedLabel}</p>
        </div>
        <div className="admin-comfyui-workflow-card__meta">
          <span>{workflow.exposedFields.length} 个暴露参数</span>
          <span>{workflow.outputSchema.length} 个输出</span>
        </div>
      </header>

      <div className="form-grid admin-comfyui-workflow-card__body">
        <label>
          <span>标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>说明</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </label>
        <label className="admin-comfyui-workflow-card__span-2">
          <span>暴露参数</span>
          <textarea value={exposedFieldsText} onChange={(event) => setExposedFieldsText(event.target.value)} rows={8} />
        </label>
        <label className="admin-comfyui-workflow-card__span-2">
          <span>默认值</span>
          <textarea value={defaultValuesText} onChange={(event) => setDefaultValuesText(event.target.value)} rows={6} />
        </label>
        <label>
          <span>隐藏字段</span>
          <input value={hiddenFieldsText} onChange={(event) => setHiddenFieldsText(event.target.value)} />
        </label>
        <label>
          <span>输出定义</span>
          <textarea value={outputSchemaText} onChange={(event) => setOutputSchemaText(event.target.value)} rows={5} />
        </label>
      </div>

      {message ? <div className="admin-comfyui-workflow-card__message">{message}</div> : null}

      <div className="admin-comfyui-workflow-card__actions">
        <button type="button" onClick={() => void handleSave()} disabled={busy !== ""}>
          <Check aria-hidden="true" />
          保存草稿
        </button>
        <button type="button" onClick={() => void handlePushToShared()} disabled={busy !== "" || !workflow.exposedFields.length}>
          <Share2 aria-hidden="true" />
          推送到共享区
        </button>
        <button type="button" className="danger" onClick={() => void handleDelete()} disabled={busy !== ""}>
          <Trash2 aria-hidden="true" />
          删除
        </button>
      </div>
    </article>
  );
}

export default AdminComfyuiWorkflowCard;
