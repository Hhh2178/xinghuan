export interface RunningHubCatalogField {
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

export interface RunningHubCatalogWorkflow {
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
  fields: RunningHubCatalogField[];
}

export interface RunningHubCatalogResponse {
  providers: Array<{
    id: string;
    name: string;
    baseUrl: string;
    workflows: RunningHubCatalogWorkflow[];
    apps: RunningHubCatalogWorkflow[];
  }>;
  workflows: RunningHubCatalogWorkflow[];
  apps: RunningHubCatalogWorkflow[];
}

export async function fetchRunningHubCatalog(): Promise<RunningHubCatalogResponse> {
  const response = await fetch("/api/runninghub/catalog");
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload.data || { providers: [], workflows: [], apps: [] };
}

export function buildRunningHubAppInfoFromCatalog(workflow: RunningHubCatalogWorkflow) {
  return {
    presetCatalogId: workflow.catalogId,
    appName: workflow.title,
    name: workflow.title,
    webappId: workflow.runTargetId,
    workflowId: workflow.workflowId || workflow.id,
    providerId: workflow.providerId,
    providerName: workflow.providerName,
    workflowJson: parseWorkflowJson(workflow.workflowJson),
    nodeInfoList: workflow.fields.map((field) => ({
      nodeId: field.nodeId,
      fieldName: field.fieldName,
      label: field.label,
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

function parseWorkflowJson(value: string | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function inferFieldType(valueType: string | undefined) {
  const value = String(valueType || "").trim().toLowerCase();
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  if (value === "audio") return "AUDIO";
  if (value === "number") return "NUMBER";
  if (value === "boolean") return "BOOLEAN";
  return "TEXT";
}
