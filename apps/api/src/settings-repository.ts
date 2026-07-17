import { readFile, writeFile } from "node:fs/promises";
import type { Pool } from "pg";
import type { TaskQueueSettings } from "@xinghuan/shared";
import { defaultTaskQueueSettings, normalizeTaskQueueSettings } from "@xinghuan/shared";

export interface AssistantFrontendSettingsRecord {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  allowWorkflowAttachment: boolean;
  allowNodeAttachment: boolean;
  allowMediaAttachment: boolean;
  persistMemory: false;
}

export interface AssistantBackendSettingsRecord {
  enabled: boolean;
  title: string;
  hint: string;
  placeholder: string;
  defaultOpen: boolean;
  allowProviderContext: boolean;
  allowModelContext: boolean;
  allowTaskContext: boolean;
  allowUserContext: boolean;
  allowAuditContext: boolean;
}

export interface AssistantIntegrationSettingsRecord {
  kernel: "hermes" | "fallback";
  endpoint: string;
  endpointConfigured?: boolean;
  workspace: string;
  model: string;
  profile: string;
  persistMemory: boolean;
  strictMode: boolean;
}

export interface AssistantSettingsRecord {
  frontend: AssistantFrontendSettingsRecord;
  backend: AssistantBackendSettingsRecord;
  integration: AssistantIntegrationSettingsRecord;
  updatedAt: number;
  revision: number;
}

export interface SystemSettingsRecord {
  taskQueueSettings: TaskQueueSettings;
  updatedAt: number;
  revision: number;
}

export interface SettingsDb {
  assistantSettings?: AssistantSettingsRecord;
  taskQueueSettings?: TaskQueueSettings;
  taskQueueSettingsRevision?: number;
  taskQueueSettingsUpdatedAt?: number;
}

export interface SettingsRepositoryDeps {
  usePostgresRepository: () => boolean;
  ensureDataDirs: () => Promise<void>;
  adminDbPath: string;
  getPostgresPool: () => Promise<Pool>;
  dateToMillis: (value: unknown) => number;
  millisToDate: (value: number | undefined) => Date;
  plainObject: (value: unknown) => Record<string, unknown>;
  defaultAssistantSettings: () => AssistantSettingsRecord;
  normalizeAssistantSettings: (
    value: unknown,
    base?: AssistantSettingsRecord,
  ) => AssistantSettingsRecord;
  normalizeTaskQueueSettings: typeof normalizeTaskQueueSettings;
  defaultTaskQueueSettings: typeof defaultTaskQueueSettings;
  createRevisionConflictError: (settingsKey: "assistant" | "task-queue", currentRevision: number) => Error;
}

