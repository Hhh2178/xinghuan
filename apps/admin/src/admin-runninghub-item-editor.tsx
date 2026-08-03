import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Plus, Save, Trash2 } from "lucide-react";
import { adminRunningHubApi } from "./admin-api-client";
import type {
  RunningHubAdminItem,
  RunningHubAdminItemTestResult,
  RunningHubAdminItemUpdatePayload,
  RunningHubExecutionRules,
  RunningHubFieldDefinition,
  RunningHubOutputDefinition,
  RunningHubGroup,
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

function countSchemaProperties(value: string) {
  try {
    const parsed = JSON.parse(value || "{}") as { properties?: Record<string, unknown> };
    return parsed.properties && typeof parsed.properties === "object" ? Object.keys(parsed.properties).length : 0;
  } catch {
    return 0;
  }
}

function inferValueTypeFromSchema(type: unknown): RunningHubFieldDefinition["valueType"] {
  const text = String(type || "").trim().toLowerCase();
  if (text === "number" || text === "integer") return "number";
  if (text === "boolean") return "boolean";
  if (text === "image") return "image";
  if (text === "video") return "video";
  if (text === "audio") return "audio";
  if (text === "object" || text === "array") return "json";
  return "string";
}

function inferFieldTypeFromValueType(valueType: RunningHubFieldDefinition["valueType"]) {
  if (valueType === "number") return "NUMBER";
  if (valueType === "boolean") return "BOOLEAN";
  if (valueType === "image") return "IMAGE";
  if (valueType === "video") return "VIDEO";
  if (valueType === "audio") return "AUDIO";
  if (valueType === "json") return "JSON";
  return "TEXT";
}

const FIELD_TYPE_PRESET_OPTIONS = ["TEXT", "STRING", "NUMBER", "INTEGER", "FLOAT", "BOOLEAN", "IMAGE", "VIDEO", "AUDIO", "JSON", "LIST", "SELECT"];
const OUTPUT_PATH_PRESET_OPTIONS = ["data", "data.outputs", "data.result", "result", "outputs"];
const OUTPUT_KIND_PRESET_OPTIONS: RunningHubOutputDefinition["kind"][] = ["image", "video", "audio", "text", "json"];

function mergePresetOptions(currentValue: string | undefined, presets: string[]) {
  const next = [...presets];
  const trimmed = String(currentValue || "").trim();
  if (trimmed && !next.includes(trimmed)) next.push(trimmed);
  return next;
}

function inferValueTypeFromFieldShape(fieldType: unknown, fallback: RunningHubFieldDefinition["valueType"] = "string") {
  const text = String(fieldType || "").trim().toLowerCase();
  if (!text) return fallback;
  if (text.includes("image")) return "image";
  if (text.includes("video")) return "video";
  if (text.includes("audio")) return "audio";
  if (text.includes("json") || text.includes("object") || text.includes("array")) return "json";
  if (text.includes("number") || text.includes("int") || text.includes("float")) return "number";
  if (text.includes("bool")) return "boolean";
  return fallback;
}

function buildFieldsFromParameterSchema(value: string, existingFields: RunningHubFieldDefinition[]) {
  try {
    const parsed = JSON.parse(value || "{}") as {
      properties?: Record<string, { type?: unknown; title?: unknown; description?: unknown; default?: unknown; enum?: unknown[] }>;
      required?: unknown[];
    };
    const properties = parsed.properties && typeof parsed.properties === "object" ? parsed.properties : {};
    const requiredKeys = new Set(Array.isArray(parsed.required) ? parsed.required.map((item) => String(item)) : []);
    const existingKeys = new Set(existingFields.map((field) => field.fieldName.trim()).filter(Boolean));
    const nextFields = Object.entries(properties).flatMap(([fieldName, definition]) => {
      const normalizedFieldName = String(fieldName || "").trim();
      if (!normalizedFieldName || existingKeys.has(normalizedFieldName)) return [];
      const valueType = inferValueTypeFromSchema(definition?.type);
      return [{
        ...createField(),
        fieldName: normalizedFieldName,
        label: typeof definition?.title === "string" && definition.title.trim() ? definition.title : normalizedFieldName,
        displayLabel: typeof definition?.title === "string" && definition.title.trim() ? definition.title : normalizedFieldName,
        description: typeof definition?.description === "string" ? definition.description : "",
        valueType,
        fieldType: inferFieldTypeFromValueType(valueType),
        required: requiredKeys.has(normalizedFieldName),
        defaultValue: typeof definition?.default === "string" || typeof definition?.default === "number" || typeof definition?.default === "boolean"
          ? definition.default
          : "",
        options: Array.isArray(definition?.enum)
          ? definition.enum.filter((item) => typeof item === "string" || typeof item === "number")
          : [],
      } satisfies RunningHubFieldDefinition];
    });
    return nextFields;
  } catch {
    return [];
  }
}

function buildFieldsFromRemoteNodeInfoList(value: unknown, existingFields: RunningHubFieldDefinition[]) {
  const remoteFields = Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const nodeId = String(row.nodeId || "").trim();
        const fieldName = String(row.fieldName || "").trim();
        if (!nodeId || !fieldName) return [];
        const remoteValueType = inferValueTypeFromFieldShape(row.fieldType, inferValueTypeFromFieldShape(row.valueType));
        return [{
          ...createField(),
          nodeId,
          fieldName,
          label: typeof row.label === "string" && row.label.trim() ? row.label : fieldName,
          displayLabel:
            typeof row.displayLabel === "string" && row.displayLabel.trim()
              ? row.displayLabel
              : typeof row.title === "string" && row.title.trim()
                ? row.title
                : typeof row.label === "string" && row.label.trim()
                  ? row.label
                  : fieldName,
          description: typeof row.description === "string" ? row.description : "",
          valueType: remoteValueType,
          fieldType: typeof row.fieldType === "string" && row.fieldType.trim()
            ? row.fieldType
            : inferFieldTypeFromValueType(remoteValueType),
          placeholder: typeof row.placeholder === "string" ? row.placeholder : "",
          required: typeof row.required === "boolean" ? row.required : false,
          fieldValue: typeof row.fieldValue === "string" || typeof row.fieldValue === "number" || typeof row.fieldValue === "boolean"
            ? row.fieldValue
            : "",
          defaultValue: typeof row.defaultValue === "string" || typeof row.defaultValue === "number" || typeof row.defaultValue === "boolean"
            ? row.defaultValue
            : "",
          options: Array.isArray(row.options)
            ? row.options.filter((option) => typeof option === "string" || typeof option === "number")
            : Array.isArray(row.fieldData)
              ? row.fieldData.filter((option) => typeof option === "string" || typeof option === "number")
              : [],
        } satisfies RunningHubFieldDefinition];
      })
    : [];

  const consumed = new Set<number>();
  const merged = remoteFields.map((remoteField) => {
    const exactIndex = existingFields.findIndex((field, index) => {
      if (consumed.has(index)) return false;
      return field.nodeId.trim() === remoteField.nodeId && field.fieldName.trim() === remoteField.fieldName;
    });
    const draftIndex = exactIndex >= 0
      ? exactIndex
      : existingFields.findIndex((field, index) => {
          if (consumed.has(index)) return false;
          return !field.nodeId.trim() && field.fieldName.trim() === remoteField.fieldName;
        });
    const fallbackIndex = draftIndex >= 0
      ? draftIndex
      : existingFields.findIndex((field, index) => {
          if (consumed.has(index)) return false;
          return field.fieldName.trim() === remoteField.fieldName;
        });
    if (fallbackIndex < 0) return remoteField;
    consumed.add(fallbackIndex);
    const current = existingFields[fallbackIndex];
    return {
      ...current,
      nodeId: remoteField.nodeId,
      fieldName: remoteField.fieldName,
      label: current.label?.trim() || remoteField.label,
      displayLabel: current.displayLabel?.trim() || remoteField.displayLabel || current.label?.trim() || remoteField.label,
      description: current.description?.trim() || remoteField.description,
      fieldType: current.fieldType?.trim() || remoteField.fieldType,
      valueType: current.valueType?.trim() || remoteField.valueType,
      placeholder: current.placeholder?.trim() || remoteField.placeholder,
      required: current.required ?? remoteField.required,
      fieldValue: current.fieldValue ?? remoteField.fieldValue,
      defaultValue: current.defaultValue ?? remoteField.defaultValue,
      options: current.options && current.options.length > 0 ? current.options : remoteField.options,
    } satisfies RunningHubFieldDefinition;
  });

  const remaining = existingFields.filter((_, index) => !consumed.has(index));
  const deduped = new Map<string, RunningHubFieldDefinition>();
  for (const field of [...merged, ...remaining]) {
    const fieldName = field.fieldName.trim();
    const nodeId = field.nodeId.trim();
    if (!fieldName) continue;
    const key = nodeId ? `${nodeId}::${fieldName}` : `draft::${fieldName}`;
    if (!deduped.has(key)) deduped.set(key, field);
  }
  return Array.from(deduped.values());
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
    pollingTimeoutMs: undefined,
    retryable: false,
  };
}

