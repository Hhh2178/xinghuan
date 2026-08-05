import { describe, expect, it, vi } from "vitest";

import { handleAdminSystemSettingsRoutes } from "./admin-system-settings-routes.js";

describe("admin system settings routes", () => {
  it("passes the bounded health range to the observability reader", async () => {
    const readSystemObservability = vi.fn(async () => ({ range: { key: "7d" } }));
    const sendT8 = vi.fn();
    const deps = {
      sendT8,
      appendAudit: vi.fn(async () => undefined),
      readTaskQueueSettingsRecord: vi.fn(async () => ({
        taskQueueSettings: {
          image: { concurrency: 1, userConcurrency: 1 },
          audio: { concurrency: 1, userConcurrency: 1 },
          video: { concurrency: 1, userConcurrency: 1 },
          runninghub: { concurrency: 1, enabled: true },
        },
        updatedAt: 1,
        revision: 1,
      })),
      readProviderRecords: vi.fn(async () => []),
      withEffectiveRunningHubConcurrency: (settings: unknown) => settings,
      readDatabaseStatus: vi.fn(async () => ({ configured: true, status: "connected", error: "" })),
      readRedisStatus: vi.fn(async () => ({
        configured: true,
        status: "connected",
        queue: "xinghuan:tasks:gray",
        depth: 0,
        queues: [],
        error: "",
        runninghub: {},
      })),
      readSystemObservability,
      readStorageStats: vi.fn(async () => ({ canvases: 0, resources: 0 })),
      environment: "gray",
      dataDir: "data",
      storageDriver: "postgres",
      authDbPath: "auth",
      adminDbPath: "admin",
      version: "0.7.17",
    };

    const handled = await handleAdminSystemSettingsRoutes({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/system?range=7d"),
      adminUser: { id: "admin-1", email: "admin@example.test", name: "Admin", role: "admin" },
      requestContext: {
        requestId: "request-1",
        method: "GET",
        path: "/api/admin/system",
        ip: "127.0.0.1",
        userAgent: "vitest",
        startedAt: 1,
      },
      deps: deps as any,
    });

    expect(handled).toBe(true);
    expect(readSystemObservability).toHaveBeenCalledWith(
      expect.objectContaining({ status: "connected" }),
      expect.objectContaining({ queue: "xinghuan:tasks:gray" }),
      "7d",
    );
    expect(sendT8).toHaveBeenCalledOnce();
  });

  it("keeps runtime settings reads independent from health series", async () => {
    const readSystemObservability = vi.fn(async () => ({ expensive: true }));
    const sendT8 = vi.fn();
    const deps = {
      sendT8,
      appendAudit: vi.fn(async () => undefined),
      readTaskQueueSettingsRecord: vi.fn(async () => ({ taskQueueSettings: { runninghub: { concurrency: 1, enabled: true } }, revision: 3, updatedAt: 4 })),
      readProviderRecords: vi.fn(async () => [{ id: "p1" }]),
      withEffectiveRunningHubConcurrency: (settings: unknown) => settings,
      readDatabaseStatus: vi.fn(), readRedisStatus: vi.fn(), readSystemObservability, readStorageStats: vi.fn(),
      environment: "gray", dataDir: "data", storageDriver: "postgres", authDbPath: "auth", adminDbPath: "admin", version: "0.8.25",
    };
    const handled = await handleAdminSystemSettingsRoutes({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://local.test/api/admin/system/runtime-settings"),
      adminUser: { id: "admin-1", email: "admin@example.test", name: "Admin", role: "admin" },
      requestContext: { requestId: "request-2", method: "GET", path: "/api/admin/system/runtime-settings", ip: "127.0.0.1", userAgent: "vitest", startedAt: 1 },
      deps: deps as any,
    });
    expect(handled).toBe(true);
    expect(readSystemObservability).not.toHaveBeenCalled();
    expect(deps.readDatabaseStatus).not.toHaveBeenCalled();
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ taskQueueSettingsRevision: 3 }));
  });
});
