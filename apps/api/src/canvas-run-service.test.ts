import { describe, expect, it, vi } from "vitest";

import { createCanvasRunService, normalizeCanvasRunBudget, normalizeCanvasRunConfiguration } from "./canvas-run-service.js";

describe("canvas run service", () => {
  it("compiles only the authenticated owner's persisted canvas revision", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-1", ...input } }));
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 8,
        data: { nodes: [{ id: "image-1", type: "image", position: { x: 0, y: 0 } }], edges: [] },
      })),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    await service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", idempotencyKey: "create-1", budget: { maxTaskCount: 50 } });

    expect(repository.readOwnedCanvasSnapshot).toHaveBeenCalledWith("owner-1", "canvas-1");
    expect(createCanvasRun).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: "owner-1",
      idempotencyKey: "create-1",
      plan: expect.objectContaining({ ownerId: "owner-1", canvasRevision: 8, steps: [expect.objectContaining({ nodeId: "image-1" })] }),
      budgetSnapshot: expect.objectContaining({ maxTaskCount: 50 }),
    }));
  });

  it("refuses file-backed or disabled runtime creation", async () => {
    const repository = { readOwnedCanvasSnapshot: vi.fn(), createCanvasRun: vi.fn(), readOwnedRun: vi.fn(), applyCommand: vi.fn() } as any;
    const disabled = createCanvasRunService({ repository, isEnabled: () => false, usePostgresRepository: () => true });
    await expect(disabled.createRun({ ownerId: "o", canvasId: "c", idempotencyKey: "i" })).rejects.toThrow("CANVAS_RUN_DISABLED");

    const fileBacked = createCanvasRunService({ repository, isEnabled: () => true, usePostgresRepository: () => false });
    await expect(fileBacked.createRun({ ownerId: "o", canvasId: "c", idempotencyKey: "i" })).rejects.toThrow("CANVAS_RUN_POSTGRES_REQUIRED");
  });

  it("normalizes bounded runtime budgets without floating point money conversion", () => {
    expect(normalizeCanvasRunBudget({ maxTaskCount: 9999, maxAttemptsPerStep: -2, maxDurationSeconds: 90, maxCost: "12.345678", currency: "USD" })).toEqual({
      maxTaskCount: 1000,
      maxAttemptsPerStep: 0,
      maxDurationSeconds: 90,
      maxCost: "12.345678",
      currency: "USD",
    });
  });

  it("allowlists run configuration and applies automatic quality selection to media steps", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-quality", ...input } }));
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({ id: "canvas-1", ownerId: "owner-1", revision: 9, data: { nodes: [{ id: "image-1", type: "image", position: { x: 0, y: 0 } }], edges: [] } })),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });
    await service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", idempotencyKey: "quality-1", configuration: { qualityEvaluationEnabled: true, selectionPolicy: "best", apiKey: "must-not-persist" } });

    const request = createCanvasRun.mock.calls[0][0];
    expect(request.configurationSnapshot).not.toHaveProperty("apiKey");
    expect(request.plan.steps[0].configuration).toMatchObject({ qualityEvaluationEnabled: true, selectionPolicy: "best" });
    expect(normalizeCanvasRunConfiguration({ selectionPolicy: "invalid", selectionMaximum: 99 })).toMatchObject({ selectionPolicy: "best", selectionMaximum: 16 });
  });

  it("rejects start before spending when the immutable plan still contains browser-only nodes", async () => {
    const repository = {
      readOwnedRun: vi.fn(async () => ({
        id: "run-1",
        planSnapshot: { steps: [{ nodeType: "resize", skipped: false, configuration: { serverRuntime: "legacy_browser" } }] },
      })),
      applyCommand: vi.fn(),
    } as any;
    const service = createCanvasRunService({ repository, isEnabled: () => true, usePostgresRepository: () => true });

    await expect(service.commandRun({ ownerId: "owner-1", runId: "run-1", command: "start", idempotencyKey: "start-1" })).rejects.toThrow("CANVAS_RUN_LEGACY_NODE_UNSUPPORTED:resize");
    expect(repository.applyCommand).not.toHaveBeenCalled();
  });

  it("rechecks start authorization after native capability validation", async () => {
    const assertStartablePlan = vi.fn();
    const repository = {
      readOwnedRun: vi.fn(async () => ({ id: "run-1", planSnapshot: { steps: [{ nodeType: "runninghub", skipped: false, configuration: { serverRuntime: "native_server" } }] } })),
      readOwnedCanvasSnapshot: vi.fn(), createCanvasRun: vi.fn(), applyCommand: vi.fn(async () => ({ id: "run-1" })),
    } as any;
    const service = createCanvasRunService({ repository, isEnabled: () => true, usePostgresRepository: () => true, assertStartablePlan });

    await service.commandRun({ ownerId: "owner-1", runId: "run-1", command: "start", idempotencyKey: "start-1" });

    expect(assertStartablePlan).toHaveBeenCalledWith({ ownerId: "owner-1", run: expect.objectContaining({ id: "run-1" }) });
    expect(repository.applyCommand).toHaveBeenCalled();
  });
});
