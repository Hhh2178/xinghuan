import type { QueryResultRow } from "pg";
import type {
  AdminModelRecord,
  AdminProviderRecord,
  ProviderRepositoryDeps,
} from "./provider-repository-types.js";
import { normalizeCatalogSortOrder } from "./catalog-display-order.js";

export interface AdminProviderPostgresRow extends QueryResultRow {
  id: unknown;
  sort_order: unknown;
  name: unknown;
  base_url: unknown;
  protocol: unknown;
  enabled: unknown;
  api_key_cipher: unknown;
  api_key_preview: unknown;
  last_probe_status: unknown;
  last_probe_message: unknown;
  last_fetched_at: unknown;
  rh_apps: unknown;
  rh_workflows: unknown;
  rh_groups: unknown;
  rh_key_pool: unknown;
  ms_loras: unknown;
  note: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export interface AdminModelPostgresRow extends QueryResultRow {
  id: unknown;
  sort_order: unknown;
  provider_id: unknown;
  model_id: unknown;
  display_name: unknown;
  capability: unknown;
  enabled: unknown;
  input_profile: unknown;
  input_capabilities: unknown;
  capability_tags: unknown;
  test_state: unknown;
  parameter_schema: unknown;
  advanced_config: unknown;
  protocol_override: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export function toAdminProviderRecordFromRow(row: AdminProviderPostgresRow, deps: ProviderRepositoryDeps): AdminProviderRecord {
  const rhGroups = deps.normalizeRunningHubGroups ? deps.normalizeRunningHubGroups(row.rh_groups, deps.safeText(row.id)) : [];
  const validGroupIds = new Set(rhGroups.map((group) => group.id));
  return {
    id: deps.safeText(row.id),
    sortOrder: normalizeCatalogSortOrder(row.sort_order),
    name: deps.safeText(row.name),
    baseUrl: deps.safeText(row.base_url),
    protocol: deps.normalizeProviderProtocol(row.protocol),
    enabled: Boolean(row.enabled),
    apiKey: deps.safeText(row.api_key_cipher),
    apiKeyPreview: deps.safeText(row.api_key_preview),
    lastProbeStatus: deps.safeText(row.last_probe_status),
    lastProbeMessage: deps.safeText(row.last_probe_message),
    lastFetchedAt: deps.dateToMillis(row.last_fetched_at),
    rhApps: deps.normalizeRunningHubEntries(row.rh_apps, "app", validGroupIds),
    rhWorkflows: deps.normalizeRunningHubEntries(row.rh_workflows, "workflow", validGroupIds),
    rhGroups,
    rhKeyPool: deps.normalizeRunningHubKeyPool(row.rh_key_pool),
    msLoras: deps.normalizeModelScopeLoras(row.ms_loras),
    note: deps.safeText(row.note),
    createdAt: deps.dateToMillis(row.created_at),
    updatedAt: deps.dateToMillis(row.updated_at),
  };
}

export function toAdminModelRecordFromRow(row: AdminModelPostgresRow, deps: ProviderRepositoryDeps): AdminModelRecord {
  return deps.normalizeAdminModelRecord({
    id: deps.safeText(row.id),
    sortOrder: normalizeCatalogSortOrder(row.sort_order),
    providerId: deps.safeText(row.provider_id),
    modelId: deps.safeText(row.model_id),
    displayName: deps.safeText(row.display_name),
    capability: deps.normalizeCapability(row.capability),
    enabled: Boolean(row.enabled),
    inputProfile: deps.safeText(row.input_profile, "prompt"),
    inputCapabilities: deps.plainObject(row.input_capabilities),
    capabilityTags: Array.isArray(row.capability_tags) ? row.capability_tags : [],
    testState: row.test_state,
    parameterSchema: deps.safeJsonText(JSON.stringify(row.parameter_schema || {}), "{}"),
    advancedConfig: deps.plainObject(row.advanced_config),
    protocolOverride: deps.normalizeOptionalProtocol(row.protocol_override),
    createdAt: deps.dateToMillis(row.created_at),
    updatedAt: deps.dateToMillis(row.updated_at),
  });
}

export const PROVIDER_SELECT =
  "select id, sort_order, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, rh_groups, rh_key_pool, ms_loras, note, created_at, updated_at from xh_providers";

export const MODEL_SELECT =
  "select id, sort_order, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at from xh_models";
