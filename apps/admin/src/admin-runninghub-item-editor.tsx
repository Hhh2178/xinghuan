import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import type {
  RunningHubAdminItem,
  RunningHubAdminItemTestResult,
  RunningHubAdminItemUpdatePayload,
  RunningHubExecutionRules,
  RunningHubFieldDefinition,
  RunningHubOutputDefinition,
} from "./admin-types";

function formatJsonText(value: unknown, fallback = "{}") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

function parseObjectJson(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("参数 Schema 必须是 JSON 对象，不能是数组、字符串或数字。");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("参数 Schema 必须是 JSON 对象，不能是数组、字符串或数字。");
  }
}

function parseAnyJson(value: string, errorMessage: string) {
  try {
    return JSON.stringify(JSON.parse(value || "{}"), null, 2);
  } catch {
    throw new Error(errorMessage);
  }
}

function buildDefaultExecutionEndpoint(kind: "app" | "workflow", targetId: string) {
  return kind === "app" ? `/runninghub/app/${targetId}/run` : `/runninghub/workflow/${targetId}/run`;
}

function isDefaultExecutionEndpoint(kind: "app" | "workflow", targetId: string, endpoint: string) {
  return endpoint.trim() === buildDefaultExecutionEndpoint(kind, targetId);
}

function inferOutputDefinitions(item: RunningHubAdminItem): RunningHubOutputDefinition[] {
  if (Array.isArray(item.outputSchema) && item.outputSchema.length > 0) return item.outputSchema;
  const workflowText = item.workflowJson || "";
  const lower = workflowText.toLowerCase();
  if (lower.includes("video")) {
    return [{ key: "video", label: "输出视频", kind: "video", path: "data", multiple: true }];
  }
  if (lower.includes("audio")) {
    return [{ key: "audio", label: "输出音频", kind: "audio", path: "data", multiple: true }];
  }
  return [{ key: "image", label: "输出图像", kind: "image", path: "data", multiple: true }];
}

function defaultExecutionRules(item: RunningHubAdminItem): RunningHubExecutionRules {
  const kind = item.kind === "app" ? "app" : "workflow";
  const targetId = item.runTargetId || item.appId || item.workflowId || item.id;
  return item.executionRules || {
    submitMode: "direct",
    targetType: kind,
    method: "POST",
    endpoint: buildDefaultExecutionEndpoint(kind, targetId),
    resultPath: "data",
    errorPath: "message",
    acceptsUploads: true,
    acceptsRemoteUrls: true,
    outputKind: "remote-url",
    supportsMultipleOutputs: true,
    pollingStrategy: "none",
    pollingIntervalMs: 0,
    pollingTimeoutMs: 0,
    retryable: false,
  };
}

function defaultTestPayload(item: RunningHubAdminItem) {
  if (typeof item.testPayload === "string" && item.testPayload.trim()) return formatJsonText(item.testPayload);
  const slotPayload = (item.fields || []).reduce<Record<string, unknown>>((acc, field) => {
    const key = field.label?.trim() || field.fieldName;
    acc[key] = field.defaultValue ?? field.fieldValue ?? "";
    return acc;
  }, {});
  return JSON.stringify(slotPayload, null, 2);
}

function defaultParameterSchema(item: RunningHubAdminItem) {
  if (typeof item.parameterSchema === "string" && item.parameterSchema.trim()) return formatJsonText(item.parameterSchema);
  const properties = (item.fields || []).reduce<Record<string, unknown>>((acc, field) => {
    acc[field.fieldName] = {
      type: field.valueType?.toLowerCase().includes("number")
        ? "number"
        : field.valueType?.toLowerCase().includes("boolean")
          ? "boolean"
          : field.valueType?.toLowerCase().includes("json")
            ? "object"
            : "string",
      title: field.label || field.fieldName,
      description: field.description || "",
    };
    return acc;
  }, {});
  const required = (item.fields || []).filter((field) => field.required).map((field) => field.fieldName);
  return JSON.stringify({ type: "object", properties, required }, null, 2);
}

