export type RhCatalogItemKind = "app" | "workflow";

export type RhInputValueType = "string" | "number" | "boolean" | "select" | "json" | "unknown";

export interface RhInputSlotDefinition {
  key: string;
  nodeId: string;
  fieldName: string;
  label: string;
  description: string;
  fieldType: string;
  valueType: RhInputValueType;
  placeholder: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  fieldValue?: string | number | boolean;
  options?: Array<string | number>;
}

export interface RhExecutionDescriptor {
  kind: RhCatalogItemKind;
  targetType: RhCatalogItemKind;
  targetId: string;
  appId: string;
  workflowId: string;
  runTargetId: string;
  workflowJson: string;
  inputSlots: RhInputSlotDefinition[];
}

export interface RhCatalogItem {
  catalogId: string;
  id: string;
  kind: RhCatalogItemKind;
  title: string;
  note: string;
  thumbnail: string;
  enabled: boolean;
  providerId: string;
  providerName: string;
  providerBaseUrl: string;
  appId: string;
  workflowId: string;
  runTargetId: string;
  fields: RhInputSlotDefinition[];
  execution: RhExecutionDescriptor;
  workflowJson: string;
}
