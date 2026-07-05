import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { defaultTaskQueueSettings } from "@xinghuan/shared";
import { createSettingsRepository, type AssistantSettingsRecord } from "./settings-repository.js";

function createDeps(overrides: Partial<Parameters<typeof createSettingsRepository>[0]> = {}): Parameters<typeof createSettingsRepository>[0] {
  const base: Parameters<typeof createSettingsRepository>[0] = {
    usePostgresRepository: () => false,
    ensureDataDirs: async () => undefined,
    adminDbPath: join("", "admin.json"),
    getPostgresPool: async () => {
      throw new Error("not used");
    },
    dateToMillis: (value: unknown) => (value instanceof Date ? value.getTime() : Number(value) || 0),
    millisToDate: (value: number | undefined) => new Date(value || 0),
    plainObject: (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}),
    defaultAssistantSettings: createDefaultAssistantSettings,
    normalizeAssistantSettings: (value: unknown, base = createDefaultAssistantSettings()): AssistantSettingsRecord => ({
      ...base,
      ...(value as Partial<AssistantSettingsRecord>),
    }),
    normalizeTaskQueueSettings: (_value: unknown, base = defaultTaskQueueSettings()) => ({ ...base }),
    defaultTaskQueueSettings,
    createRevisionConflictError: (settingsKey, currentRevision) => {
      const error = new Error("ADMIN_SETTINGS_REVISION_CONFLICT") as Error & { settingsKey?: string; currentRevision?: number };
      error.settingsKey = settingsKey;
      error.currentRevision = currentRevision;
      return error;
    },
  };
  return { ...base, ...overrides };
}

function createDefaultAssistantSettings(): AssistantSettingsRecord {
  return {
    frontend: {
      enabled: true,
      title: "画布 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      allowWorkflowAttachment: true,
      allowNodeAttachment: true,
      allowMediaAttachment: true,
      persistMemory: false,
    },
    backend: {
      enabled: true,
      title: "后台 AI 助手",
      hint: "",
      placeholder: "输入问题或要求",
      defaultOpen: true,
      allowProviderContext: true,
      allowModelContext: true,
      allowTaskContext: true,
      allowUserContext: true,
      allowAuditContext: true,
    },
    integration: {
      kernel: "hermes",
      endpoint: "",
      endpointConfigured: false,
      workspace: "",
      model: "Agnes-2.0-Flash",
      profile: "canvas-assistant",
      persistMemory: false,
      strictMode: true,
    },
    updatedAt: 1,
    revision: 1,
  };
}

describe("settings repository", () => {
  it("reads postgres assistant settings without loading system settings", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from xh_assistant_settings");
      expect(sql).not.toContain("xh_system_settings");
      return {
        rows: [{
          frontend: { enabled: true },
          backend: { enabled: true },
          integration: { kernel: "hermes" },
          revision: 5,
          updated_at: new Date("2026-07-04T00:00:00.000Z"),
        }],
      };
    });
    const repo = createSettingsRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
    }));

    await expect(repo.readAssistantSettingsRecord()).resolves.toMatchObject({
      revision: 5,
      updatedAt: Date.parse("2026-07-04T00:00:00.000Z"),
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("reads postgres task queue settings without loading assistant settings", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from xh_system_settings");
      expect(sql).not.toContain("xh_assistant_settings");
      return {
        rows: [{
          task_queue_settings: { workers: [] },
          revision: 6,
          updated_at: new Date("2026-07-04T00:05:00.000Z"),
        }],
      };
    });
    const repo = createSettingsRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
    }));

    await expect(repo.readTaskQueueSettingsRecord()).resolves.toMatchObject({
      revision: 6,
      updatedAt: Date.parse("2026-07-04T00:05:00.000Z"),
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("reads and writes file-backed settings db round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "settings-repo-"));
    const adminDbPath = join(dir, "admin.json");
    const repo = createSettingsRepository(createDeps({ adminDbPath }));

    const assistant = await repo.readAssistantSettingsRecord();
    const queue = await repo.readTaskQueueSettingsRecord();
    await repo.writeAssistantSettingsRecord(assistant);
    await repo.writeTaskQueueSettingsRecord(queue.taskQueueSettings);

    const loaded = JSON.parse(await readFile(adminDbPath, "utf-8"));
    expect(loaded).toHaveProperty("assistantSettings");
    expect(loaded).toHaveProperty("taskQueueSettings");
    await rm(dir, { recursive: true, force: true });
  });

  it("writes postgres settings with revision protection", async () => {
    const writes: string[] = [];
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("select revision from xh_assistant_settings")) return { rows: [{ revision: 3 }] };
      if (sql.includes("select revision from xh_system_settings")) return { rows: [{ revision: 7 }] };
      writes.push(sql);
      return { rows: [] };
    });
    const repo = createSettingsRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as any),
    }));

    await expect(repo.writeAssistantSettingsRecord(createDefaultAssistantSettings(), 3)).resolves.toMatchObject({ revision: 4 });
    await expect(repo.writeTaskQueueSettingsRecord(defaultTaskQueueSettings(), 7)).resolves.toMatchObject({ revision: 8 });
    await expect(repo.writeTaskQueueSettingsRecord(defaultTaskQueueSettings(), 1)).rejects.toThrow("ADMIN_SETTINGS_REVISION_CONFLICT");

    expect(writes.some((sql) => sql.includes("xh_assistant_settings"))).toBe(true);
    expect(writes.some((sql) => sql.includes("xh_system_settings"))).toBe(true);
  });
});
