import {
  AlertTriangle,
  AudioLines,
  Check,
  EyeOff,
  FileJson2,
  Film,
  Hash,
  ImageIcon,
  Info,
  ListTree,
  Settings2,
  Share2,
  SlidersHorizontal,
  TextCursorInput,
  ToggleLeft,
  Trash2,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ComfyuiDetectedInput,
  ComfyuiDetectedOutput,
  ComfyuiWorkflowDraft,
  ComfyuiWorkflowInputSchemaItem,
  ComfyuiWorkflowOutputSchemaItem,
  ComfyuiWorkflowValueKind,
} from "./admin-types";

export interface ComfyuiWorkflowEditPayload {
  title: string;
  description?: string;
  workflowJson: Record<string, unknown>;
  inputSchema: ComfyuiWorkflowInputSchemaItem[];
  defaultValues: Record<string, unknown>;
  outputSchema: ComfyuiWorkflowOutputSchemaItem[];
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

function cloneRows<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function parseWorkflowJson(text: string, fallback: Record<string, unknown>) {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("工作流 JSON 必须是对象格式的 API workflow");
  }
  return parsed;
}

function defaultValuesFromSchema(inputSchema: ComfyuiWorkflowInputSchemaItem[]) {
  return Object.fromEntries(
    inputSchema
      .filter((item) => item.defaultValue !== undefined)
      .map((item) => [item.key, cloneRows(item.defaultValue)]),
  );
}

function isMediaKind(kind: ComfyuiWorkflowValueKind) {
  return kind === "image" || kind === "video" || kind === "audio";
}

function fieldKindIcon(kind: ComfyuiWorkflowValueKind) {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Film;
  if (kind === "audio") return AudioLines;
  if (kind === "number") return Hash;
  if (kind === "boolean") return ToggleLeft;
  return TextCursorInput;
}