export function createSettingsRepository(deps: SettingsRepositoryDeps) {
  return {
    readSettingsDb,
    writeSettingsDb,
    readAssistantSettingsRecord,
    writeAssistantSettingsRecord,
    readTaskQueueSettingsRecord,
    writeTaskQueueSettingsRecord,
  };

  async function readSettingsDb(): Promise<SettingsDb> {
    if (deps.usePostgresRepository()) return readSettingsDbPostgres();
    await deps.ensureDataDirs();
    try {
      return JSON.parse(await readFile(deps.adminDbPath, "utf-8")) as SettingsDb;
    } catch {
      return {};
    }
  }

  async function writeSettingsDb(db: SettingsDb) {
    if (deps.usePostgresRepository()) {
      throw new Error("writeSettingsDb is unavailable in postgres mode; use targeted repository writes");
    }
    await deps.ensureDataDirs();
    await writeFile(deps.adminDbPath, JSON.stringify(db, null, 2), "utf-8");
  }

  async function readSettingsDbPostgres(): Promise<SettingsDb> {
    const pool = await deps.getPostgresPool();
    const [assistantResult, systemResult] = await Promise.all([
      pool.query("select frontend, backend, integration, revision, updated_at from xh_assistant_settings where id = 'default' limit 1"),
      pool.query("select task_queue_settings, revision, updated_at from xh_system_settings where id = 'default' limit 1"),
    ]);
    const assistantRow = assistantResult.rows[0];
    const systemRow = systemResult.rows[0];
    return {
      assistantSettings: assistantRow
        ? deps.normalizeAssistantSettings(
            {
              frontend: deps.plainObject(assistantRow.frontend),
              backend: deps.plainObject(assistantRow.backend),
              integration: deps.plainObject(assistantRow.integration),
              revision: Number(assistantRow.revision) || 1,
              updatedAt: assistantRow.updated_at ? deps.dateToMillis(assistantRow.updated_at) : Date.now(),
            },
            deps.defaultAssistantSettings(),
          )
        : undefined,
      taskQueueSettings: systemRow ? deps.normalizeTaskQueueSettings(deps.plainObject(systemRow.task_queue_settings)) : undefined,
      taskQueueSettingsRevision: Number(systemRow?.revision) || 1,
      taskQueueSettingsUpdatedAt: systemRow?.updated_at ? deps.dateToMillis(systemRow.updated_at) : Date.now(),
    };
  }

  async function readAssistantSettingsRecord(): Promise<AssistantSettingsRecord> {
    if (deps.usePostgresRepository()) return readAssistantSettingsRecordPostgres();
    const db = await readSettingsDb();
    return deps.normalizeAssistantSettings(db.assistantSettings, deps.defaultAssistantSettings());
  }

  async function readAssistantSettingsRecordPostgres(): Promise<AssistantSettingsRecord> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query(
      "select frontend, backend, integration, revision, updated_at from xh_assistant_settings where id = 'default' limit 1",
    );
    const row = result.rows[0];
    if (!row) return deps.defaultAssistantSettings();
    return deps.normalizeAssistantSettings(
      {
        frontend: deps.plainObject(row.frontend),
        backend: deps.plainObject(row.backend),
        integration: deps.plainObject(row.integration),
        revision: Number(row.revision) || 1,
        updatedAt: row.updated_at ? deps.dateToMillis(row.updated_at) : Date.now(),
      },
      deps.defaultAssistantSettings(),
    );
  }

  async function writeAssistantSettingsRecord(settings: AssistantSettingsRecord, expectedRevision?: number) {
    const normalized = deps.normalizeAssistantSettings(settings);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const currentResult = await pool.query("select revision from xh_assistant_settings where id = 'default' limit 1");
      const currentRevision = Number(currentResult.rows[0]?.revision) || 1;
      if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
        throw deps.createRevisionConflictError("assistant", currentRevision);
      }
      const nextRevision = currentResult.rows[0] ? currentRevision + 1 : currentRevision;
      const updatedAt = Date.now();
      await pool.query(
        `insert into xh_assistant_settings (id, frontend, backend, integration, revision, updated_at)
         values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6)
         on conflict (id) do update set
           frontend = excluded.frontend,
           backend = excluded.backend,
           integration = excluded.integration,
           revision = excluded.revision,
           updated_at = excluded.updated_at`,
        [
          "default",
          JSON.stringify(normalized.frontend),
          JSON.stringify(normalized.backend),
          JSON.stringify(normalized.integration),
          nextRevision,
          deps.millisToDate(updatedAt),
        ],
      );
      return { ...normalized, revision: nextRevision, updatedAt };
    }
    const db = await readSettingsDb();
    const current = deps.normalizeAssistantSettings(db.assistantSettings, deps.defaultAssistantSettings());
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw deps.createRevisionConflictError("assistant", current.revision);
    }
    const nextRevision = current.revision + 1;
    const updatedAt = Date.now();
    await writeSettingsDb({
      ...db,
      assistantSettings: {
        ...normalized,
        revision: nextRevision,
        updatedAt,
      },
    });
    return { ...normalized, revision: nextRevision, updatedAt };
  }

  async function readTaskQueueSettingsRecord(): Promise<SystemSettingsRecord> {
    if (deps.usePostgresRepository()) return readTaskQueueSettingsRecordPostgres();
    const db = await readSettingsDb();
    return {
      taskQueueSettings: deps.normalizeTaskQueueSettings(db.taskQueueSettings, deps.defaultTaskQueueSettings()),
      updatedAt: positiveNumberOrDefault(db.taskQueueSettingsUpdatedAt, Date.now()),
      revision: positiveIntegerOrDefault(db.taskQueueSettingsRevision, 1),
    };
  }

  async function readTaskQueueSettingsRecordPostgres(): Promise<SystemSettingsRecord> {
    const pool = await deps.getPostgresPool();
    const result = await pool.query("select task_queue_settings, revision, updated_at from xh_system_settings where id = 'default' limit 1");
    const row = result.rows[0];
    if (!row) {
      return {
        taskQueueSettings: deps.defaultTaskQueueSettings(),
        updatedAt: Date.now(),
        revision: 1,
      };
    }
    return {
      taskQueueSettings: deps.normalizeTaskQueueSettings(deps.plainObject(row.task_queue_settings)),
      updatedAt: row.updated_at ? deps.dateToMillis(row.updated_at) : Date.now(),
      revision: Number(row.revision) || 1,
    };
  }

  async function writeTaskQueueSettingsRecord(taskQueueSettings: TaskQueueSettings, expectedRevision?: number): Promise<SystemSettingsRecord> {
    const normalized = deps.normalizeTaskQueueSettings(taskQueueSettings);
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const currentResult = await pool.query("select revision from xh_system_settings where id = 'default' limit 1");
      const currentRevision = Number(currentResult.rows[0]?.revision) || 1;
      if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
        throw deps.createRevisionConflictError("task-queue", currentRevision);
      }
      const nextRevision = currentResult.rows[0] ? currentRevision + 1 : currentRevision;
      const updatedAt = Date.now();
      await pool.query(
        `insert into xh_system_settings (id, task_queue_settings, revision, updated_at)
         values ($1, $2::jsonb, $3, $4)
         on conflict (id) do update set
           task_queue_settings = excluded.task_queue_settings,
           revision = excluded.revision,
           updated_at = excluded.updated_at`,
        ["default", JSON.stringify(normalized), nextRevision, deps.millisToDate(updatedAt)],
      );
      return { taskQueueSettings: normalized, updatedAt, revision: nextRevision };
    }
    const db = await readSettingsDb();
    const currentRevision = positiveIntegerOrDefault(db.taskQueueSettingsRevision, 1);
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      throw deps.createRevisionConflictError("task-queue", currentRevision);
    }
    const nextRevision = currentRevision + 1;
    const updatedAt = Date.now();
    await writeSettingsDb({
      ...db,
      taskQueueSettings: normalized,
      taskQueueSettingsRevision: nextRevision,
      taskQueueSettingsUpdatedAt: updatedAt,
    });
    return { taskQueueSettings: normalized, updatedAt, revision: nextRevision };
  }
}

function positiveIntegerOrDefault(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function positiveNumberOrDefault(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}
