import type { RhCatalogItem, RhCatalogItemKind } from "@xinghuan/shared";
import { buildRunningHubExecutionDescriptor } from "./runninghub-execution-descriptor.js";

export interface RunningHubFieldDefinition {
  nodeId: string;
  fieldName: string;
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

export interface RunningHubCatalogEntry {
  id: string;
  title: string;
  note?: string;
  thumbnail?: string;
  enabled: boolean;
  kind?: RhCatalogItemKind;
  appId?: string;
  workflowId?: string;
  runTargetId?: string;
  workflowJson?: string;
  fields?: RunningHubFieldDefinition[];
}

export interface RunningHubProviderLike {
  id: string;
  name: string;
  baseUrl: string;
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

export function parseRunningHubRef(value: unknown) {
  const text = safeText(value);
  const match = text.match(/\/run\/(ai-app|workflow)\/([0-9A-Za-z_-]+)/i);
  if (match) return { type: match[1].toLowerCase() === "ai-app" ? "app" : "workflow", id: match[2] };
  const plain = text.match(/^[0-9A-Za-z_-]{6,}$/);
  return plain ? { type: "workflow" as const, id: text } : null;
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

export function normalizeRunningHubCatalogItem(value: unknown, kind: RhCatalogItemKind): RunningHubCatalogEntry | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parsed = parseRunningHubRef(row.id || row.appId || row.workflowId || "");
  const id = safeText(parsed?.id || row.id || row.appId || row.workflowId);
  if (!id) return null;
  return {
    id,
    kind,
    appId: kind === "app" ? safeText(row.appId || id) : undefined,
    workflowId: kind === "workflow" ? safeText(row.workflowId || id) : undefined,
    runTargetId: safeText(row.runTargetId || (kind === "app" ? row.appId : row.workflowId) || id),
    title: safeText(row.title, kind === "app" ? `AI 应用 ${id.slice(-6)}` : `工作流 ${id.slice(-6)}`),
    note: safeText(row.note),
    thumbnail: safeText(row.thumbnail),
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
    workflowJson: normalizeOptionalJsonText(row.workflowJson),
    fields: normalizeRunningHubFieldDefinitions(row.fields),
  };
}

export function normalizeRunningHubCatalogItems(value: unknown, kind: RhCatalogItemKind): RunningHubCatalogEntry[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => normalizeRunningHubCatalogItem(item, kind))
    .filter(Boolean) as RunningHubCatalogEntry[];
}

export function toPublicRunningHubCatalogItem(
  provider: RunningHubProviderLike,
  entry: RunningHubCatalogEntry,
): RhCatalogItem & {
  appIdAlias: string;
  workflowIdAlias: string;
  fieldsAlias: RunningHubFieldDefinition[];
} {
  const execution = buildRunningHubExecutionDescriptor(entry);
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
    appId: execution.appId,
    workflowId: execution.workflowId,
    runTargetId: execution.runTargetId,
    fields: execution.inputSlots,
    execution,
    workflowJson: execution.workflowJson,
    appIdAlias: execution.appId,
    workflowIdAlias: execution.workflowId,
    fieldsAlias: normalizeRunningHubFieldDefinitions(entry.fields),
  };
}
