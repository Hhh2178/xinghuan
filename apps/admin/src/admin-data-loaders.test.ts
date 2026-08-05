import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAdminQueryCache } from "./admin-query-client";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  listAnnouncements: vi.fn(),
}));

vi.mock("./admin-api-client", () => ({
  api: mocks.api,
  adminAnnouncementApi: { listAnnouncements: mocks.listAnnouncements },
}));

import { readAdminWorkspaceSnapshot } from "./admin-data-loaders";

describe("readAdminWorkspaceSnapshot", () => {
  beforeEach(() => {
    clearAdminQueryCache();
    mocks.api.mockReset();
    mocks.listAnnouncements.mockReset();
  });

  it("loads providers and models when automation is opened directly", async () => {
    const providers = [{ id: "provider-1", name: "Chat Provider" }];
    const models = [{ id: "model-1", capability: "chat", enabled: true }];
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/admin/providers") return providers;
      if (path === "/api/admin/models") return models;
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(readAdminWorkspaceSnapshot("automation", "/api/admin/tasks"))
      .resolves.toEqual({ providers, models });
    expect(mocks.api.mock.calls.map(([path]) => path)).toEqual([
      "/api/admin/providers",
      "/api/admin/models",
    ]);
  });

  it("does not load sessions on the accounts subpage", async () => {
    const users = [{ id: "u1" }];
    const groups = [{ id: "g1" }];
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/admin/users") return users;
      if (path === "/api/admin/user-groups") return groups;
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(readAdminWorkspaceSnapshot("organization", "/api/admin/tasks", "24h", "accounts"))
      .resolves.toEqual({ users, userGroups: groups });
    expect(mocks.api.mock.calls.map(([path]) => path)).toEqual([
      "/api/admin/users",
      "/api/admin/user-groups",
    ]);
  });

  it("loads only sessions on the sessions subpage", async () => {
    const sessions = [{ id: "s1" }];
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/admin/sessions") return sessions;
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(readAdminWorkspaceSnapshot("organization", "/api/admin/tasks", "24h", "sessions"))
      .resolves.toEqual({ sessions });
    expect(mocks.api.mock.calls.map(([path]) => path)).toEqual([
      "/api/admin/sessions",
    ]);
  });

  it("loads only provider context and models on the reliability subpage", async () => {
    const providers = [{ id: "provider-1", name: "Provider" }];
    const models = [{ id: "model-1", capability: "image", enabled: true }];
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/admin/providers") return providers;
      if (path === "/api/admin/models") return models;
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(readAdminWorkspaceSnapshot("analytics", "/api/admin/tasks", "24h", "reliability"))
      .resolves.toEqual({ providers, models });
    expect(mocks.api.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/admin/models",
      "/api/admin/providers",
    ]);
  });

  it("keeps audit data complete without loading a second audit request", async () => {
    const users = [{ id: "u1" }];
    const groups = [{ id: "g1" }];
    const providers = [{ id: "provider-1", name: "Provider" }];
    const models = [{ id: "model-1", capability: "image", enabled: true }];
    const auditLogs = [{ id: "audit-1" }];
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/admin/users") return users;
      if (path === "/api/admin/user-groups") return groups;
      if (path === "/api/admin/providers") return providers;
      if (path === "/api/admin/models") return models;
      if (path === "/api/admin/audit") return auditLogs;
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(readAdminWorkspaceSnapshot("analytics", "/api/admin/tasks", "24h", "audit"))
      .resolves.toEqual({ auditLogs, users, userGroups: groups, providers, models });
    expect(mocks.api.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/admin/audit",
      "/api/admin/models",
      "/api/admin/providers",
      "/api/admin/user-groups",
      "/api/admin/users",
    ]);
  });
});