function createField(): RunningHubFieldDefinition {
  return {
    nodeId: "",
    fieldName: "",
    label: "",
    description: "",
    fieldType: "TEXT",
    valueType: "string",
    placeholder: "",
    required: false,
    fieldValue: "",
    defaultValue: "",
    options: [],
  };
}

function createOutput(): RunningHubOutputDefinition {
  return {
    key: "",
    label: "",
    kind: "image",
    path: "data",
    multiple: true,
  };
}

function FieldEditor({
  value,
  onChange,
  onDelete,
}: {
  value: RunningHubFieldDefinition;
  onChange: (next: RunningHubFieldDefinition) => void;
  onDelete: () => void;
}) {
  const optionsText = (value.options || []).join("\n");
  return (
    <div className="admin-runninghub-editor__slot-card">
      <div className="admin-runninghub-editor__slot-grid">
        <label>
          <span>nodeId</span>
          <input value={value.nodeId} onChange={(e) => onChange({ ...value, nodeId: e.target.value })} />
        </label>
        <label>
          <span>fieldName</span>
          <input value={value.fieldName} onChange={(e) => onChange({ ...value, fieldName: e.target.value })} />
        </label>
        <label>
          <span>标题</span>
          <input value={value.label || ""} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        </label>
        <label>
          <span>值类型</span>
          <select value={value.valueType || "string"} onChange={(e) => onChange({ ...value, valueType: e.target.value })}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
            <option value="json">json</option>
          </select>
        </label>
        <label>
          <span>字段类型</span>
          <input value={value.fieldType || ""} onChange={(e) => onChange({ ...value, fieldType: e.target.value })} />
        </label>
        <label>
          <span>占位符</span>
          <input value={value.placeholder || ""} onChange={(e) => onChange({ ...value, placeholder: e.target.value })} />
        </label>
        <label>
          <span>默认值</span>
          <input value={String(value.defaultValue ?? "")} onChange={(e) => onChange({ ...value, defaultValue: e.target.value })} />
        </label>
        <label>
          <span>手动值</span>
          <input value={String(value.fieldValue ?? "")} onChange={(e) => onChange({ ...value, fieldValue: e.target.value })} />
        </label>
      </div>
      <label className="admin-runninghub-editor__full-row">
        <span>说明</span>
        <textarea value={value.description || ""} onChange={(e) => onChange({ ...value, description: e.target.value })} rows={2} />
      </label>
      <label className="admin-runninghub-editor__full-row">
        <span>枚举选项</span>
        <textarea
          value={optionsText}
          onChange={(e) =>
            onChange({
              ...value,
              options: e.target.value
                .split(/\r?\n|,/)
                .map((item) => item.trim())
                .filter(Boolean),
            })}
          rows={2}
        />
      </label>
      <div className="admin-runninghub-editor__slot-actions">
        <label className="admin-runninghub-editor__checkbox">
          <input type="checkbox" checked={Boolean(value.required)} onChange={(e) => onChange({ ...value, required: e.target.checked })} />
          <span>必填</span>
        </label>
        <button type="button" className="ghost-action" onClick={onDelete}>
          <Trash2 aria-hidden="true" /> 删除输入槽
        </button>
      </div>
    </div>
  );
}

function OutputEditor({
  value,
  onChange,
  onDelete,
}: {
  value: RunningHubOutputDefinition;
  onChange: (next: RunningHubOutputDefinition) => void;
  onDelete: () => void;
}) {
  return (
    <div className="admin-runninghub-editor__output-row">
      <input value={value.key} onChange={(e) => onChange({ ...value, key: e.target.value })} placeholder="key" />
      <input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="标签" />
      <select value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as RunningHubOutputDefinition["kind"] })}>
        <option value="image">image</option>
        <option value="video">video</option>
        <option value="audio">audio</option>
        <option value="text">text</option>
        <option value="json">json</option>
      </select>
      <input value={value.path || ""} onChange={(e) => onChange({ ...value, path: e.target.value })} placeholder="结果路径" />
      <label className="admin-runninghub-editor__checkbox">
        <input type="checkbox" checked={Boolean(value.multiple)} onChange={(e) => onChange({ ...value, multiple: e.target.checked })} />
        <span>多结果</span>
      </label>
      <button type="button" className="ghost-action" onClick={onDelete}>
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

