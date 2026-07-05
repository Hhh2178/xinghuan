import type { Pool } from "pg";
import type { ModelCapability, ModelCapabilityTag, ModelInputCapabilities, ProviderProtocol } from "@xinghuan/model-core";
import type { ProviderGenerationExecutionMode } from "@xinghuan/shared";
import type { normalizeCapability, normalizeOptionalProtocol, normalizeProviderProtocol } from "./provider-model-catalog.js";
import type { RunningHubCatalogEntry } from "./runninghub-catalog.js";

export interface RunningHubKeyPoolItemRecord {
  id: string;
  note: string;
  apiKey?: string;
  apiKeyPreview?: string;
  maxConcurrency: number;
  enabled: boolean;
  isDefault: boolean;
  currentInFlight?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ModelScopeLora {
  id: string;
  name?: string;
  targetModel: string;
  strength: number;
  enabled: boolean;
  note?: string;
}

export interface AdminProviderRecord {
  id: string;
  name: string;
  baseUrl: string;
  protocol?: ProviderProtocol;
  enabled: boolean;
  apiKey?: string;
  apiKeyPreview?: string;
  lastProbeStatus?: string;
  lastProbeMessage?: string;
  lastFetchedAt?: number;
  rhApps?: RunningHubCatalogEntry[];
  rhWorkflows?: RunningHubCatalogEntry[];
  rhKeyPool?: RunningHubKeyPoolItemRecord[];
  msLoras?: ModelScopeLora[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  enabled: boolean;
  executionMode?: ProviderGenerationExecutionMode;
  inputProfile: string;
  inputCapabilities?: ModelInputCapabilities | Record<string, unknown>;
  capabilityTags?: ModelCapabilityTag[];
  testState?: unknown;
  parameterSchema: string;
  advancedConfig?: Record<string, unknown>;
  protocolOverride?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminTaskReferenceRecord {
  modelId?: string;
  [key: string]: unknown;
}

export interface AdminDb {
  providers: AdminProviderRecord[];
  models: AdminModelRecord[];
  tasks?: AdminTaskReferenceRecord[];
}

export interface ProviderModelImportResult {
  imported: number;
  nextModels: AdminModelRecord[];
  touchedModels: AdminModelRecord[];
}

export interface ProviderRepositoryDeps {
  usePostgresRepository: () => boolean;
  ensureDataDirs: () => Promise<void>;
  adminDbPath: string;
  getPostgresPool: () => Promise<Pool>;
  dateToMillis: (value: unknown) => number;
  millisToDate: (value: number) => Date;
  normalizeAdminModelRecord: (model: AdminModelRecord) => AdminModelRecord;
  normalizeProviderSecret: (provider: AdminProviderRecord) => AdminProviderRecord;
  normalizeProviderProtocol: typeof normalizeProviderProtocol;
  normalizeCapability: typeof normalizeCapability;
  normalizeOptionalProtocol: typeof normalizeOptionalProtocol;
  normalizeRunningHubEntries: (value: unknown, kind: "app" | "workflow") => RunningHubCatalogEntry[];
  normalizeRunningHubKeyPool: (value: unknown) => RunningHubKeyPoolItemRecord[];
  normalizeModelScopeLoras: (value: unknown) => ModelScopeLora[];
  plainObject: (value: unknown) => Record<string, unknown>;
  safeJsonText: (value: unknown, fallback?: string) => string;
  safeText: (value: unknown, fallback?: string) => string;
}
