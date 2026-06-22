import type { RhCatalogItem, RhInputSlotDefinition } from "@xinghuan/shared";

export interface RunningHubCatalogWorkflowField {
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

export interface RunningHubCatalogItem extends RhCatalogItem {
  fields: RunningHubCatalogWorkflowField[];
  parameterSchema?: string;
}

export interface LegacyRunningHubCatalogWorkflow {
  catalogId: string;
  providerId: string;
  providerName: string;
  providerBaseUrl: string;
  id: string;
  kind: "app" | "workflow";
  appId?: string;
  workflowId?: string;
  runTargetId: string;
  title: string;
  note?: string;
  thumbnail?: string;
  workflowJson?: string;
  fields: RunningHubCatalogWorkflowField[];
}

export interface RunningHubCatalogResponse {
  items: RunningHubCatalogItem[];
  providers: Array<{
    id: string;
    name: string;
    baseUrl: string;
    items: RunningHubCatalogItem[];
    workflows: RunningHubCatalogItem[];
    apps: RunningHubCatalogItem[];
  }>;
  workflows: RunningHubCatalogItem[];
  apps: RunningHubCatalogItem[];
}

function inferFieldType(valueType: string | undefined) {
  const value = String(valueType || "").trim().toLowerCase();
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  if (value === "audio") return "AUDIO";
  if (value === "json") return "JSON";
  if (value === "number") return "NUMBER";
  if (value === "boolean") return "BOOLEAN";
  return "TEXT";
}

function parseWorkflowJson(value: string | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeFields(fields: unknown): RunningHubCatalogWorkflowField[] {
  return Array.isArray(fields)
    ? fields
        .map((field) => {
          if (!field || typeof field !== "object") return null;
          const row = field as Record<string, unknown>;
          const nodeId = String(row.nodeId || "").trim();
          const fieldName = String(row.fieldName || "").trim();
          if (!nodeId || !fieldName) return null;
          return {
            nodeId,
            fieldName,
            label: typeof row.label === "string" ? row.label : undefined,
            displayLabel: typeof row.displayLabel === "string" ? row.displayLabel : typeof row.title === "string" ? row.title : undefined,
            description: typeof row.description === "string" ? row.description : undefined,
            fieldType: typeof row.fieldType === "string" ? row.fieldType : inferFieldType(typeof row.valueType === "string" ? row.valueType : undefined),
            valueType: typeof row.valueType === "string" ? row.valueType : undefined,
            placeholder: typeof row.placeholder === "string" ? row.placeholder : undefined,
            required: typeof row.required === "boolean" ? row.required : undefined,
            fieldValue: typeof row.fieldValue === "string" || typeof row.fieldValue === "number" || typeof row.fieldValue === "boolean" ? row.fieldValue : undefined,
            defaultValue: typeof row.defaultValue === "string" || typeof row.defaultValue === "number" || typeof row.defaultValue === "boolean" ? row.defaultValue : undefined,
            options: Array.isArray(row.options) ? row.options.filter((item) => typeof item === "string" || typeof item === "number") : undefined,
          } satisfies RunningHubCatalogWorkflowField;
        })
        .filter(Boolean) as RunningHubCatalogWorkflowField[]
    : [];
}

function slotDataTypeToFieldType(slot: RhInputSlotDefinition) {
  if (slot.dataType === "image") return "IMAGE";
  if (slot.dataType === "video") return "VIDEO";
  if (slot.dataType === "audio") return "AUDIO";
  if (slot.dataType === "json") return "JSON";
  return "TEXT";
}

function slotDataTypeToValueType(slot: RhInputSlotDefinition) {
  if (slot.dataType === "image" || slot.dataType === "video" || slot.dataType === "audio" || slot.dataType === "json") {
    return slot.dataType;
  }
  return "string";
}

function buildFieldsFromInputSlots(inputSlots: RhInputSlotDefinition[] | undefined): RunningHubCatalogWorkflowField[] {
  const slots = Array.isArray(inputSlots) ? inputSlots : [];
  return slots
    .map((slot) => {
      const nodeId = String(slot.bindingTarget?.nodeId || "").trim();
      const fieldName = String(slot.bindingTarget?.fieldName || "").trim();
      if (!nodeId || !fieldName) return null;
      return {
        nodeId,
        fieldName,
        label: slot.title || fieldName,
        displayLabel: slot.title || fieldName,
        description: slot.description || "",
        fieldType: slotDataTypeToFieldType(slot),
        valueType: slotDataTypeToValueType(slot),
        placeholder: slot.placeholder,
        required: Boolean(slot.required),
        fieldValue: slot.manualValue,
        defaultValue: slot.defaultValue,
        options: Array.isArray(slot.options) ? slot.options : undefined,
      } satisfies RunningHubCatalogWorkflowField;
    })
    .filter(Boolean) as RunningHubCatalogWorkflowField[];
}

function normalizeCatalogItem(item: unknown): RunningHubCatalogItem | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const catalogId = String(row.catalogId || "").trim();
  const id = String(row.id || "").trim();
  if (!catalogId || !id) return null;
  const kind = row.kind === "app" ? "app" : "workflow";
  const pageId = typeof row.pageId === "string" ? row.pageId : "";
  const runTargetId = typeof row.runTargetId === "string" ? row.runTargetId : "";
  const rawAppId = typeof row.appId === "string" ? row.appId : "";
  const rawWorkflowId = typeof row.workflowId === "string" ? row.workflowId : "";
  return {
    catalogId,
    id,
    kind,
    title: typeof row.title === "string" ? row.title : id,
    note: typeof row.note === "string" ? row.note : "",
    thumbnail: typeof row.thumbnail === "string" ? row.thumbnail : "",
    enabled: row.enabled !== false,
    providerId: String(row.providerId || "").trim(),
    providerName: typeof row.providerName === "string" ? row.providerName : "",
    providerBaseUrl: typeof row.providerBaseUrl === "string" ? row.providerBaseUrl : "",
    inputSlots: Array.isArray(row.inputSlots) ? (row.inputSlots as RunningHubCatalogItem["inputSlots"]) : [],
    execution: (row.execution || {}) as RunningHubCatalogItem["execution"],
    pageId,
    appId: kind === "app" ? rawAppId || runTargetId || pageId || id : "",
    workflowId: kind === "workflow" ? rawWorkflowId || runTargetId || pageId || id : "",
    runTargetId: runTargetId || (kind === "app" ? rawAppId : rawWorkflowId) || pageId || id,
    taskCapability:
      row.taskCapability === "image" || row.taskCapability === "video" || row.taskCapability === "audio" || row.taskCapability === "chat"
        ? row.taskCapability
        : "video",
    workflowJson: typeof row.workflowJson === "string" ? row.workflowJson : "",
    parameterSchema: typeof row.parameterSchema === "string" ? row.parameterSchema : "{}",
    outputSchema: Array.isArray(row.outputSchema) ? row.outputSchema as RunningHubCatalogItem["outputSchema"] : [],
    fields: (() => {
      const normalizedFields = normalizeFields(row.fields);
      if (normalizedFields.length > 0) return normalizedFields;
      return buildFieldsFromInputSlots(Array.isArray(row.inputSlots) ? (row.inputSlots as RhInputSlotDefinition[]) : []);
    })(),
  };
}

function normalizeLegacyWorkflow(item: LegacyRunningHubCatalogWorkflow | null): RunningHubCatalogItem | null {
  if (!item) return null;
  return normalizeCatalogItem({
    ...item,
    inputSlots: [],
  });
}

function normalizeLegacyPayload(payload: Record<string, unknown>): RunningHubCatalogResponse {
  const workflows = Array.isArray(payload.workflows)
    ? (payload.workflows as LegacyRunningHubCatalogWorkflow[]).map((item) => normalizeLegacyWorkflow(item)).filter(Boolean) as RunningHubCatalogItem[]
    : [];
  const apps = Array.isArray(payload.apps)
    ? (payload.apps as LegacyRunningHubCatalogWorkflow[]).map((item) => normalizeLegacyWorkflow(item)).filter(Boolean) as RunningHubCatalogItem[]
    : [];
  const items = [...workflows, ...apps];
  const providers = Array.isArray(payload.providers)
    ? (payload.providers as Array<Record<string, unknown>>).map((provider) => {
        const providerItems = [
          ...(Array.isArray(provider.workflows) ? provider.workflows : []),
          ...(Array.isArray(provider.apps) ? provider.apps : []),
        ]
          .map((item) => normalizeLegacyWorkflow(item as LegacyRunningHubCatalogWorkflow))
          .filter(Boolean) as RunningHubCatalogItem[];
        return {
          id: String(provider.id || "").trim(),
          name: typeof provider.name === "string" ? provider.name : "",
          baseUrl: typeof provider.baseUrl === "string" ? provider.baseUrl : "",
          items: providerItems,
          workflows: providerItems.filter((item) => item.kind === "workflow"),
          apps: providerItems.filter((item) => item.kind === "app"),
        };
      })
    : [];
  return { items, providers, workflows, apps };
}

export async function fetchRunningHubCatalog(): Promise<RunningHubCatalogResponse> {
  const response = await fetch("/api/runninghub/catalog");
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  if (Array.isArray(data.items)) {
    const items = data.items.map((item) => normalizeCatalogItem(item)).filter(Boolean) as RunningHubCatalogItem[];
    const providers = Array.isArray(data.providers)
      ? (data.providers as Array<Record<string, unknown>>).map((provider) => {
          const providerItems = Array.isArray(provider.items)
            ? provider.items.map((item) => normalizeCatalogItem(item)).filter(Boolean) as RunningHubCatalogItem[]
            : items.filter((item) => item.providerId === String(provider.id || "").trim());
          return {
            id: String(provider.id || "").trim(),
            name: typeof provider.name === "string" ? provider.name : "",
            baseUrl: typeof provider.baseUrl === "string" ? provider.baseUrl : "",
            items: providerItems,
            workflows: providerItems.filter((item) => item.kind === "workflow"),
            apps: providerItems.filter((item) => item.kind === "app"),
          };
        })
      : [];
    return {
      items,
      providers,
      workflows: items.filter((item) => item.kind === "workflow"),
      apps: items.filter((item) => item.kind === "app"),
    };
  }
  return normalizeLegacyPayload(data);
}

export function buildRunningHubAppInfoFromCatalog(item: RunningHubCatalogItem) {
  const fields = Array.isArray(item.fields) && item.fields.length > 0
    ? item.fields
    : buildFieldsFromInputSlots(Array.isArray(item.inputSlots) ? item.inputSlots : []);
  const runTargetId = item.runTargetId || (item.kind === "app" ? item.appId : item.workflowId) || item.pageId || item.id;
  return {
    presetCatalogId: item.catalogId,
    appName: item.title,
    name: item.title,
    pageId: item.pageId || item.id,
    runTargetId,
    targetType: item.kind,
    webappId: item.kind === "app" ? (item.appId || runTargetId) : "",
    workflowId: item.kind === "workflow" ? (item.workflowId || runTargetId) : "",
    providerId: item.providerId,
    providerName: item.providerName,
    outputSchema: Array.isArray(item.outputSchema) ? item.outputSchema : [],
    workflowJson: parseWorkflowJson(item.workflowJson),
    nodeInfoList: fields.map((field) => ({
      nodeId: field.nodeId,
      fieldName: field.fieldName,
      label: field.label,
      displayLabel: field.displayLabel || field.label,
      description: field.description,
      fieldType: field.fieldType || inferFieldType(field.valueType),
      fieldValue: field.fieldValue ?? field.defaultValue ?? "",
      placeholder: field.placeholder,
      required: field.required,
      fieldData: Array.isArray(field.options) ? field.options : undefined,
      options: Array.isArray(field.options) ? field.options : undefined,
    })),
  };
}
