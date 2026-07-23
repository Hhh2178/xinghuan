import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createCanvasRunRouteHandler } from "./canvas-run-routes.js";

function request(method: string, body?: unknown) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as any;
  stream.method = method;
  stream.headers = {};
  return stream;
}

describe("canvas run routes", () => {
  it("creates a run for the authenticated owner and preserves idempotency", async () => {
    const createRun = vi.fn(async () => ({ created: true, run: { id: "run-1" } as any }));
    const sendT8 = vi.fn();
    const handler = createCanvasRunRouteHandler({
      sendT8,
      createRun,
      readRun: vi.fn(),
      readEvents: vi.fn(),
      commandRun: vi.fn(),
      invalidRequest: (message) => new Error(message),
    });
    const handled = await handler({
      request: request("POST", { canvasId: "canvas-1", workflowId: "workflow-1", workflowInputValues: { "var-theme": "海边" }, idempotencyKey: "create-1", budget: { maxTaskCount: 5 } }),
      response: {} as any,
      url: new URL("http://localhost/api/canvas-runs"),
      currentUser: { id: "owner-1" },
    });

    expect(handled).toBe(true);
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", workflowInputValues: { "var-theme": "海边" }, idempotencyKey: "create-1" }));
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { id: "run-1" }, 201);
  });

  it("routes pause and read operations without accepting an owner from the body", async () => {
    const commandRun = vi.fn(async () => ({ id: "run-1", status: "paused" } as any));
    const readRun = vi.fn(async () => ({ id: "run-1" } as any));
    const sendT8 = vi.fn();
    const readEvents = vi.fn(async () => ({ items: [], nextSequence: 4 }));
    const handler = createCanvasRunRouteHandler({ sendT8, createRun: vi.fn(), readRun, readEvents, commandRun, invalidRequest: (message) => new Error(message) });

    await handler({ request: request("POST", { idempotencyKey: "pause-1", ownerId: "attacker" }), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1/pause"), currentUser: { id: "owner-1" } });
    await handler({ request: request("GET"), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1"), currentUser: { id: "owner-1" } });
    await handler({ request: request("GET"), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1/events?after=4"), currentUser: { id: "owner-1" } });

    expect(commandRun).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", runId: "run-1", command: "pause", idempotencyKey: "pause-1" }));
    expect(readRun).toHaveBeenCalledWith("owner-1", "run-1");
    expect(readEvents).toHaveBeenCalledWith("owner-1", "run-1", 4, 200);
  });

  it("streams persisted run events as server-sent events", async () => {
    const readRun = vi.fn(async () => ({ id: "run-1" } as any));
    const readEvents = vi.fn(async () => ({
      items: [{ id: "event-1", runId: "run-1", sequence: 5, eventType: "canvas_run.started", payload: {} }],
      nextSequence: 5,
    }));
    const incoming = request("GET");
    const response = { writeHead: vi.fn(), write: vi.fn() } as any;
    const handler = createCanvasRunRouteHandler({
      sendT8: vi.fn(),
      createRun: vi.fn(),
      readRun,
      readEvents,
      commandRun: vi.fn(),
      invalidRequest: (message) => new Error(message),
    });

    const handled = await handler({
      request: incoming,
      response,
      url: new URL("http://localhost/api/canvas-runs/run-1/events/stream?after=4"),
      currentUser: { id: "owner-1" },
    });
    incoming.emit("close");

    expect(handled).toBe(true);
    expect(readRun).toHaveBeenCalledWith("owner-1", "run-1");
    expect(readEvents).toHaveBeenCalledWith("owner-1", "run-1", 4, 200);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ "Content-Type": "text/event-stream; charset=utf-8" }));
    expect(response.write).toHaveBeenCalledWith(expect.stringContaining("event: run-event"));
    expect(response.write).toHaveBeenCalledWith(expect.stringContaining("id: 5"));
    expect(response.write).toHaveBeenCalledWith(expect.stringContaining("canvas_run.started"));
  });

  it("continues from Last-Event-ID after the browser reconnects", async () => {
    const readEvents = vi.fn(async (_ownerId: string, _runId: string, after = 0) => ({
      items: [{ id: `event-${after + 1}`, runId: "run-1", sequence: after + 1, eventType: "canvas_run.progress", payload: {} }],
      nextSequence: after + 1,
    }));
    const handler = createCanvasRunRouteHandler({
      sendT8: vi.fn(), createRun: vi.fn(), readRun: vi.fn(async () => ({ id: "run-1" } as any)), readEvents,
      commandRun: vi.fn(), invalidRequest: (message) => new Error(message),
    });
    const firstRequest = request("GET");
    const firstResponse = { writeHead: vi.fn(), write: vi.fn() } as any;
    await handler({ request: firstRequest, response: firstResponse, url: new URL("http://localhost/api/canvas-runs/run-1/events/stream?after=4"), currentUser: { id: "owner-1" } });
    firstRequest.emit("close");
    const reconnectRequest = request("GET");
    reconnectRequest.headers["last-event-id"] = "5";
    const reconnectResponse = { writeHead: vi.fn(), write: vi.fn() } as any;
    await handler({ request: reconnectRequest, response: reconnectResponse, url: new URL("http://localhost/api/canvas-runs/run-1/events/stream"), currentUser: { id: "owner-1" } });
    reconnectRequest.emit("close");

    expect(readEvents).toHaveBeenNthCalledWith(1, "owner-1", "run-1", 4, 200);
    expect(readEvents).toHaveBeenNthCalledWith(2, "owner-1", "run-1", 5, 200);
    expect(reconnectResponse.write).toHaveBeenCalledWith(expect.stringContaining("id: 6"));
  });

  it("decides only an existing owner-scoped approval for the run", async () => {
    const decideApproval = vi.fn(async () => ({ id: "approval-1", status: "approved" }));
    const sendT8 = vi.fn();
    const handler = createCanvasRunRouteHandler({
      sendT8,
      createRun: vi.fn(),
      readRun: vi.fn(),
      readEvents: vi.fn(),
      commandRun: vi.fn(),
      decideApproval,
      invalidRequest: (message) => new Error(message),
    });

    await handler({
      request: request("POST", {}),
      response: {} as any,
      url: new URL("http://localhost/api/canvas-runs/run-1/approvals/approval-1/approve"),
      currentUser: { id: "owner-1" },
    });

    expect(decideApproval).toHaveBeenCalledWith({ ownerId: "owner-1", runId: "run-1", approvalId: "approval-1", decision: "approved", reason: undefined });
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { id: "approval-1", status: "approved" });
  });

  it("reads and applies owner-scoped manual candidate selections", async () => {
    const readCandidateSelections = vi.fn(async () => [{ stepId: "step-1" }]);
    const selectCandidates = vi.fn(async () => ({ stepId: "step-1", selectedArtifactIds: ["artifact-2"] }));
    const sendT8 = vi.fn();
    const handler = createCanvasRunRouteHandler({
      sendT8,
      createRun: vi.fn(),
      readRun: vi.fn(),
      readEvents: vi.fn(),
      commandRun: vi.fn(),
      readCandidateSelections,
      selectCandidates,
      invalidRequest: (message) => new Error(message),
    });

    await handler({
      request: request("GET"),
      response: {} as any,
      url: new URL("http://localhost/api/canvas-runs/run-1/candidate-selections"),
      currentUser: { id: "owner-1" },
    });
    await handler({
      request: request("POST", { selectedArtifactIds: ["artifact-2", "artifact-2"], idempotencyKey: "selection-command-1", ownerId: "attacker" }),
      response: {} as any,
      url: new URL("http://localhost/api/canvas-runs/run-1/candidate-selections/step-1"),
      currentUser: { id: "owner-1" },
    });

    expect(readCandidateSelections).toHaveBeenCalledWith({ ownerId: "owner-1", runId: "run-1" });
    expect(selectCandidates).toHaveBeenCalledWith({
      ownerId: "owner-1",
      runId: "run-1",
      stepId: "step-1",
      selectedArtifactIds: ["artifact-2"],
      idempotencyKey: "selection-command-1",
    });
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { items: [{ stepId: "step-1" }] });
  });

  it("reads, saves, and resets workflow settings for the authenticated owner", async () => {
    const readWorkflowSettings = vi.fn(async () => ({ workflowId: "workflow-1", settings: { defaultRetryCount: 2 } }));
    const saveWorkflowSettings = vi.fn(async () => ({ workflowId: "workflow-1", settings: { defaultRetryCount: 5 } }));
    const resetWorkflowSettings = vi.fn(async () => ({ workflowId: "workflow-1", settings: { defaultRetryCount: 2 } }));
    const sendT8 = vi.fn();
    const handler = createCanvasRunRouteHandler({
      sendT8, createRun: vi.fn(), readRun: vi.fn(), readEvents: vi.fn(), commandRun: vi.fn(),
      readWorkflowSettings, saveWorkflowSettings, resetWorkflowSettings,
      invalidRequest: (message) => new Error(message),
    });

    await handler({ request: request("GET"), response: {} as any, url: new URL("http://localhost/api/canvas-run-settings?canvasId=canvas-1&workflowId=workflow-1"), currentUser: { id: "owner-1" } });
    await handler({ request: request("PUT", { canvasId: "canvas-1", workflowId: "workflow-1", settings: { defaultRetryCount: 5 }, ownerId: "attacker" }), response: {} as any, url: new URL("http://localhost/api/canvas-run-settings"), currentUser: { id: "owner-1" } });
    await handler({ request: request("DELETE"), response: {} as any, url: new URL("http://localhost/api/canvas-run-settings?canvasId=canvas-1&workflowId=workflow-1"), currentUser: { id: "owner-1" } });

    expect(readWorkflowSettings).toHaveBeenCalledWith({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1" });
    expect(saveWorkflowSettings).toHaveBeenCalledWith({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", settings: { defaultRetryCount: 5 } });
    expect(resetWorkflowSettings).toHaveBeenCalledWith({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1" });
  });

  it("lists workflow runs for the authenticated owner and requested canvas", async () => {
    const listWorkflowRuns = vi.fn(async () => [{ id: "run-1", workflowId: "workflow-1" }] as any);
    const sendT8 = vi.fn();
    const handler = createCanvasRunRouteHandler({
      sendT8, createRun: vi.fn(), readRun: vi.fn(), readEvents: vi.fn(), commandRun: vi.fn(), listWorkflowRuns,
      invalidRequest: (message) => new Error(message),
    });

    await handler({ request: request("GET"), response: {} as any, url: new URL("http://localhost/api/canvas-runs?canvasId=canvas-1"), currentUser: { id: "owner-1" } });

    expect(listWorkflowRuns).toHaveBeenCalledWith({ ownerId: "owner-1", canvasId: "canvas-1" });
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { items: [{ id: "run-1", workflowId: "workflow-1" }] });
  });
});
