import type { ProviderFileScope } from "./provider-file-access.js";

export interface ExternalProxyUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  groupId?: string;
}

export interface ExternalProxyProvider {
  id: string;
  name: string;
  baseUrl: string;
  protocol?: unknown;
  enabled: boolean;
  apiKey?: string;
}

export interface ExternalProxyModel {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: "chat" | "image" | "video" | "audio";
  capabilityTags?: string[];
  enabled: boolean;
  inputCapabilities?: Record<string, unknown>;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
}

export interface GenerateExternalProxyDependencies {
  dataDir: string;
  providerFileScope?: ProviderFileScope;
  normalizeProviderProtocol: (value: unknown) => string;
  normalizeCapability: (value: unknown) => string;
  providerModelHeaders: (apiKey: string, protocol: string) => Record<string, string>;
  providerPlainApiKey: (provider: { apiKey?: string; protocol?: unknown; baseUrl?: unknown }) => string;
  readAdminDb: () => Promise<{ providers: ExternalProxyProvider[]; models: ExternalProxyModel[] }>;
  authorizeModelExecution?: (user: ExternalProxyUser, model: ExternalProxyModel) => Promise<void>;
  saveRemoteImageToOutput: (sourceUrl: string, user: ExternalProxyUser) => Promise<{ url: string }>;
  saveRemoteVideoToOutput: (sourceUrl: string, user: ExternalProxyUser) => Promise<{ url: string }>;
  saveRemoteAudioToOutput: (sourceUrl: string, user: ExternalProxyUser) => Promise<{ url: string }>;
  saveBase64File: (body: { dataUrl?: string; prefix?: string }, user: ExternalProxyUser) => Promise<{ url: string }>;
  saveBase64AudioFile: (body: { dataUrl?: string; prefix?: string }, user: ExternalProxyUser) => Promise<{ url: string }>;
  secretKey: () => Buffer;
  safeSlug: (value: unknown, fallback?: string) => string;
  safeText: (value: unknown, fallback?: string) => string;
  safeLongText: (value: unknown, fallback?: string, maxLength?: number) => string;
  safePromptText: (value: unknown, fallback?: string, maxLength?: number) => string;
  plainObject: (value: unknown) => Record<string, unknown>;
  stringMap: (value: unknown) => Record<string, string>;
  looksLikeHtml: (value: string) => boolean;
  clampInteger: (value: unknown, min: number, max: number, fallback: number) => number;
  invalidRequest?: (message: string) => Error;
  resolveProviderMediaReference?: (input: {
    reference: string;
    kind: "image" | "video";
    actor: { id: string };
    publicOrigin: string;
  }) => Promise<string>;
}
