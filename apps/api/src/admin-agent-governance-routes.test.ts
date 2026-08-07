import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { createAdminAgentGovernanceRouteHandler } from "./admin-agent-governance-routes.js";

const admin = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" } as const;

function request(method: string, body?: unknown) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as any;
  stream.method = method;
  stream.headers = {};
  return stream;
}

describe("admin agent governance routes", () => {
  it("returns the governance overview only for an admin in PostgreSQL mode", async () => {
    const sendT8 = vi.fn();
    const repository = {
      readOverview: vi.fn(async () => ({ activeAgentRuns: 2 })),
      readRuntimeControl: vi.fn(async () => ({ environment: "gray", agentEnabled: false, revision: 1 })),
    } as any;
    const handler = createAdminAgentGovernanceRouteHandler({ currentEnvironment: "gray", repository, readProcessGates: () => ({ apiCanvasRunsEnabled: true, workerCanvasRunsEnabled: false }), sendT8, usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: request("GET"), response: {} as any, url: new URL("http://local/api/admin/agent-runtime/overview"), currentUser: admin, requestContext: {} as any })).resolves.toBe(true);
    expect(repository.readOverview).toHaveBeenCalledWith("gray");
    expect(repository.readRuntimeControl).toHaveBeenCalledWith("gray");
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { environment: "gray", metrics: { activeAgentRuns: 2 }, controls: [{ environment: "gray", agentEnabled: false, revision: 1 }], processGates: { apiCanvasRunsEnabled: true, workerCanvasRunsEnabled: false } });
  });

  it("rejects a governance publication that targets another environment", async () => {
    const repository = { publishAgentConfiguration: vi.fn() } as any;
    const handler = createAdminAgentGovernanceRouteHandler({ currentEnvironment: "gray", repository, readProcessGates: () => ({ apiCanvasRunsEnabled: false, workerCanvasRunsEnabled: false }), sendT8: vi.fn(), usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: request("POST", { environment: "production" }), response: {} as any, url: new URL("http://local/api/admin/agent-runtime/agent-configurations/config-1/publish"), currentUser: admin, requestContext: {} as any })).rejects.toThrow("AGENT_RUNTIME_ENVIRONMENT_SCOPE_FORBIDDEN");
    expect(repository.publishAgentConfiguration).not.toHaveBeenCalled();
  });

  it("does not claim unrelated admin routes", async () => {
    const handler = createAdminAgentGovernanceRouteHandler({ currentEnvironment: "gray", repository: {} as any, readProcessGates: () => ({ apiCanvasRunsEnabled: false, workerCanvasRunsEnabled: false }), sendT8: vi.fn(), usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://local/api/admin/tasks"), currentUser: null, requestContext: {} as any })).resolves.toBe(false);
  });

  it("keeps retired knowledge readable but rejects new knowledge writes explicitly", async () => {
    const sendT8 = vi.fn();
    const repository = { createKnowledgeCollection: vi.fn() } as any;
    const handler = createAdminAgentGovernanceRouteHandler({ currentEnvironment: "gray", repository, readProcessGates: () => ({ apiCanvasRunsEnabled: false, workerCanvasRunsEnabled: false }), sendT8, usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: { method: "POST" } as any, response: {} as any, url: new URL("http://local/api/admin/agent-runtime/knowledge/collections"), currentUser: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" }, requestContext: {} as any })).resolves.toBe(true);
    expect(repository.createKnowledgeCollection).not.toHaveBeenCalled();
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "AGENT_KNOWLEDGE_WRITES_RETIRED", deprecated: true }), 410);
  });

  it("exposes active tools separately from the historical retired catalog", async () => {
    const sendT8 = vi.fn();
    const repository = { listToolPolicies: vi.fn(async () => []) } as any;
    const handler = createAdminAgentGovernanceRouteHandler({ currentEnvironment: "gray", repository, readProcessGates: () => ({ apiCanvasRunsEnabled: false, workerCanvasRunsEnabled: false }), sendT8, usePostgresRepository: () => true, appendAudit: vi.fn(), invalidRequest: (message) => new Error(message) });
    await expect(handler({ request: { method: "GET" } as any, response: {} as any, url: new URL("http://local/api/admin/agent-runtime/tools"), currentUser: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" }, requestContext: {} as any })).resolves.toBe(true);
    const payload = sendT8.mock.calls[0][1];
    expect(payload.catalog.map((tool: { name: string }) => tool.name)).not.toContain("canvas.patch.propose");
    expect(payload.retiredCatalog.map((tool: { name: string }) => tool.name)).toContain("canvas.patch.propose");
  });
});
