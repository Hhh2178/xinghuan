import type { RhCatalogItem, RhCatalogItemKind } from "@xinghuan/shared";
import { buildRunningHubExecutionDescriptor, normalizeRunningHubInputSlots } from "./runninghub-execution-descriptor.js";

export interface RunningHubFieldDefinition {
  nodeId: string;
  fieldName: string;
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

export interface RunningHubCatalogEntry {
  id: string;
  title: string;
  note?: string;
  thumbnail?: string;
  enabled: boolean;
  kind?: RhCatalogItemKind;
  pageId?: string;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  taskCapability?: "image" | "video" | "audio" | "chat";
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
  allowsEmptyInputs?: boolean;
}

export interface RunningHubAdminEditorMetadata {
  parameterSchema?: string;
  outputSchema?: RunningHubOutputDefinition[];
  executionRules?: RunningHubExecutionRules;
  testPayload?: string;
}

export interface RunningHubAdminCatalogEntry extends RunningHubCatalogEntry, RunningHubAdminEditorMetadata {}

export interface RunningHubProviderLike {
  id: string;
  name: string;
  baseUrl: string;
}

export interface RunningHubAdminItem extends RhCatalogItem, RunningHubAdminEditorMetadata {}

export interface RunningHubOutputDefinition {
  key: string;
  label: string;
  kind: string;
  path?: string;
  multiple?: boolean;
}

export interface RunningHubExecutionRules {
  submitMode: "direct";
  targetType: "app" | "workflow";
  method: "POST";
  endpoint: string;
  resultPath: string;
  errorPath: string;
  acceptsUploads: boolean;
  acceptsRemoteUrls: boolean;
  outputKind: "remote-url";
  supportsMultipleOutputs: boolean;
  pollingStrategy: "none" | "fixed-interval";
  pollingIntervalMs: number;
  pollingTimeoutMs: number;
  retryable: boolean;
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

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        if (typeof row.value === "number" && Number.isFinite(row.value)) return row.value;
        if (typeof row.value === "string") return row.value.trim();
        if (typeof row.label === "string") return row.label.trim();
        if (typeof row.name === "string") return row.name.trim();
      }
      return "";
    })
    .filter((item) => item !== "" && item !== null && item !== undefined);
  return options.length > 0 ? options : undefined;
}

function normalizeOptionalJsonText(value: unknown) {
  const text = safeText(value);
  if (!text) return "";
  try {
    JSON.parse(text);
    return text;
  } catch {
    return "";
  }
}

function normalizeOutputKind(value: unknown): RunningHubOutputDefinition["kind"] {
  const kind = safeText(value).toLowerCase();
  return kind || "image";
}

function normalizeRunningHubOutputDefinitions(value: unknown): RunningHubOutputDefinition[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const key = safeText(row.key, "", 120);
      const label = safeText(row.label, "", 120);
      if (!key || !label) return null;
      return {
        key,
        label,
        kind: normalizeOutputKind(row.kind),
        path: safeText(row.path, "", 500),
        multiple: row.multiple === undefined ? true : Boolean(row.multiple),
      } satisfies RunningHubOutputDefinition;
    })
    .filter(Boolean) as RunningHubOutputDefinition[];
}

function normalizeRunningHubExecutionRules(value: unknown, kind: "app" | "workflow", targetId: string): RunningHubExecutionRules | undefined {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!row) return undefined;
  const pollingStrategy = safeText(row.pollingStrategy).toLowerCase() === "fixed-interval" ? "fixed-interval" : "none";
  return {
    submitMode: "direct",
    targetType: kind,
    method: "POST",
    endpoint: safeText(
      row.endpoint,
      kind === "app" ? `/runninghub/app/${targetId}/run` : `/runninghub/workflow/${targetId}/run`,
      1000,
    ),
    resultPath: safeText(row.resultPath, "data", 240),
    errorPath: safeText(row.errorPath, "message", 240),
    acceptsUploads: row.acceptsUploads === undefined ? true : Boolean(row.acceptsUploads),
    acceptsRemoteUrls: row.acceptsRemoteUrls === undefined ? true : Boolean(row.acceptsRemoteUrls),
    outputKind: "remote-url",
    supportsMultipleOutputs: row.supportsMultipleOutputs === undefined ? true : Boolean(row.supportsMultipleOutputs),
    pollingStrategy,
    pollingIntervalMs: Number.isFinite(Number(row.pollingIntervalMs)) ? Math.max(0, Number(row.pollingIntervalMs)) : 0,
    pollingTimeoutMs: Number.isFinite(Number(row.pollingTimeoutMs)) ? Math.max(0, Number(row.pollingTimeoutMs)) : 0,
    retryable: Boolean(row.retryable),
  };
}

export function parseRunningHubRef(value: unknown) {
  const text = safeText(value);
  // Example AI App doc pattern: call-api/api-detail/1978404642654670849?apiType=4
  const apiDetailAppMatch = text.match(/call-api\/api-detail\/([0-9A-Za-z_-]+)\?apiType=4/i);
  if (apiDetailAppMatch) return { type: "app" as const, id: apiDetailAppMatch[1] };
  const openapiMatch = text.match(/\/(?:openapi\/v2\/)?run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i);
  if (openapiMatch) {
    const type = openapiMatch[1].toLowerCase() === "ai-app" ? "app" as const : "workflow" as const;
    return { type, id: openapiMatch[2] };
  }
  const match = text.match(/\/run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i);
  if (match) {
    const type = match[1].toLowerCase() === "ai-app" ? "app" as const : "workflow" as const;
    return { type, id: match[2] };
  }
  if (/^workflow-[0-9A-Za-z_-]+$/i.test(text)) return { type: "workflow" as const, id: text };
  return null;
}