function outputKindIcon(kind: ComfyuiWorkflowOutputSchemaItem["kind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Film;
  if (kind === "audio") return AudioLines;
  return TextCursorInput;
}

function formatDefaultValue(field: ComfyuiWorkflowInputSchemaItem) {
  if (field.kind === "boolean") return field.defaultValue === true;
  if (field.kind === "number") return field.defaultValue === undefined ? "" : String(field.defaultValue);
  if (typeof field.defaultValue === "string") return field.defaultValue;
  if (field.defaultValue === undefined || field.defaultValue === null) return "";
  try {
    return JSON.stringify(field.defaultValue);
  } catch {
    return String(field.defaultValue);
  }
}

function coerceDefaultValue(kind: ComfyuiWorkflowValueKind, raw: string | boolean) {
  if (kind === "boolean") return Boolean(raw);
  if (kind === "number") {
    const text = String(raw).trim();
    if (!text) return undefined;
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }
  return String(raw);
}

function inputMetaLabel(meta: ComfyuiDetectedInput | undefined, field: ComfyuiWorkflowInputSchemaItem) {
  return meta?.nodeTitle || `${field.nodeId}.${field.fieldName}`;
}

function outputMetaLabel(meta: ComfyuiDetectedOutput | undefined, field: ComfyuiWorkflowOutputSchemaItem) {
  return meta?.nodeTitle || field.sourceNodeId || field.key;
}

export function AdminComfyuiWorkflowCard({ workflow, onSave, onPushToShared, onDelete }: ComfyuiWorkflowCardProps) {
  const [title, setTitle] = useState(workflow.title);
  const [description, setDescription] = useState(workflow.description || "");
  const [workflowJsonText, setWorkflowJsonText] = useState(prettyJson(workflow.workflowJson));
  const [draftInputSchema, setDraftInputSchema] = useState<ComfyuiWorkflowInputSchemaItem[]>(cloneRows(workflow.inputSchema));
  const [draftOutputSchema, setDraftOutputSchema] = useState<ComfyuiWorkflowOutputSchemaItem[]>(cloneRows(workflow.outputSchema));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "shared" | "delete" | "">("");

  useEffect(() => {
    setTitle(workflow.title);
    setDescription(workflow.description || "");
    setWorkflowJsonText(prettyJson(workflow.workflowJson));
    setDraftInputSchema(cloneRows(workflow.inputSchema));
    setDraftOutputSchema(cloneRows(workflow.outputSchema));
    setMessage("");
    setBusy("");
  }, [workflow]);

  const inputMetaMap = useMemo(
    () => new Map(workflow.analysis.detectedInputs.map((item) => [item.key, item])),
    [workflow.analysis],
  );
  const outputMetaList = workflow.analysis.detectedOutputs;
  const publishedLabel = workflow.sharedWorkflowId ? `已发布为 ${workflow.sharedWorkflowId}` : "实例级草稿";

  const paramCount = draftInputSchema.filter((item) => item.mode === "param").length;
  const upstreamCount = draftInputSchema.filter((item) => item.mode === "upstream").length;
  const hiddenCount = draftInputSchema.filter((item) => item.mode === "hidden").length;
  const enabledOutputCount = draftOutputSchema.filter((item) => item.enabled !== false).length;

  function updateInputRow(index: number, patch: Partial<ComfyuiWorkflowInputSchemaItem>) {
    setDraftInputSchema((current) => current.map((item, rowIndex) => (
      rowIndex === index ? { ...item, ...patch } : item
    )));
  }

  function updateOutputRow(index: number, patch: Partial<ComfyuiWorkflowOutputSchemaItem>) {
    setDraftOutputSchema((current) => current.map((item, rowIndex) => (
      rowIndex === index ? { ...item, ...patch } : item
    )));
  }

  async function handleSave() {
    setBusy("save");
    setMessage("");
    try {
      const nextInputSchema = cloneRows(draftInputSchema)
        .map((item, index) => ({
          ...item,
          label: item.label.trim() || item.fieldName,
          upstreamSlot: item.mode === "upstream" ? (item.upstreamSlot || item.source || "").trim() || undefined : undefined,
          order: Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : index,
        }))
        .sort((a, b) => a.order - b.order);
      const nextOutputSchema = cloneRows(draftOutputSchema)
        .map((item, index) => ({
          ...item,
          key: item.key.trim() || `output-${index + 1}`,
          label: item.label.trim() || `输出 ${index + 1}`,
          order: Number.isFinite(Number(item.order)) ? Math.max(0, Math.floor(Number(item.order))) : index,
        }))
        .sort((a, b) => a.order - b.order);
      const payload: ComfyuiWorkflowEditPayload = {
        title: title.trim() || workflow.title,
        description: description.trim(),
        workflowJson: parseWorkflowJson(workflowJsonText, workflow.workflowJson),
        inputSchema: nextInputSchema,
        defaultValues: defaultValuesFromSchema(nextInputSchema),
        outputSchema: nextOutputSchema,
      };
      await onSave(workflow.id, payload);
      setMessage("已保存工作流治理草稿");
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
        <div className="admin-comfyui-workflow-card__title">
          <div className="admin-comfyui-workflow-card__title-icon">
            <Workflow aria-hidden="true" />
          </div>
          <div>
            <span className="admin-comfyui-workflow-card__eyebrow">工作流映射治理</span>
            <h3>{workflow.title}</h3>
            <p>{workflow.instanceId} · {publishedLabel}</p>
          </div>
        </div>
        <div className="admin-comfyui-workflow-card__meta">
          <span>{workflow.analysis.detectedInputs.length} 个检测输入</span>
          <span>{workflow.analysis.detectedOutputs.length || 1} 个检测输出</span>
          <span>{workflow.analysis.warnings.length} 条解析告警</span>
        </div>
      </header>

      <div className="admin-comfyui-workflow-card__intro-grid">
        <label>
          <span>工作流标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>工作流说明</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </label>
      </div>

      <section className="admin-comfyui-workflow-card__section">
        <div className="admin-comfyui-section-head">
          <div className="admin-comfyui-section-head__icon">
            <ListTree aria-hidden="true" />
          </div>
          <div>
            <strong>解析摘要</strong>
            <span>系统自动识别的输入、输出与告警，只是起点，不是最终运行契约。</span>
          </div>
        </div>
        <div className="admin-comfyui-parser-summary">
          <article className="admin-comfyui-parser-summary__card">
            <strong>{paramCount}</strong>
            <span>画布参数输入</span>
          </article>
          <article className="admin-comfyui-parser-summary__card">
            <strong>{upstreamCount}</strong>
            <span>上游素材口</span>
          </article>
          <article className="admin-comfyui-parser-summary__card">
            <strong>{hiddenCount}</strong>
            <span>隐藏输入</span>
          </article>
          <article className="admin-comfyui-parser-summary__card">
            <strong>{enabledOutputCount}</strong>
            <span>启用输出</span>
          </article>
        </div>
      </section>

      {workflow.analysis.warnings.length ? (
        <section className="admin-comfyui-workflow-card__section">
          <div className="admin-comfyui-section-head">
            <div className="admin-comfyui-section-head__icon admin-comfyui-section-head__icon--warning">
              <AlertTriangle aria-hidden="true" />
            </div>
            <div>
              <strong>解析告警</strong>
              <span>这些位置需要你在保存前人工确认，避免错误暴露到画布节点。</span>
            </div>
          </div>
          <div className="admin-comfyui-warning-list">
            {workflow.analysis.warnings.map((warning) => (
              <article key={`${warning.code}-${warning.nodeId || "global"}`} className="admin-comfyui-warning-card">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>{warning.code}</strong>
                  <span>{warning.message}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-comfyui-workflow-card__section">
        <div className="admin-comfyui-section-head">
          <div className="admin-comfyui-section-head__icon">
            <SlidersHorizontal aria-hidden="true" />
          </div>
          <div>
            <strong>输入映射治理</strong>
            <span>把输入明确区分成参数、上游素材口或隐藏输入，画布节点会直接消费这里保存的 schema。</span>
          </div>
        </div>
        <div className="admin-comfyui-mapping-table">
          <div className="admin-comfyui-mapping-row admin-comfyui-mapping-row--header">
            <span>来源字段</span>
            <span>显示名称</span>
            <span>暴露模式</span>
            <span>类型</span>
            <span>默认值 / 上游口</span>
            <span>必填</span>
            <span>顺序</span>
          </div>
          {draftInputSchema.map((field, index) => {
            const meta = inputMetaMap.get(field.key);
            const Icon = fieldKindIcon(field.kind);
            return (
              <div key={field.key} className="admin-comfyui-mapping-row">
                <div className="admin-comfyui-source-cell">
                  <div className="admin-comfyui-source-cell__icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="admin-comfyui-source-cell__copy">
                    <strong>{inputMetaLabel(meta, field)}</strong>
                    <span>{field.source} · {field.nodeId}.{field.fieldName}</span>
                    <small>{meta?.classType || "自定义字段"}</small>
                  </div>
                </div>
                <input
                  value={field.label}
                  onChange={(event) => updateInputRow(index, { label: event.target.value })}
                />
                <select
                  value={field.mode}
                  onChange={(event) => {
                    const mode = event.target.value as ComfyuiWorkflowInputSchemaItem["mode"];
                    updateInputRow(index, {
                      mode,
                      upstreamSlot: mode === "upstream" ? field.upstreamSlot || field.source : undefined,
                    });
                  }}
                >
                  <option value="param">参数</option>
                  <option value="upstream">上游输入口</option>
                  <option value="hidden">隐藏</option>
                </select>
                <select
                  value={field.kind}
                  onChange={(event) => updateInputRow(index, { kind: event.target.value as ComfyuiWorkflowValueKind })}
                >
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="select">select</option>
                  <option value="image">image</option>
                  <option value="video">video</option>
                  <option value="audio">audio</option>
                </select>
                {field.mode === "upstream" ? (
                  <input
                    value={field.upstreamSlot || ""}
                    onChange={(event) => updateInputRow(index, { upstreamSlot: event.target.value })}
                    placeholder="image1 / video1 / audio1"
                  />
                ) : field.kind === "textarea" ? (
                  <textarea
                    rows={2}
                    value={String(formatDefaultValue(field))}
                    onChange={(event) => updateInputRow(index, { defaultValue: coerceDefaultValue(field.kind, event.target.value) })}
                  />
                ) : field.kind === "boolean" ? (
                  <label className="admin-comfyui-inline-check">
                    <input
                      type="checkbox"
                      checked={Boolean(field.defaultValue)}
                      onChange={(event) => updateInputRow(index, { defaultValue: coerceDefaultValue(field.kind, event.target.checked) })}
                    />
                    <span>默认开启</span>
                  </label>
                ) : (
                  <input
                    type={field.kind === "number" ? "number" : "text"}
                    value={String(formatDefaultValue(field))}
                    onChange={(event) => updateInputRow(index, { defaultValue: coerceDefaultValue(field.kind, event.target.value) })}
                  />
                )}
                <label className="admin-comfyui-inline-check">
                  <input
                    type="checkbox"
                    checked={field.required === true}
                    onChange={(event) => updateInputRow(index, { required: event.target.checked })}
                  />
                  <span>{field.required ? "必填" : "可选"}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={field.order}
                  onChange={(event) => updateInputRow(index, { order: Number(event.target.value) || 0 })}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-comfyui-workflow-card__section">
        <div className="admin-comfyui-section-head">
          <div className="admin-comfyui-section-head__icon">
            <Settings2 aria-hidden="true" />
          </div>
          <div>
            <strong>输出发布治理</strong>
            <span>这里定义画布节点最终会对下游暴露哪些命名输出，以及它们的稳定 key。</span>
          </div>
        </div>
        <div className="admin-comfyui-mapping-table">
          <div className="admin-comfyui-output-row admin-comfyui-output-row--header">
            <span>来源节点</span>
            <span>输出 key</span>
            <span>显示名称</span>
            <span>类型</span>
            <span>启用</span>
            <span>顺序</span>
          </div>
          {draftOutputSchema.map((field, index) => {
            const meta = outputMetaList.find((item) => (
              (item.sourceNodeId && item.sourceNodeId === field.sourceNodeId)
              || item.key === field.key
            ));
            const Icon = outputKindIcon(field.kind);
            return (
              <div key={`${field.key}-${index}`} className="admin-comfyui-output-row">
                <div className="admin-comfyui-source-cell">
                  <div className="admin-comfyui-source-cell__icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="admin-comfyui-source-cell__copy">
                    <strong>{outputMetaLabel(meta, field)}</strong>
                    <span>{field.sourceNodeId || "未绑定来源节点"}</span>
                    <small>{meta?.classType || field.kind}</small>
                  </div>
                </div>
                <input
                  value={field.key}
                  onChange={(event) => updateOutputRow(index, { key: event.target.value })}
                />
                <input
                  value={field.label}
                  onChange={(event) => updateOutputRow(index, { label: event.target.value })}
                />
                <select
                  value={field.kind}
                  onChange={(event) => updateOutputRow(index, { kind: event.target.value as ComfyuiWorkflowOutputSchemaItem["kind"] })}
                >
                  <option value="image">image</option>
                  <option value="video">video</option>
                  <option value="audio">audio</option>
                  <option value="text">text</option>
                </select>
                <label className="admin-comfyui-inline-check">
                  <input
                    type="checkbox"
                    checked={field.enabled !== false}
                    onChange={(event) => updateOutputRow(index, { enabled: event.target.checked })}
                  />
                  <span>{field.enabled === false ? "关闭" : "发布"}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={field.order}
                  onChange={(event) => updateOutputRow(index, { order: Number(event.target.value) || 0 })}
                />
              </div>
            );
          })}
        </div>
      </section>

      <details className="admin-comfyui-advanced-panel">
        <summary>
          <FileJson2 aria-hidden="true" />
          高级 JSON / 原始工作流
        </summary>
        <div className="admin-comfyui-advanced-panel__body">
          <label>
            <span>Workflow JSON</span>
            <textarea
              value={workflowJsonText}
              onChange={(event) => setWorkflowJsonText(event.target.value)}
              rows={14}
            />
          </label>
          <div className="admin-comfyui-advanced-panel__tip">
            <Info aria-hidden="true" />
            <span>这里只保留原始 workflow JSON 的高级编辑入口；常规治理请优先使用上面的行级映射编辑器。</span>
          </div>
        </div>
      </details>

      {message ? <div className="admin-comfyui-workflow-card__message">{message}</div> : null}

      <div className="admin-comfyui-workflow-card__actions">
        <button type="button" onClick={() => void handleSave()} disabled={busy !== ""}>
          <Check aria-hidden="true" />
          保存治理草稿
        </button>
        <button type="button" onClick={() => void handlePushToShared()} disabled={busy !== "" || !draftInputSchema.length}>
          <Share2 aria-hidden="true" />
          推送到共享区
        </button>
        <button type="button" className="danger" onClick={() => void handleDelete()} disabled={busy !== ""}>
          <Trash2 aria-hidden="true" />
          删除工作流
        </button>
      </div>

      <div className="admin-comfyui-workflow-card__footer-note">
        <EyeOff aria-hidden="true" />
        <span>隐藏输入不会暴露到画布；上游输入口会参与节点连线语义；最终运行时与共享节点都以这里保存的 schema 为准。</span>
      </div>
    </article>
  );
}

export default AdminComfyuiWorkflowCard;
