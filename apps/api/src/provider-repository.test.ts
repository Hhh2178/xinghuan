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
    sort_order: 0,
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
    sort_order: 0,
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

  it("deletes file-backed provider and clears related model/task references", async () => {
    const dir = await mkdtemp(join(tmpdir(), "provider-repo-delete-"));
    const adminDbPath = join(dir, "admin.json");
    const repo = createProviderRepository(createDeps({ adminDbPath }));
    await repo.writeAdminDb({
      providers: [{ id: "p1", name: "Provider One", baseUrl: "https://example.test", enabled: true, createdAt: 1, updatedAt: 1 }],
      models: [{ id: "m1", providerId: "p1", modelId: "gpt-test", displayName: "GPT Test", capability: "chat", enabled: true, inputProfile: "prompt", parameterSchema: "{}", createdAt: 1, updatedAt: 1 }],
      tasks: [{ providerId: "p1", modelId: "m1" }],
    });

    await expect(repo.deleteProviderRecord("p1")).resolves.toMatchObject({ id: "p1" });
    await expect(repo.readAdminDb()).resolves.toMatchObject({
      providers: [],
      models: [],
      tasks: [{ providerId: "", modelId: "" }],
    });
    await rm(dir, { recursive: true, force: true });
  });

  it("persists provider and scoped model display order in file mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "provider-repo-order-"));
    const adminDbPath = join(dir, "admin.json");
    const repo = createProviderRepository(createDeps({ adminDbPath }));
    await repo.writeAdminDb({
      providers: [
        { id: "p1", name: "One", baseUrl: "", enabled: true, sortOrder: 0, createdAt: 2, updatedAt: 2 },
        { id: "p2", name: "Two", baseUrl: "", enabled: true, sortOrder: 10, createdAt: 1, updatedAt: 1 },
      ],
      models: [
        { id: "m1", providerId: "p1", modelId: "one", displayName: "One", capability: "image", enabled: true, sortOrder: 0, inputProfile: "prompt", parameterSchema: "{}", createdAt: 2, updatedAt: 2 },
        { id: "m2", providerId: "p1", modelId: "two", displayName: "Two", capability: "image", enabled: true, sortOrder: 10, inputProfile: "prompt", parameterSchema: "{}", createdAt: 1, updatedAt: 1 },
      ],
    });

    await repo.reorderProviderRecords(["p2", "p1"]);
    await repo.reorderModelRecords({ providerId: "p1", capability: "image", orderedIds: ["m2", "m1"] });

    const loaded = await repo.readAdminDb();
    expect(loaded.providers.map((provider) => provider.id)).toEqual(["p2", "p1"]);
    expect(loaded.models.map((model) => model.id)).toEqual(["m2", "m1"]);
    await rm(dir, { recursive: true, force: true });
  });

  it("updates postgres provider display order in one transaction", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from xh_providers")) {
        return { rows: [providerRow({ id: "p1", sort_order: 0 }), providerRow({ id: "p2", sort_order: 10 })] };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query, connect: async () => ({ query, release }) } as never),
    }));

    await expect(repo.reorderProviderRecords(["p2", "p1"])).resolves.toEqual([
      expect.objectContaining({ id: "p2", sortOrder: 0 }),
      expect.objectContaining({ id: "p1", sortOrder: 10 }),
    ]);
    expect(query).toHaveBeenCalledWith("begin");
    expect(query).toHaveBeenCalledWith("commit");
    expect(query).toHaveBeenCalledWith("update xh_providers set sort_order = $2 where id = $1", ["p2", 0]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("persists sort order through postgres provider and model upserts", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repo = createProviderRepository(createDeps({
      usePostgresRepository: () => true,
      getPostgresPool: async () => ({ query } as never),
    }));

    await repo.upsertProviderRecordPostgres({
      id: "p1",
      sortOrder: 40,
      name: "Provider One",
      baseUrl: "https://example.test",
      enabled: true,
      createdAt: 1,
      updatedAt: 2,
    });
    await repo.upsertModelRecordPostgres({
      id: "m1",
      sortOrder: 30,
      providerId: "p1",
      modelId: "gpt-test",
      displayName: "GPT Test",
      capability: "chat",
      enabled: true,
      inputProfile: "prompt",
      parameterSchema: "{}",
      createdAt: 1,
      updatedAt: 2,
    });

    const providerCall = query.mock.calls[0] as unknown as [string, unknown[]];
    const modelCall = query.mock.calls[1] as unknown as [string, unknown[]];
    expect(providerCall[0]).toContain("sort_order");
    expect(providerCall[1]).toHaveLength(18);
    expect(providerCall[1][1]).toBe(40);
    expect(modelCall[0]).toContain("sort_order");
    expect(modelCall[1]).toHaveLength(16);
    expect(modelCall[1][1]).toBe(30);
  });
});
