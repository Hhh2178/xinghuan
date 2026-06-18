import type {
  RhCatalogItemKind,
  RhExecutionDescriptor,
  RhInputSlotDefinition,
  RhInputValueType,
} from "@xinghuan/shared";

export interface RunningHubFieldDefinitionLike {
  nodeId?: string;
  fieldName?: string;
  label?: string;
  description?: string;
  fieldType?: string;
  valueType?: string;
  placeholder?: string;
  required?: boolean;
  fieldValue?: string | number | boolean;
  defaultValue?: string | number | boolean;
  options?: Array<string | number>;
}

export interface RunningHubCatalogSourceLike {
  kind?: RhCatalogItemKind;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinitionLike[];
}

function safeText(value: unknown, fallback = "", maxLength = 4000) {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const normalized = text.trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizePrimitive(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = safeText(value);
  return text || undefined;
}

function normalizeValueType(value: unknown, fieldType: string, options?: Array<string | number>): RhInputValueType {
  const normalized = safeText(value).toLowerCase();
  if (normalized === "string" || normalized === "number" || normalized === "boolean" || normalized === "json") return normalized;
  if (normalized === "select" || (Array.isArray(options) && options.length > 0)) return "select";
  if (fieldType === "number" || fieldType === "slider") return "number";
  if (fieldType === "switch" || fieldType === "checkbox" || fieldType === "boolean") return "boolean";
  if (fieldType === "json" || fieldType === "object") return "json";
  if (fieldType === "select" || fieldType === "enum") return "select";
  if (fieldType) return "string";
  return "unknown";
}

export function normalizeRunningHubInputSlots(fields: RunningHubFieldDefinitionLike[] | undefined): RhInputSlotDefinition[] {
  const list = Array.isArray(fields) ? fields : [];
  return list
    .map((field) => {
      const nodeId = safeText(field.nodeId);
      const fieldName = safeText(field.fieldName);
      if (!nodeId || !fieldName) return null;
      const options = Array.isArray(field.options)
        ? field.options.filter((item) => typeof item === "string" || (typeof item === "number" && Number.isFinite(item)))
        : undefined;
      const fieldType = safeText(field.fieldType);
      return {
        key: `${nodeId}:${fieldName}`,
        nodeId,
        fieldName,
        label: safeText(field.label, fieldName),
        description: safeText(field.description),
        fieldType,
        valueType: normalizeValueType(field.valueType, fieldType, options),
        placeholder: safeText(field.placeholder),
        required: Boolean(field.required),
        defaultValue: normalizePrimitive(field.defaultValue),
        fieldValue: normalizePrimitive(field.fieldValue),
        options: options && options.length > 0 ? options : undefined,
      } satisfies RhInputSlotDefinition;
    })
    .filter(Boolean) as RhInputSlotDefinition[];
}

export function buildRunningHubExecutionDescriptor(item: RunningHubCatalogSourceLike): RhExecutionDescriptor {
  const kind = item.kind === "app" ? "app" : "workflow";
  const appId = kind === "app" ? safeText(item.appId || item.runTargetId) : safeText(item.appId);
  const workflowId = kind === "workflow" ? safeText(item.workflowId || item.runTargetId) : safeText(item.workflowId);
  const runTargetId = safeText(item.runTargetId || (kind === "app" ? appId : workflowId));
  return {
    kind,
    targetType: kind,
    targetId: runTargetId,
    appId,
    workflowId,
    runTargetId,
    workflowJson: safeText(item.workflowJson),
    inputSlots: normalizeRunningHubInputSlots(item.fields),
  };
}
