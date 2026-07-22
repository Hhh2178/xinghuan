import { describe, expect, it, vi } from "vitest";
import { createAdminAgentGovernanceRouteHandler } from "./admin-agent-governance-routes.js";

describe("admin agent governance routes", () => {
  it("returns the governance overview only for an admin in PostgreSQL mode", async () => {
    const sendT8 = vi.fn();
    const repository = {
      readOverview: vi.fn(async () => ({ activeAgentRuns: 2 })),
      readRuntimeControls: vi.fn(async () => [{ environment: "gray", agentEnabled: false, revision: 1 }]),
    } as any;
    const handler = createAdminAgentGovernanceRouteHandler({ repository, sendT8, usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://local/api/admin/agent-runtime/overview"), currentUser: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" }, requestContext: {} as any })).resolves.toBe(true);
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { metrics: { activeAgentRuns: 2 }, controls: [{ environment: "gray", agentEnabled: false, revision: 1 }] });
  });

  it("does not claim unrelated admin routes", async () => {
    const handler = createAdminAgentGovernanceRouteHandler({ repository: {} as any, sendT8: vi.fn(), usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://local/api/admin/tasks"), currentUser: null, requestContext: {} as any })).resolves.toBe(false);
  });
});
