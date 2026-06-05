export type ModelCapability = "text" | "image" | "video" | "audio";

export interface ProviderModelDraft {
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
}

export const initialProviderModels: ProviderModelDraft[] = [
  {
    providerId: "grsai",
    modelId: "gpt-image-2",
    displayName: "GRSAI gpt-image-2",
    capability: "image",
    enabled: false,
  },
  {
    providerId: "toapis",
    modelId: "grok-video",
    displayName: "ToAPIs Grok Video",
    capability: "video",
    enabled: false,
  },
];