export function normalizeRunningHubFieldDefinitions(value: unknown): RunningHubFieldDefinition[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const nodeId = safeText(row.nodeId, "", 240);
      const fieldName = safeText(row.fieldName, "", 240);
      if (!nodeId || !fieldName) return null;
      return {
        nodeId,
        fieldName,
        label: safeText(row.label, "", 240),
        displayLabel: safeText(row.displayLabel || row.title, "", 240),
        description: safeText(row.description, "", 2000),
        fieldType: safeText(row.fieldType, "", 240),
        valueType: safeText(row.valueType, "", 240),
        placeholder: safeText(row.placeholder, "", 1000),
        required: row.required === undefined ? undefined : Boolean(row.required),
        fieldValue: normalizePrimitive(row.fieldValue),
        defaultValue: normalizePrimitive(row.defaultValue),
        options: normalizeOptions(row.options || row.fieldData || row.list || row.values),
      } satisfies RunningHubFieldDefinition;
    })
    .filter(Boolean) as RunningHubFieldDefinition[];
}

export function normalizeRunningHubCatalogItem(value: unknown, kind: RhCatalogItemKind): RunningHubAdminCatalogEntry | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parsed = parseRunningHubRef(row.id || row.appId || row.workflowId || row.runTargetId || "");
  const id = safeText(parsed?.id || row.id || row.appId || row.workflowId || row.runTargetId);
  if (!id) return null;
  const pageId = safeText(row.pageId || row.id || (kind === "app" ? row.appId : row.workflowId) || id);
  const runTargetId = safeText(row.runTargetId || (kind === "app" ? row.appId : row.workflowId) || id);
  const taskCapabilityText = safeText(row.taskCapability).toLowerCase();
  const taskCapability =
    taskCapabilityText === "image" || taskCapabilityText === "audio" || taskCapabilityText === "chat"
      ? taskCapabilityText as "image" | "audio" | "chat"
      : "video";
  return {
    id,
    kind,
    pageId,
    appId: kind === "app" ? safeText(row.appId || runTargetId || id) : safeText(row.appId),
    workflowId: kind === "workflow" ? safeText(row.workflowId || runTargetId || id) : safeText(row.workflowId),
    runTargetId,
    taskCapability,
    title: safeText(row.title, kind === "app" ? `AI 应用 ${id.slice(-6)}` : `工作流 ${id.slice(-6)}`),
    note: safeText(row.note),
    thumbnail: safeText(row.thumbnail),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
    workflowJson: normalizeOptionalJsonText(row.workflowJson),
    fields: normalizeRunningHubFieldDefinitions(row.fields),
    allowsEmptyInputs: row.allowsEmptyInputs === true,
    parameterSchema: normalizeOptionalJsonText(row.parameterSchema) || "{}",
    outputSchema: normalizeRunningHubOutputDefinitions(row.outputSchema),
    executionRules: normalizeRunningHubExecutionRules(row.executionRules, kind, runTargetId),
    testPayload: normalizeOptionalJsonText(row.testPayload) || "{}",
  };
}

export function normalizeRunningHubCatalogItems(value: unknown, kind: RhCatalogItemKind): RunningHubAdminCatalogEntry[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => normalizeRunningHubCatalogItem(item, kind))
    .filter(Boolean) as RunningHubAdminCatalogEntry[];
}

export function toPublicRunningHubCatalogItem(provider: RunningHubProviderLike, entry: RunningHubCatalogEntry): RhCatalogItem {
  const fields = normalizeRunningHubFieldDefinitions(entry.fields);
  return {
    catalogId: `${provider.id}:${entry.kind || "workflow"}:${entry.id}`,
    providerId: provider.id,
    providerName: provider.name,
    providerBaseUrl: provider.baseUrl,
    id: entry.id,
    kind: entry.kind || "workflow",
    title: entry.title,
    note: entry.note || "",
    thumbnail: entry.thumbnail || "",
    enabled: entry.enabled,
    inputSlots: normalizeRunningHubInputSlots(fields),
    execution: buildRunningHubExecutionDescriptor(entry),
    pageId: entry.pageId || entry.id,
    appId: entry.appId || "",
    workflowId: entry.workflowId || "",
    runTargetId: entry.runTargetId || entry.workflowId || entry.appId || entry.id,
    taskCapability: entry.taskCapability === "image" || entry.taskCapability === "audio" || entry.taskCapability === "chat"
      ? entry.taskCapability
      : "video",
    workflowJson: entry.workflowJson || "",
    allowsEmptyInputs: entry.allowsEmptyInputs === true,
    parameterSchema: normalizeOptionalJsonText((entry as RunningHubAdminCatalogEntry).parameterSchema) || "{}",
    outputSchema: normalizeRunningHubOutputDefinitions((entry as RunningHubAdminCatalogEntry).outputSchema),
    fields,
  };
}

export function toAdminRunningHubCatalogItem(provider: RunningHubProviderLike, entry: RunningHubAdminCatalogEntry): RunningHubAdminItem {
  const publicItem = toPublicRunningHubCatalogItem(provider, entry);
  return {
    ...publicItem,
    parameterSchema: entry.parameterSchema || "{}",
    outputSchema: normalizeRunningHubOutputDefinitions(entry.outputSchema),
    executionRules: normalizeRunningHubExecutionRules(entry.executionRules, entry.kind || "workflow", entry.runTargetId || entry.id),
    testPayload: entry.testPayload || "{}",
  };
}
