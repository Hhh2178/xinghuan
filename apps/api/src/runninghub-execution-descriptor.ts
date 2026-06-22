import type {
  RhCatalogItemKind,
  RhExecutionDescriptor,
  RhInputSlotDefinition,
  RhSlotCardinality,
  RhSlotDataType,
} from "@xinghuan/shared";

export interface RunningHubFieldDefinitionLike {
  nodeId?: string;
  fieldName?: string;
  label?: string;
  displayLabel?: string;
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
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  taskCapability?: "image" | "video" | "audio" | "chat";
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

function inferSlotDataType(field: RunningHubFieldDefinitionLike): RhSlotDataType {
  const valueType = safeText(field.valueType).toLowerCase();
  const fieldType = safeText(field.fieldType).toLowerCase();
  const combined = `${valueType} ${fieldType}`;
  if (/image|img|picture/.test(combined)) return "image";
  if (/video/.test(combined)) return "video";
  if (/audio|voice|sound/.test(combined)) return "audio";
  if (/json|object|array/.test(combined)) return "json";
  return "text";
}

function inferSlotCardinality(field: RunningHubFieldDefinitionLike): RhSlotCardinality {
  if (Array.isArray(field.options) && field.options.length > 1) return "single";
  const combined = `${safeText(field.valueType).toLowerCase()} ${safeText(field.fieldType).toLowerCase()}`;
  return /array|list|multi|multiple/.test(combined) ? "multiple" : "single";
}

function inferSupportsUpload(dataType: RhSlotDataType) {
  return dataType === "image" || dataType === "video" || dataType === "audio";
}

export function normalizeRunningHubInputSlots(fields: RunningHubFieldDefinitionLike[] | undefined): RhInputSlotDefinition[] {
  const list = Array.isArray(fields) ? fields : [];
  return list
    .map((field) => {
      const nodeId = safeText(field.nodeId);
      const fieldName = safeText(field.fieldName);
      if (!nodeId || !fieldName) return null;
      const dataType = inferSlotDataType(field);
      const cardinality = inferSlotCardinality(field);
      const options = Array.isArray(field.options)
        ? field.options.filter((item) => typeof item === "string" || (typeof item === "number" && Number.isFinite(item)))
        : undefined;
      return {
        key: `${nodeId}:${fieldName}`,
        name: fieldName,
        title: safeText(field.displayLabel || field.label, fieldName),
        description: safeText(field.description),
        dataType,
        cardinality,
        required: Boolean(field.required),
        supportsConnection: true,
        supportsManualInput: dataType === "text" || dataType === "json",
        supportsUpload: inferSupportsUpload(dataType),
        bindingTarget: {
          nodeId,
          fieldName,
          path: `${nodeId}.${fieldName}`,
        },
        placeholder: safeText(field.placeholder),
        defaultValue: normalizePrimitive(field.defaultValue),
        manualValue: normalizePrimitive(field.fieldValue),
        options: options && options.length > 0 ? options : undefined,
      } satisfies RhInputSlotDefinition;
    })
    .filter(Boolean) as RhInputSlotDefinition[];
}

export function buildRunningHubExecutionDescriptor(item: RunningHubCatalogSourceLike): RhExecutionDescriptor {
  const kind = item.kind === "app" ? "app" : "workflow";
  const pageId = safeText(item.pageId || item.appId || item.workflowId || item.runTargetId);
  const appId = kind === "app" ? safeText(item.appId || item.runTargetId || item.pageId) : "";
  const workflowId = kind === "workflow" ? safeText(item.workflowId || item.runTargetId || item.pageId) : "";
  const runTargetId = safeText(item.runTargetId || (kind === "app" ? appId : workflowId));
  const taskCapability = item.taskCapability === "image" || item.taskCapability === "audio" || item.taskCapability === "chat"
    ? item.taskCapability
    : "video";
  return {
    submit: {
      mode: "direct",
      targetType: kind,
      targetId: runTargetId,
      pageId: pageId || undefined,
      appId: appId || undefined,
      workflowId: workflowId || undefined,
      taskCapability,
      submitMode: kind === "app" ? "ai-app" : "openapi-v2-workflow",
      queryMode: kind === "app" ? "outputs" : "openapi-v2-query",
      endpoint: kind === "app" ? `/runninghub/app/${runTargetId}/run` : `/runninghub/workflow/${runTargetId}/run`,
      method: "POST",
    },
    assetHandling: {
      input: {
        acceptsUploads: true,
        acceptsRemoteUrls: true,
        requiresPreSignedUrls: false,
      },
      output: {
        resultKind: "remote-url",
        supportsMultiple: true,
      },
    },
    polling: {
      strategy: "fixed-interval",
      intervalMs: 5000,
      timeoutMs: 20 * 60 * 1000,
    },
    result: {
      mode: "inline",
      payloadPath: "data",
      errorPath: "message",
    },
    errorHandling: {
      surface: "provider-message",
      retryable: false,
      messagePath: "message",
    },
  };
}
