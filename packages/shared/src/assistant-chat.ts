import type { AssistantMessageBlock } from "./assistant-message-blocks.js";
import type { AssistantContent } from "./assistant-content.js";

export interface AssistantChatResult {
  mode: "agent" | "fallback";
  message: string;
  rawAssistant: string;
  content: AssistantContent;
  blocks?: AssistantMessageBlock[];
  runtime?: AssistantRuntimeStatus;
}

export type AssistantRuntimeRouteStatus = "ready" | "degraded" | "unavailable" | "not_configured";

export interface AssistantRuntimeModel {
  entryId?: string;
  providerId?: string;
  providerName?: string;
  modelRecordId?: string;
  modelId?: string;
  modelDisplayName?: string;
  state?: string;
  supportsImage?: boolean;
}

export interface AssistantRuntimeStatus {
  environment: "gray" | "production" | "local";
  scope: "canvas" | "admin";
  enabled: boolean;
  agentKey: string;
  agentVersion?: number;
  configurationVersionId?: string;
  poolKey?: string;
  poolVersionId?: string;
  routeStatus: AssistantRuntimeRouteStatus;
  model?: AssistantRuntimeModel;
  candidates: AssistantRuntimeModel[];
  updatedAt: number;
}
