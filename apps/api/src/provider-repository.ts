import { readFile, writeFile } from "node:fs/promises";
import {
  MODEL_SELECT,
  PROVIDER_SELECT,
  type AdminModelPostgresRow,
  type AdminProviderPostgresRow,
  toAdminModelRecordFromRow,
  toAdminProviderRecordFromRow,
} from "./provider-repository-mappers.js";
import type {
  AdminDb,
  AdminModelRecord,
  AdminProviderRecord,
  ProviderModelImportResult,
  ProviderRepositoryDeps,
} from "./provider-repository-types.js";

export type {
  AdminDb,
  AdminModelRecord,
  AdminProviderRecord,
  ModelScopeLora,
  ProviderModelImportResult,
  ProviderRepositoryDeps,
  RunningHubKeyPoolItemRecord,
} from "./provider-repository-types.js";

export function createProviderRepository(deps: ProviderRepositoryDeps) {
  async function readAdminDb(): Promise<AdminDb> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const [providersResult, modelsResult] = await Promise.all([
        pool.query<AdminProviderPostgresRow>(`${PROVIDER_SELECT} order by updated_at desc`),
        pool.query<AdminModelPostgresRow>(`${MODEL_SELECT} order by updated_at desc`),
      ]);
      return {
        providers: providersResult.rows.map((row) => toAdminProviderRecordFromRow(row, deps)),
        models: modelsResult.rows.map((row) => toAdminModelRecordFromRow(row, deps)),
      };
    }
    await deps.ensureDataDirs();
    try {
      return JSON.parse(await readFile(deps.adminDbPath, "utf-8")) as AdminDb;
    } catch {
      return { providers: [], models: [] };
    }
  }

  async function writeAdminDb(db: AdminDb) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("delete from xh_models");
        await client.query("delete from xh_providers");
        for (const provider of db.providers.map(deps.normalizeProviderSecret)) {
          await client.query(
            `insert into xh_providers (id, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, rh_key_pool, ms_loras, note, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)`,
            [
              provider.id,
              provider.name,
              provider.baseUrl,
              deps.normalizeProviderProtocol(provider.protocol),
              provider.enabled,
              provider.apiKey || "",
              provider.apiKeyPreview || "",
              provider.lastProbeStatus || "",
              provider.lastProbeMessage || "",
              provider.lastFetchedAt ? deps.millisToDate(provider.lastFetchedAt) : null,
              JSON.stringify(deps.normalizeRunningHubEntries(provider.rhApps, "app")),
              JSON.stringify(deps.normalizeRunningHubEntries(provider.rhWorkflows, "workflow")),
              JSON.stringify(deps.normalizeRunningHubKeyPool(provider.rhKeyPool)),
              JSON.stringify(deps.normalizeModelScopeLoras(provider.msLoras)),
              provider.note || "",
              deps.millisToDate(provider.createdAt),
              deps.millisToDate(provider.updatedAt),
            ],
          );
        }
        for (const model of db.models.map(deps.normalizeAdminModelRecord)) {
          await client.query(
            `insert into xh_models (id, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15)`,
            [
              model.id,
              model.providerId,
              model.modelId,
              model.displayName,
              deps.normalizeCapability(model.capability),
              model.enabled,
              model.inputProfile,
              JSON.stringify(deps.plainObject(model.inputCapabilities)),
              JSON.stringify(model.capabilityTags || []),
              JSON.stringify(model.testState || {}),
              model.parameterSchema || "{}",
              JSON.stringify(deps.plainObject(model.advancedConfig)),
              model.protocolOverride || "",
              deps.millisToDate(model.createdAt),
              deps.millisToDate(model.updatedAt),
            ],
          );
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
      return;
    }
    await deps.ensureDataDirs();
    await writeFile(deps.adminDbPath, JSON.stringify(db, null, 2), "utf-8");
  }

  async function readProviderRecords(): Promise<AdminProviderRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminProviderPostgresRow>(`${PROVIDER_SELECT} order by updated_at desc`);
      return result.rows.map((row) => toAdminProviderRecordFromRow(row, deps));
    }
    return (await readAdminDb()).providers;
  }

  async function readProviderRecordsByProtocol(protocol: string): Promise<AdminProviderRecord[]> {
    const normalizedProtocol = deps.normalizeProviderProtocol(protocol);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminProviderPostgresRow>(
        `${PROVIDER_SELECT} where lower(protocol) = lower($1) order by updated_at desc`,
        [normalizedProtocol],
      );
      return result.rows.map((row) => toAdminProviderRecordFromRow(row, deps));
    }
    return (await readAdminDb()).providers.filter((provider) => deps.normalizeProviderProtocol(provider.protocol) === normalizedProtocol);
  }

  async function findProviderRecordById(providerId: string): Promise<AdminProviderRecord | null> {
    const normalizedProviderId = deps.safeText(providerId);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminProviderPostgresRow>(`${PROVIDER_SELECT} where id = $1 limit 1`, [normalizedProviderId]);
      return result.rows[0] ? toAdminProviderRecordFromRow(result.rows[0], deps) : null;
    }
    return (await readAdminDb()).providers.find((provider) => provider.id === normalizedProviderId) || null;
  }

  async function findProviderRecordByNaturalKey(name: string): Promise<AdminProviderRecord | null> {
    const normalizedName = deps.safeText(name).toLowerCase();
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminProviderPostgresRow>(`${PROVIDER_SELECT} where lower(name) = lower($1) limit 1`, [name]);
      return result.rows[0] ? toAdminProviderRecordFromRow(result.rows[0], deps) : null;
    }
    return (await readAdminDb()).providers.find((provider) => provider.name.trim().toLowerCase() === normalizedName) || null;
  }

  async function readModelRecords(): Promise<AdminModelRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminModelPostgresRow>(`${MODEL_SELECT} order by updated_at desc`);
      return result.rows.map((row) => toAdminModelRecordFromRow(row, deps));
    }
    return (await readAdminDb()).models.map(deps.normalizeAdminModelRecord);
  }

  async function readEnabledModelRecords(): Promise<AdminModelRecord[]> {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminModelPostgresRow>(`${MODEL_SELECT} where enabled = true order by updated_at desc`);
      return result.rows.map((row) => toAdminModelRecordFromRow(row, deps));
    }
    return (await readModelRecords()).filter((model) => model.enabled);
  }

  async function readModelRecordsByProviderId(providerId: string): Promise<AdminModelRecord[]> {
    const normalizedProviderId = deps.safeText(providerId);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminModelPostgresRow>(`${MODEL_SELECT} where provider_id = $1 order by updated_at desc`, [normalizedProviderId]);
      return result.rows.map((row) => toAdminModelRecordFromRow(row, deps));
    }
    return (await readModelRecords()).filter((model) => model.providerId === normalizedProviderId);
  }

  async function findModelRecordById(modelId: string): Promise<AdminModelRecord | null> {
    const normalizedModelRecordId = deps.safeText(modelId);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminModelPostgresRow>(`${MODEL_SELECT} where id = $1 limit 1`, [normalizedModelRecordId]);
      return result.rows[0] ? toAdminModelRecordFromRow(result.rows[0], deps) : null;
    }
    return (await readModelRecords()).find((model) => model.id === normalizedModelRecordId) || null;
  }

  async function findModelRecordByNaturalKey(providerId: string, capability: unknown, modelId: string): Promise<AdminModelRecord | null> {
    const normalizedProviderId = deps.safeText(providerId);
    const normalizedCapability = deps.normalizeCapability(capability);
    const normalizedModelId = deps.safeText(modelId).toLowerCase();
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query<AdminModelPostgresRow>(
        `${MODEL_SELECT} where provider_id = $1 and capability = $2 and lower(model_id) = lower($3) limit 1`,
        [normalizedProviderId, normalizedCapability, normalizedModelId],
      );
      return result.rows[0] ? toAdminModelRecordFromRow(result.rows[0], deps) : null;
    }
    return (
      (await readModelRecords()).find(
        (model) =>
          model.providerId === normalizedProviderId &&
          deps.normalizeCapability(model.capability) === normalizedCapability &&
          deps.safeText(model.modelId).trim().toLowerCase() === normalizedModelId,
      ) || null
    );
  }

  async function findModelWithProviderById(modelId: string): Promise<{ model: AdminModelRecord; provider: AdminProviderRecord } | null> {
    const model = await findModelRecordById(modelId);
    if (!model) return null;
    const provider = await findProviderRecordById(model.providerId);
    return provider ? { model, provider } : null;
  }

  async function insertProviderRecord(provider: AdminProviderRecord): Promise<AdminProviderRecord> {
    const normalized = deps.normalizeProviderSecret(provider);
    if (deps.usePostgresRepository()) {
      await upsertProviderRecordPostgres(normalized);
      return normalized;
    }
    const db = await readAdminDb();
    if (db.providers.some((item) => item.id === normalized.id)) throw new Error("Provider ID 已存在");
    await writeAdminDb({ ...db, providers: [normalized, ...db.providers] });
    return normalized;
  }

  async function upsertProviderRecord(provider: AdminProviderRecord): Promise<AdminProviderRecord> {
    const normalized = deps.normalizeProviderSecret(provider);
    if (deps.usePostgresRepository()) {
      await upsertProviderRecordPostgres(normalized);
      return normalized;
    }
    const existing = await findProviderRecordByNaturalKey(normalized.name);
    const db = await readAdminDb();
    const providers = existing ? db.providers.map((item) => (item.id === existing.id ? normalized : item)) : [normalized, ...db.providers];
    await writeAdminDb({ ...db, providers });
    return normalized;
  }

  async function updateProviderRecord(providerId: string, transform: (provider: AdminProviderRecord) => AdminProviderRecord): Promise<AdminProviderRecord> {
    const current = await findProviderRecordById(providerId);
    if (!current) throw new Error("Provider 不存在");
    const updated = deps.normalizeProviderSecret(transform(current));
    if (deps.usePostgresRepository()) {
      await upsertProviderRecordPostgres(updated);
      return updated;
    }
    const db = await readAdminDb();
    await writeAdminDb({ ...db, providers: db.providers.map((provider) => (provider.id === providerId ? updated : provider)) });
    return updated;
  }

  async function upsertProviderRecordPostgres(provider: AdminProviderRecord) {
    const pool = await deps.getPostgresPool();
    const normalized = deps.normalizeProviderSecret(provider);
    await pool.query(
      `insert into xh_providers (id, name, base_url, protocol, enabled, api_key_cipher, api_key_preview, last_probe_status, last_probe_message, last_fetched_at, rh_apps, rh_workflows, rh_key_pool, ms_loras, note, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)
       on conflict (id) do update set name = excluded.name, base_url = excluded.base_url, protocol = excluded.protocol, enabled = excluded.enabled, api_key_cipher = excluded.api_key_cipher, api_key_preview = excluded.api_key_preview, last_probe_status = excluded.last_probe_status, last_probe_message = excluded.last_probe_message, last_fetched_at = excluded.last_fetched_at, rh_apps = excluded.rh_apps, rh_workflows = excluded.rh_workflows, rh_key_pool = excluded.rh_key_pool, ms_loras = excluded.ms_loras, note = excluded.note, updated_at = excluded.updated_at`,
      [
        normalized.id,
        normalized.name,
        normalized.baseUrl,
        deps.normalizeProviderProtocol(normalized.protocol),
        normalized.enabled,
        normalized.apiKey || "",
        normalized.apiKeyPreview || "",
        normalized.lastProbeStatus || "",
        normalized.lastProbeMessage || "",
        normalized.lastFetchedAt ? deps.millisToDate(normalized.lastFetchedAt) : null,
        JSON.stringify(deps.normalizeRunningHubEntries(normalized.rhApps, "app")),
        JSON.stringify(deps.normalizeRunningHubEntries(normalized.rhWorkflows, "workflow")),
        JSON.stringify(deps.normalizeRunningHubKeyPool(normalized.rhKeyPool)),
        JSON.stringify(deps.normalizeModelScopeLoras(normalized.msLoras)),
        normalized.note || "",
        deps.millisToDate(normalized.createdAt),
        deps.millisToDate(normalized.updatedAt),
      ],
    );
  }

  async function updateProviderProbeResult(providerId: string, result: { ok?: boolean; message?: string }, now: number) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query("update xh_providers set last_probe_status = $2, last_probe_message = $3, updated_at = $4 where id = $1", [
        providerId,
        result.ok ? "ok" : "error",
        deps.safeText(result.message),
        deps.millisToDate(now),
      ]);
      return;
    }
    await updateProviderRecord(providerId, (provider) => ({
      ...provider,
      lastProbeStatus: result.ok ? "ok" : "error",
      lastProbeMessage: deps.safeText(result.message),
      updatedAt: now,
    }));
  }

  async function updateProviderLastFetchedAt(providerId: string, now: number) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query("update xh_providers set last_fetched_at = $2, updated_at = $2 where id = $1", [providerId, deps.millisToDate(now)]);
      return;
    }
    await updateProviderRecord(providerId, (provider) => ({ ...provider, lastFetchedAt: now, updatedAt: now }));
  }

  async function updateProviderRhCatalog(
    providerId: string,
    transform: (provider: AdminProviderRecord) => AdminProviderRecord,
  ): Promise<AdminProviderRecord> {
    const current = await findProviderRecordById(providerId);
    if (!current) throw new Error("Provider 不存在");
    const updated = deps.normalizeProviderSecret(transform(current));
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      await pool.query(
        "update xh_providers set rh_apps = $2::jsonb, rh_workflows = $3::jsonb, rh_key_pool = $4::jsonb, ms_loras = $5::jsonb, updated_at = $6 where id = $1",
        [
          providerId,
          JSON.stringify(deps.normalizeRunningHubEntries(updated.rhApps, "app")),
          JSON.stringify(deps.normalizeRunningHubEntries(updated.rhWorkflows, "workflow")),
          JSON.stringify(deps.normalizeRunningHubKeyPool(updated.rhKeyPool)),
          JSON.stringify(deps.normalizeModelScopeLoras(updated.msLoras)),
          deps.millisToDate(updated.updatedAt),
        ],
      );
      return updated;
    }
    const db = await readAdminDb();
    await writeAdminDb({ ...db, providers: db.providers.map((provider) => (provider.id === providerId ? updated : provider)) });
    return updated;
  }

  async function importProviderModels(providerId: string, importResult: ProviderModelImportResult): Promise<ProviderModelImportResult> {
    if (deps.usePostgresRepository()) {
      for (const model of importResult.touchedModels) await upsertModelRecordPostgres(model);
      return importResult;
    }
    const db = await readAdminDb();
    await writeAdminDb({
      ...db,
      models: [...importResult.nextModels, ...db.models.filter((model) => model.providerId !== providerId)],
    });
    return importResult;
  }

  async function upsertModelRecordPostgres(model: AdminModelRecord) {
    const pool = await deps.getPostgresPool();
    const normalized = deps.normalizeAdminModelRecord(model);
    await pool.query(
      `insert into xh_models (id, provider_id, model_id, display_name, capability, enabled, input_profile, input_capabilities, capability_tags, test_state, parameter_schema, advanced_config, protocol_override, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15)
       on conflict (id) do update set provider_id = excluded.provider_id, model_id = excluded.model_id, display_name = excluded.display_name, capability = excluded.capability, enabled = excluded.enabled, input_profile = excluded.input_profile, input_capabilities = excluded.input_capabilities, capability_tags = excluded.capability_tags, test_state = excluded.test_state, parameter_schema = excluded.parameter_schema, advanced_config = excluded.advanced_config, protocol_override = excluded.protocol_override, updated_at = excluded.updated_at`,
      [
        normalized.id,
        normalized.providerId,
        normalized.modelId,
        normalized.displayName,
        deps.normalizeCapability(normalized.capability),
        normalized.enabled,
        normalized.inputProfile,
        JSON.stringify(deps.plainObject(normalized.inputCapabilities)),
        JSON.stringify(normalized.capabilityTags || []),
        JSON.stringify(normalized.testState || {}),
        normalized.parameterSchema || "{}",
        JSON.stringify(deps.plainObject(normalized.advancedConfig)),
        normalized.protocolOverride || "",
        deps.millisToDate(normalized.createdAt),
        deps.millisToDate(normalized.updatedAt),
      ],
    );
  }

  return {
    readAdminDb,
    writeAdminDb,
    readProviderRecords,
    readProviderRecordsByProtocol,
    findProviderRecordById,
    findProviderRecordByNaturalKey,
    readModelRecords,
    readEnabledModelRecords,
    readModelRecordsByProviderId,
    findModelRecordById,
    findModelRecordByNaturalKey,
    findModelWithProviderById,
    insertProviderRecord,
    upsertProviderRecord,
    updateProviderRecord,
    updateProviderProbeResult,
    updateProviderLastFetchedAt,
    updateProviderRhCatalog,
    importProviderModels,
    upsertProviderRecordPostgres,
    upsertModelRecordPostgres,
  };
}