export function AdminRunningHubItemEditor({
  item,
  saving,
  testing,
  testResult,
  onSave,
  onTest,
}: {
  item: RunningHubAdminItem | null;
  saving: boolean;
  testing: boolean;
  testResult: RunningHubAdminItemTestResult | null;
  onSave: (catalogId: string, payload: RunningHubAdminItemUpdatePayload) => Promise<void>;
  onTest: (catalogId: string, payload: { testPayload?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [runTargetId, setRunTargetId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [fields, setFields] = useState<RunningHubFieldDefinition[]>([]);
  const [parameterSchema, setParameterSchema] = useState("{}");
  const [parameterSchemaError, setParameterSchemaError] = useState("");
  const [outputs, setOutputs] = useState<RunningHubOutputDefinition[]>([]);
  const [executionRules, setExecutionRules] = useState<RunningHubExecutionRules | null>(null);
  const [testPayload, setTestPayload] = useState("{}");
  const [testPayloadError, setTestPayloadError] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle(item.title || item.catalogId);
    setNote(item.note || "");
    setRunTargetId(item.runTargetId || item.appId || item.workflowId || item.id);
    setEnabled(item.enabled);
    setFields(item.fields || []);
    setParameterSchema(defaultParameterSchema(item));
    setParameterSchemaError("");
    setOutputs(inferOutputDefinitions(item));
    setExecutionRules(defaultExecutionRules(item));
    setTestPayload(defaultTestPayload(item));
    setTestPayloadError("");
  }, [item]);

  const slotSummary = useMemo(
    () =>
      fields.map((field) => ({
        key: `${field.nodeId}:${field.fieldName}`,
        title: field.label || field.fieldName,
        required: Boolean(field.required),
        type: field.valueType || field.fieldType || "string",
      })),
    [fields],
  );

  if (!item) {
    return (
      <section className="api-card admin-runninghub-editor admin-runninghub-editor--empty">
        <div className="admin-runninghub-editor__copy">
          <span>选择条目后可进入结构化编辑</span>
          <strong>当前未选择 RunningHub 条目</strong>
          <p>从左侧目录选择一个工作流或 AI 应用后，这里会展开输入槽、参数、输出和测试运行配置。</p>
        </div>
      </section>
    );
  }

  const currentItem = item;
  const currentKind = currentItem.kind === "app" ? "app" : "workflow";

  async function handleSave() {
    try {
      const parsedSchema = parseObjectJson(parameterSchema);
      const normalizedSchema = JSON.stringify(parsedSchema, null, 2);
      const normalizedTestPayload = parseAnyJson(testPayload, "测试运行输入必须是有效 JSON。");
      const nextRunTargetId = runTargetId.trim() || currentItem.runTargetId || currentItem.id;
      const priorDefaultEndpoint = buildDefaultExecutionEndpoint(currentKind, currentItem.runTargetId || currentItem.appId || currentItem.workflowId || currentItem.id);
      const nextDefaultEndpoint = buildDefaultExecutionEndpoint(currentKind, nextRunTargetId);
      const baseExecutionRules = executionRules || defaultExecutionRules(currentItem);
      const nextExecutionRules = {
        ...baseExecutionRules,
        endpoint: isDefaultExecutionEndpoint(currentKind, currentItem.runTargetId || currentItem.appId || currentItem.workflowId || currentItem.id, baseExecutionRules.endpoint)
          || baseExecutionRules.endpoint.trim() === priorDefaultEndpoint
          ? nextDefaultEndpoint
          : baseExecutionRules.endpoint,
        targetType: currentKind,
      } satisfies RunningHubExecutionRules;
      setParameterSchema(normalizedSchema);
      setTestPayload(normalizedTestPayload);
      setParameterSchemaError("");
      setTestPayloadError("");
      await onSave(currentItem.catalogId, {
        title: title.trim() || currentItem.catalogId,
        note: note.trim(),
        enabled,
        runTargetId: nextRunTargetId,
        fields,
        parameterSchema: normalizedSchema,
        outputSchema: outputs,
        executionRules: nextExecutionRules,
        testPayload: normalizedTestPayload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "参数 Schema 必须是 JSON 对象。";
      if (/测试运行输入/.test(message)) {
        setTestPayloadError(message);
      } else {
        setParameterSchemaError(message);
      }
    }
  }

  async function handleTest() {
    try {
      const normalizedPayload = parseAnyJson(testPayload, "测试运行输入必须是有效 JSON。");
      setTestPayload(normalizedPayload);
      setTestPayloadError("");
      await onTest(currentItem.catalogId, { testPayload: normalizedPayload });
    } catch (error) {
      setTestPayloadError(error instanceof Error ? error.message : "测试运行输入必须是有效 JSON。");
    }
  }

  return (
    <section className="api-card admin-runninghub-editor">
      <div className="admin-runninghub-editor__head">
        <div className="admin-runninghub-editor__copy">
          <span>{currentItem.kind === "app" ? "AI 应用" : "工作流"}</span>
          <strong>{currentItem.title || currentItem.catalogId}</strong>
          <p>{currentItem.note || "当前条目尚未填写备注。"}</p>
        </div>
        <div className="admin-runninghub-editor__meta">
          <span>{currentItem.providerName}</span>
          <span>{enabled ? "已启用" : "已停用"}</span>
        </div>
      </div>

      <dl className="admin-runninghub-editor__details">
        <div>
          <dt>catalogId</dt>
          <dd>{currentItem.catalogId}</dd>
        </div>
        <div>
          <dt>运行目标</dt>
          <dd>{runTargetId || "未配置"}</dd>
        </div>
        <div>
          <dt>输入槽数</dt>
          <dd>{fields.length}</dd>
        </div>
        <div>
          <dt>输出定义数</dt>
          <dd>{outputs.length}</dd>
        </div>
      </dl>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>基础信息</strong>
            <span>条目标题、备注和运行目标</span>
          </div>
          <label className="admin-runninghub-editor__checkbox">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>启用条目</span>
          </label>
        </div>
        <div className="admin-runninghub-editor__form-grid">
          <label>
            <span>标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span>运行目标 ID</span>
            <input value={runTargetId} onChange={(e) => setRunTargetId(e.target.value)} />
          </label>
          <label className="admin-runninghub-editor__full-row">
            <span>备注</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
        </div>
      </section>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>输入槽定义</strong>
            <span>显式管理 nodeId、字段名、类型、默认值和必填规则</span>
          </div>
          <button type="button" className="ghost-action" onClick={() => setFields((current) => [...current, createField()])}>
            <Plus aria-hidden="true" /> 添加输入槽
          </button>
        </div>
        {fields.length ? (
          <div className="admin-runninghub-editor__slot-list">
            {fields.map((field, index) => (
              <FieldEditor
                key={`${field.nodeId}-${field.fieldName}-${index}`}
                value={field}
                onChange={(next) => setFields((current) => current.map((entry, i) => (i === index ? next : entry)))}
                onDelete={() => setFields((current) => current.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        ) : (
          <div className="admin-runninghub-editor__empty-note">当前未配置输入槽。至少补齐 nodeId 和 fieldName 后再保存。</div>
        )}
        {slotSummary.length ? (
          <div className="admin-runninghub-editor__slot-summary">
            {slotSummary.map((slot) => (
              <span key={slot.key} className={slot.required ? "required" : ""}>
                {slot.title} · {slot.type}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>参数 Schema</strong>
            <span>保存为结构化 JSON，对应当前条目的参数契约</span>
          </div>
        </div>
        <textarea value={parameterSchema} onChange={(e) => setParameterSchema(e.target.value)} rows={10} className="admin-runninghub-editor__code" />
        {parameterSchemaError ? <div className="probe-note">失败: {parameterSchemaError}</div> : null}
      </section>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>输出定义</strong>
            <span>配置管理侧如何理解 RH 结果类型和路径</span>
          </div>
          <button type="button" className="ghost-action" onClick={() => setOutputs((current) => [...current, createOutput()])}>
            <Plus aria-hidden="true" /> 添加输出
          </button>
        </div>
        <div className="admin-runninghub-editor__output-list">
          {outputs.map((output, index) => (
            <OutputEditor
              key={`${output.key}-${index}`}
              value={output}
              onChange={(next) => setOutputs((current) => current.map((entry, i) => (i === index ? next : entry)))}
              onDelete={() => setOutputs((current) => current.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      </section>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>执行描述</strong>
            <span>显示并管理提交、结果路径、轮询和错误策略</span>
          </div>
        </div>
        {executionRules ? (
          <div className="admin-runninghub-editor__form-grid">
            <label>
              <span>Endpoint</span>
              <input value={executionRules.endpoint} onChange={(e) => setExecutionRules({ ...executionRules, endpoint: e.target.value })} />
            </label>
            <label>
              <span>结果路径</span>
              <input value={executionRules.resultPath} onChange={(e) => setExecutionRules({ ...executionRules, resultPath: e.target.value })} />
            </label>
            <label>
              <span>错误路径</span>
              <input value={executionRules.errorPath} onChange={(e) => setExecutionRules({ ...executionRules, errorPath: e.target.value })} />
            </label>
            <label>
              <span>轮询策略</span>
              <select
                value={executionRules.pollingStrategy}
                onChange={(e) => setExecutionRules({ ...executionRules, pollingStrategy: e.target.value as RunningHubExecutionRules["pollingStrategy"] })}
              >
                <option value="none">none</option>
                <option value="fixed-interval">fixed-interval</option>
              </select>
            </label>
            <label>
              <span>轮询间隔(ms)</span>
              <input
                value={String(executionRules.pollingIntervalMs)}
                onChange={(e) => setExecutionRules({ ...executionRules, pollingIntervalMs: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              <span>轮询超时(ms)</span>
              <input
                value={String(executionRules.pollingTimeoutMs)}
                onChange={(e) => setExecutionRules({ ...executionRules, pollingTimeoutMs: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="admin-runninghub-editor__checkbox">
              <input
                type="checkbox"
                checked={executionRules.acceptsUploads}
                onChange={(e) => setExecutionRules({ ...executionRules, acceptsUploads: e.target.checked })}
              />
              <span>支持上传</span>
            </label>
            <label className="admin-runninghub-editor__checkbox">
              <input
                type="checkbox"
                checked={executionRules.acceptsRemoteUrls}
                onChange={(e) => setExecutionRules({ ...executionRules, acceptsRemoteUrls: e.target.checked })}
              />
              <span>支持远程 URL</span>
            </label>
            <label className="admin-runninghub-editor__checkbox">
              <input
                type="checkbox"
                checked={executionRules.retryable}
                onChange={(e) => setExecutionRules({ ...executionRules, retryable: e.target.checked })}
              />
              <span>允许重试</span>
            </label>
          </div>
        ) : null}
      </section>

      <section className="admin-runninghub-editor__section">
        <div className="admin-runninghub-editor__section-head">
          <div>
            <strong>测试运行</strong>
            <span>保存测试样例并执行预览校验，不会触发真实上游运行</span>
          </div>
          <button type="button" className="ghost-action" onClick={() => void handleTest()} disabled={testing}>
            <FlaskConical aria-hidden="true" /> {testing ? "预览校验中..." : "执行预览校验"}
          </button>
        </div>
        <textarea value={testPayload} onChange={(e) => setTestPayload(e.target.value)} rows={8} className="admin-runninghub-editor__code" />
        {testPayloadError ? <div className="probe-note">失败: {testPayloadError}</div> : null}
        {testResult ? (
          <div className={testResult.ok ? "admin-runninghub-editor__test-result ok" : "admin-runninghub-editor__test-result error"}>
            <strong>{testResult.ok ? "测试通过" : "测试失败"}</strong>
            <span>{testResult.message}</span>
            {testResult.requestPreview ? <pre>{JSON.stringify(testResult.requestPreview, null, 2)}</pre> : null}
            {testResult.responsePreview ? <pre>{JSON.stringify(testResult.responsePreview, null, 2)}</pre> : null}
          </div>
        ) : null}
      </section>

      <div className="admin-runninghub-editor__footer">
        <button type="button" className="ghost-action" onClick={() => void handleSave()} disabled={saving}>
          <Save aria-hidden="true" /> {saving ? "保存中..." : "保存条目"}
        </button>
      </div>
    </section>
  );
}
