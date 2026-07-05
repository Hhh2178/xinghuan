import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createProviderRepository, type AdminDb } from "./provider-repository.js";

function createDeps(overrides: Partial<Parameters<typeof createProviderRepository>[0]> = {}) {
  const dir = "";
  return {
    usePostgresRepository: () => false,
    ensureDataDirs: async () => undefined,
    adminDbPath: join(dir, "admin.json"),
    getPostgresPool: async () => {
      throw new Error("not used");
    },
    dateToMillis: (value: unknown) => Number(value) || 0,
    millisToDate: (value: number) => new Date(value),
    normalizeAdminModelRecord: (model) => model,
    normalizeProviderSecret: (provider) => provider,
    normalizeProviderProtocol: (value: unknown) => String(value || "openai") as never,
    normalizeCapability: (value: unknown) => String(value || "chat") as never,
    normalizeOptionalProtocol: (value: unknown) => String(value || ""),
    normalizeRunningHubEntries: (value: unknown) => (Array.isArray(value) ? value : []),
    normalizeRunningHubKeyPool: (value: unknown) => (Array.isArray(value) ? value : []),
    normalizeModelScopeLoras: (value: unknown) => (Array.isArray(value) ? value : []),
    plainObject: (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}),
    safeJsonText: (value: unknown, fallback = "{}") => String(value ?? fallback),
    safeText: (value: unknown, fallback = "") => String(value ?? fallback),
    ...overrides,
  } as Parameters<typeof createProviderRepository>[0];
}

function providerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Provider One",
    base_url: "https://example.test",
    protocol: "openai",
    enabled: true,
    api_key_cipher: null,
    api_key_preview: null,
    last_probe_status: null,
    last_probe_message: null,
    last_fetched_at: null,
    rh_apps: [],
    rh_workflows: [],
    rh_key_pool: [],
    ms_loras: [],
    note: null,
    created_at: 10,
    updated_at: 11,
    ...overrides,
  };
}

function modelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    provider_id: "p1",
    model_id: "gpt-test",
    display_name: "GPT Test",
    capability: "chat",
    enabled: true,
    input_profile: "prompt",
    input_capabilities: {},
    capability_tags: ["chat"],
    test_state: {},
    parameter_schema: {},
    advanced_config: {},
    protocol_override: null,
    created_at: 10,
    updated_at: 11,
    ...overrides,
  };
}

describe("provider repository", () => {
  it("reads and writes file-backed admin db round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "provider-repo-"));
    const adminDbPath = join(dir, "admin.json");
    const repo = createProviderRepository(createDeps({ adminDbPath }));
    const db: AdminDb = {
      providers: [{ id: "p1", name: "Provider One", baseUrl: "https://example.test", enabled: true, createdAt: 1, updatedAt: 1 }],
      models: [],
    };

    await repo.writeAdminDb(db);
    const loaded = await repo.readAdminDb();

    expect(loaded.providers).toHaveLength(1);
    expect(loaded.providers[0].name).toBe("Provider One");
    expect(JSON.parse(await readFile(adminDbPath, "utf-8"))).toMatchObject({ providers: [{ id: "p1" }] });
    await rm(dir, { recursive: true, force: true });
  });

  it("reads postgres provider records without loading models", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from xh_providers");
      expect(sql).not.toContain("from xh_models");
      return { rows: [providerRow()] };
    });
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as never),
    }));

    await expect(repo.readProviderRecords()).resolves.toEqual([expect.objectContaining({ id: "p1", name: "Provider One" })]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("finds postgres provider by natural key without loading models", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from xh_providers");
      expect(sql).toContain("lower(name)");
      expect(sql).not.toContain("from xh_models");
      return { rows: [providerRow()] };
    });
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as never),
    }));

    await expect(repo.findProviderRecordByNaturalKey("Provider One")).resolves.toMatchObject({ id: "p1" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("finds postgres model by id without loading providers", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from xh_models");
      expect(sql).toContain("where id = $1");
      expect(sql).not.toContain("from xh_providers");
      return { rows: [modelRow()] };
    });
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as never),
    }));

    await expect(repo.findModelRecordById("m1")).resolves.toMatchObject({ id: "m1", providerId: "p1" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("updates postgres runninghub catalog fields without replacing provider row", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [providerRow({ rh_apps: [{ id: "a1" }] })] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as never),
      normalizeRunningHubEntries: (value: unknown) => (Array.isArray(value) ? value : []),
    }));

    await expect(repo.updateProviderRhCatalog("p1", (provider) => ({ ...provider, rhApps: [{ id: "a2", name: "App 2" } as never] }))).resolves.toMatchObject({
      id: "p1",
    });

    expect(query.mock.calls[1][0]).toContain("update xh_providers set rh_apps");
    expect(query.mock.calls[1][0]).not.toContain("delete from xh_providers");
  });
});
