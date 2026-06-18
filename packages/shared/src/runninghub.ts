export type RhCatalogItemKind = "app" | "workflow";

export type RhSlotDataType = "text" | "image" | "video" | "audio" | "json";

export type RhSlotCardinality = "single" | "multiple";

export interface RhSlotBindingTarget {
  nodeId: string;
  fieldName: string;
  path: string;
}

export interface RhInputSlotDefinition {
  key: string;
  name: string;
  title: string;
  description: string;
  dataType: RhSlotDataType;
  cardinality: "single" | "multiple";
  required: boolean;
  supportsConnection: boolean;
  supportsManualInput: boolean;
  supportsUpload: boolean;
  bindingTarget: RhSlotBindingTarget;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  manualValue?: string | number | boolean;
  options?: Array<string | number>;
}

export interface RhExecutionSubmitDescriptor {
  mode: "direct";
  targetType: RhCatalogItemKind;
  targetId: string;
  endpoint: string;
  method: "POST";
}

export interface RhExecutionAssetHandlingDescriptor {
  input: {
    acceptsUploads: boolean;
    acceptsRemoteUrls: boolean;
    requiresPreSignedUrls: boolean;
  };
  output: {
    resultKind: "remote-url";
    supportsMultiple: boolean;
  };
}

export interface RhExecutionPollingDescriptor {
  strategy: "none" | "fixed-interval";
  intervalMs: number;
  timeoutMs: number;
}

export interface RhExecutionResultDescriptor {
  mode: "inline";
  payloadPath: string;
  errorPath: string;
}

export interface RhExecutionErrorHandlingDescriptor {
  surface: "provider-message";
  retryable: boolean;
  messagePath: string;
}

export interface RhExecutionDescriptor {
  submit: RhExecutionSubmitDescriptor;
  assetHandling: RhExecutionAssetHandlingDescriptor;
  polling: RhExecutionPollingDescriptor;
  result: RhExecutionResultDescriptor;
  errorHandling: RhExecutionErrorHandlingDescriptor;
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
  inputSlots: RhInputSlotDefinition[];
  execution: RhExecutionDescriptor;
  appId: string;
  workflowId: string;
  runTargetId: string;
  workflowJson: string;
  parameterSchema?: string;
  outputSchema?: Array<{
    key: string;
    label: string;
    kind: "image" | "video" | "audio" | "text" | "json";
    path?: string;
    multiple?: boolean;
  }>;
  executionRules?: {
    submitMode: "direct";
    targetType: RhCatalogItemKind;
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
  };
  testPayload?: string;
  fields: Array<{
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
  }>;
}
