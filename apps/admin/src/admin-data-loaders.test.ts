import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