function defaultTestPayload(item: RunningHubAdminItem) {
  if (typeof item.testPayload === "string" && item.testPayload.trim()) return formatJsonText(item.testPayload);
  const slotPayload = (item.fields || []).reduce<Record<string, unknown>>((acc, field) => {
    const key = field.displayLabel?.trim() || field.label?.trim() || field.fieldName;
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
    displayLabel: "",
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
          <span>标注/显示名</span>
          <input value={value.displayLabel || ""} onChange={(e) => onChange({ ...value, displayLabel: e.target.value })} />
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
          <span>字段类型预设</span>
          <select value={value.fieldType || "TEXT"} onChange={(e) => onChange({ ...value, fieldType: e.target.value })}>
            {mergePresetOptions(value.fieldType, FIELD_TYPE_PRESET_OPTIONS).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>字段类型自定义</span>
          <input value={value.fieldType || ""} onChange={(e) => onChange({ ...value, fieldType: e.target.value })} placeholder="允许自定义覆盖" />
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
      <input value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as RunningHubOutputDefinition["kind"] })} placeholder="输出类型预设 / 允许自定义覆盖" />
      <select value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as RunningHubOutputDefinition["kind"] })}>
        {mergePresetOptions(value.kind, OUTPUT_KIND_PRESET_OPTIONS).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <select value={value.path || "data"} onChange={(e) => onChange({ ...value, path: e.target.value })}>
        {mergePresetOptions(value.path, OUTPUT_PATH_PRESET_OPTIONS).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <input value={value.path || ""} onChange={(e) => onChange({ ...value, path: e.target.value })} placeholder="结果路径预设 / 允许自定义覆盖" />
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
  onDelete,
  onDuplicate,
  onToggleEnabled,
  groups = [],
}: {
  item: RunningHubAdminItem | null;
  saving: boolean;
  testing: boolean;
  testResult: RunningHubAdminItemTestResult | null;
  onSave: (catalogId: string, payload: RunningHubAdminItemUpdatePayload) => Promise<void>;
  onTest: (catalogId: string, payload: { testPayload?: string }) => Promise<void>;
  onDelete: (catalogId: string) => Promise<void>;
  onDuplicate: (catalogId: string) => Promise<void>;
  onToggleEnabled: (catalogId: string, enabled: boolean) => Promise<void>;
  groups?: RunningHubGroup[];
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [pageId, setPageId] = useState("");
  const [appId, setAppId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [runTargetId, setRunTargetId] = useState("");
  const [taskCapability, setTaskCapability] = useState<"image" | "video" | "audio" | "chat">("video");
  const [groupId, setGroupId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [syncingSlots, setSyncingSlots] = useState(false);
  const [fields, setFields] = useState<RunningHubFieldDefinition[]>([]);
  const [parameterSchema, setParameterSchema] = useState("{}");
  const [parameterSchemaError, setParameterSchemaError] = useState("");
  const [outputs, setOutputs] = useState<RunningHubOutputDefinition[]>([]);
  const [executionRules, setExecutionRules] = useState<RunningHubExecutionRules | null>(null);
  const [testPayload, setTestPayload] = useState("{}");
  const [testPayloadError, setTestPayloadError] = useState("");
  const [slotError, setSlotError] = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle(item.title || item.catalogId);
    setNote(item.note || "");
    setPageId(item.pageId || item.id || "");
    setAppId(item.appId || "");
    setWorkflowId(item.workflowId || "");
    setRunTargetId(item.runTargetId || item.appId || item.workflowId || item.id);
    setTaskCapability(item.taskCapability || "video");
    setGroupId(item.groupId || "");
    setEnabled(item.enabled);
    setFields(item.fields || []);
    setParameterSchema(defaultParameterSchema(item));
    setParameterSchemaError("");
    setOutputs(inferOutputDefinitions(item));
    setExecutionRules(defaultExecutionRules(item));
    setTestPayload(defaultTestPayload(item));
    setTestPayloadError("");
    setSlotError("");
  }, [item]);

  const validFieldCount = useMemo(
    () => fields.filter((field) => field.nodeId.trim() && field.fieldName.trim()).length,
    [fields],
  );

  const slotSummary = useMemo(
    () =>
      fields
        .filter((field) => field.nodeId.trim() && field.fieldName.trim())
        .map((field) => ({
          key: `${field.nodeId}:${field.fieldName}`,
          title: field.label || field.fieldName,
          required: Boolean(field.required),
          type: field.valueType || field.fieldType || "string",
        })),
    [fields],
  );

  const schemaPropertyCount = useMemo(
    () => countSchemaProperties(parameterSchema),
    [parameterSchema],
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
  const allowsEmptyInputs = currentItem.allowsEmptyInputs === true;
  const enablementState = enabled
    ? validFieldCount > 0
      ? "已满足"
      : allowsEmptyInputs
        ? "无入参可直接启用"
        : "缺少输入槽"
    : "草稿可保存";

  async function handleSave() {
    try {
      const parsedSchema = parseObjectJson(parameterSchema);
      const normalizedSchema = JSON.stringify(parsedSchema, null, 2);
      const normalizedTestPayload = parseAnyJson(testPayload, "测试运行输入必须是有效 JSON。");
      if (enabled && validFieldCount <= 0 && !allowsEmptyInputs) {
        throw new Error("当前 RH 条目仍缺少输入槽定义，不能启用。请至少补齐一个包含 nodeId 和 fieldName 的输入槽，或先保存为停用草稿。");
      }
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
      setSlotError("");
      await onSave(currentItem.catalogId, {
        title: title.trim() || currentItem.catalogId,
        note: note.trim(),
        enabled,
        pageId: pageId.trim(),
        appId: currentKind === "app" ? appId.trim() || nextRunTargetId : "",
        workflowId: currentKind === "workflow" ? workflowId.trim() || nextRunTargetId : "",
        runTargetId: nextRunTargetId,
        taskCapability,
        groupId,
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
      } else if (/输入槽定义|不能启用/.test(message)) {
        setSlotError(message);
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

  function handleGenerateFieldsFromSchema() {
    const generatedFields = buildFieldsFromParameterSchema(parameterSchema, fields);
    if (generatedFields.length <= 0) {
      setSlotError("当前 Schema 没有可追加的参数项，或这些参数已经生成过输入槽草稿。");
      return;
    }
    setFields((current) => [...current, ...generatedFields]);
    setSlotError(`已从 Schema 生成 ${generatedFields.length} 个输入槽草稿，仍需补齐 nodeId 后才能启用并执行。`);
  }

  async function handleSyncFieldsFromRunTarget() {
    const targetId = runTargetId.trim() || (currentKind === "app" ? appId.trim() : workflowId.trim()) || currentItem.runTargetId || currentItem.id;
    if (!targetId) {
      setSlotError("当前还没有可用的运行目标 ID，无法同步输入槽。请先补齐“实际运行 ID”。");
      return;
    }
    setSyncingSlots(true);
    try {
      const remoteInfo = await adminRunningHubApi.fetchRemoteAppInfo(targetId);
      const remoteList = Array.isArray(remoteInfo.nodeInfoList) ? remoteInfo.nodeInfoList : [];
      const mergedFields = buildFieldsFromRemoteNodeInfoList(remoteList, fields);
      if (!remoteList.length || !mergedFields.length) {
        throw new Error("运行目标未返回可用的 nodeInfoList，暂时无法自动同步输入槽。");
      }
      setFields(mergedFields);
      setSlotError(`已从运行目标同步 ${remoteList.length} 个真实字段，当前可执行绑定 ${mergedFields.filter((field) => field.nodeId.trim() && field.fieldName.trim()).length} 个。`);
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "同步运行目标输入槽失败。");
    } finally {
      setSyncingSlots(false);
    }
  }

  return (
    <section className="api-card admin-runninghub-editor">
      <div className="admin-runninghub-editor__shell">
        <div className="admin-runninghub-editor__head">
          <div className="admin-runninghub-editor__copy">
            <span>{currentItem.kind === "app" ? "AI 应用" : "工作流"}</span>
            <strong>{currentItem.title || currentItem.catalogId}</strong>
            <p>{currentItem.note || "当前条目尚未填写备注。"}</p>
            <div className="admin-runninghub-editor__section-nav" aria-label="当前编辑区块">
              <span className="admin-runninghub-editor__section-chip">基础信息</span>
              <span className="admin-runninghub-editor__section-chip">输入槽</span>
              <span className="admin-runninghub-editor__section-chip">Schema</span>
              <span className="admin-runninghub-editor__section-chip">输出</span>
              <span className="admin-runninghub-editor__section-chip">执行规则</span>
            </div>
          </div>
          <div className="admin-runninghub-editor__actions">
            <span>{currentItem.providerName}</span>
            <span>{enabled ? "已启用" : "已停用"}</span>
            <button type="button" className="ghost-action" onClick={() => void onDuplicate(currentItem.catalogId)} disabled={saving}>
              <Plus aria-hidden="true" /> 另存为
            </button>
            <button type="button" className="ghost-action" onClick={() => void onToggleEnabled(currentItem.catalogId, !enabled)} disabled={saving}>
              {enabled ? "停用条目" : "启用条目"}
            </button>
            <button type="button" className="ghost-action danger" onClick={() => void onDelete(currentItem.catalogId)} disabled={saving}>
              <Trash2 aria-hidden="true" /> 删除
            </button>
            <button type="button" className="ghost-action" onClick={() => void handleSave()} disabled={saving}>
              <Save aria-hidden="true" /> {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        <div className="admin-runninghub-editor__body">
          <div className="admin-runninghub-editor__main">
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
                  <span>页面 ID</span>
                  <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="详情页或条目页 ID" />
                </label>
                <label>
                  <span>{currentKind === "app" ? "AI 应用 ID" : "工作流运行 ID"}</span>
                  <input
                    value={currentKind === "app" ? appId : workflowId}
                    onChange={(e) => currentKind === "app" ? setAppId(e.target.value) : setWorkflowId(e.target.value)}
                    placeholder={currentKind === "app" ? "提交 AI 应用时使用的 appId" : "提交工作流时使用的 workflowId"}
                  />
                </label>
                <label>
                  <span>实际运行 ID</span>
                  <input value={runTargetId} onChange={(e) => setRunTargetId(e.target.value)} />
                </label>
                <label>
                  <span>任务能力</span>
                  <select value={taskCapability} onChange={(e) => setTaskCapability(e.target.value as "image" | "video" | "audio" | "chat")}>
                    <option value="image">image</option>
                    <option value="video">video</option>
                    <option value="audio">audio</option>
                    <option value="chat">chat</option>
                  </select>
                </label>
                <label>
                  <span>所属分组</span>
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="">未分组</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}{group.enabled ? "" : "（停用）"}</option>)}
                  </select>
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
                <div className="admin-runninghub-editor__section-actions">
                  <button type="button" className="ghost-action" onClick={() => void handleSyncFieldsFromRunTarget()} disabled={syncingSlots}>
                    <Plus aria-hidden="true" /> {syncingSlots ? "同步中..." : "从运行目标同步输入槽"}
                  </button>
                  <button type="button" className="ghost-action" onClick={handleGenerateFieldsFromSchema}>
                    <Plus aria-hidden="true" /> 从 Schema 生成输入槽草稿
                  </button>
                  <button type="button" className="ghost-action" onClick={() => setFields((current) => [...current, createField()])}>
                    <Plus aria-hidden="true" /> 添加输入槽
                  </button>
                </div>
              </div>
              <div className="admin-runninghub-editor__empty-note">
                {allowsEmptyInputs
                  ? "当前条目已被标记为显式无入参工作流。输入槽区为空属于正常现象，可以直接启用并执行；如果后续拿到真实 nodeInfoList，也可以再补充绑定。"
                  : "如果当前已经整理好了参数 Schema，可以先生成输入槽草稿，再逐条补齐 nodeId。没有 nodeId 的草稿还不能执行。"}
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
                <div className="admin-runninghub-editor__empty-note">
                  {allowsEmptyInputs ? "当前未配置输入槽。该条目属于显式无入参工作流，这里为空是正常状态。" : "当前未配置输入槽。至少补齐 nodeId 和 fieldName 后再保存。"}
                </div>
              )}
              {slotError ? <div className="probe-note">失败: {slotError}</div> : null}
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
              {schemaPropertyCount > 0 ? (
                <div className="admin-runninghub-editor__empty-note">
                  {allowsEmptyInputs
                    ? `当前 Schema 识别到 ${schemaPropertyCount} 个结构化参数。由于该条目被标记为显式无入参工作流，只有在后续补齐真实 RH 绑定字段时，这些参数才会展开为可执行输入区。`
                    : `当前 Schema 识别到 ${schemaPropertyCount} 个结构化参数。只有补齐对应的 RH 绑定字段后，画布节点才会把它们作为可执行参数区展开。`}
                </div>
              ) : null}
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
                  <strong>执行规则</strong>
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
                      value={executionRules.pollingTimeoutMs ?? ""}
                      placeholder="留空表示不设置"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setExecutionRules({
                          ...executionRules,
                          pollingTimeoutMs: raw && Number(raw) > 0 ? Math.max(0, Number(raw) || 0) : undefined,
                        });
                      }}
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
          </div>

          <aside className="admin-runninghub-editor__side-panel">
            <section className="admin-runninghub-editor__section admin-runninghub-editor__summary-card">
              <div className="admin-runninghub-editor__section-head">
                <div>
                  <strong>条目摘要</strong>
                  <span>先确认运行标识、输入规模和当前状态。</span>
                </div>
              </div>
              <dl className="admin-runninghub-editor__details">
                <div>
                  <dt>catalogId</dt>
                  <dd>{currentItem.catalogId}</dd>
                </div>
                <div>
                  <dt>条目类型</dt>
                  <dd>{currentKind === "app" ? "AI 应用" : "工作流"}</dd>
                </div>
                <div>
                  <dt>运行目标</dt>
                  <dd>{runTargetId || "未配置"}</dd>
                </div>
                <div>
                  <dt>页面 ID</dt>
                  <dd>{pageId || "未配置"}</dd>
                </div>
                <div>
                  <dt>输入槽数</dt>
                  <dd>{validFieldCount}</dd>
                </div>
                <div>
                  <dt>输出定义数</dt>
                  <dd>{outputs.length}</dd>
                </div>
                <div>
                  <dt>Schema 参数数</dt>
                  <dd>{schemaPropertyCount}</dd>
                </div>
                <div>
                  <dt>启用条件</dt>
                  <dd>{enablementState}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-runninghub-editor__section admin-runninghub-editor__side-card">
              <div className="admin-runninghub-editor__section-head">
                <div>
                  <strong>测试与调试</strong>
                  <span>先在这里做预览校验，再去下方 AI 分析板块补接入草案。</span>
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
          </aside>
        </div>
      </div>
    </section>
  );
}
