import { describe, expect, it, vi } from "vitest";

import { compileWorkflowInputSnapshot, createCanvasRunService, normalizeCanvasRunBudget, normalizeCanvasRunConfiguration } from "./canvas-run-service.js";

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

  it("freezes server-resolved model records before repository creation", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-1", ...input } }));
    const resolvePlanModelReferences = vi.fn(async ({ plan }: any) => ({
      ...plan,
      steps: plan.steps.map((step: any) => ({
        ...step,
        configuration: { ...step.configuration, providerId: "provider-1", modelRecordId: "model-record-1" },
      })),
    }));
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 8,
        data: { nodes: [{ id: "image-1", type: "image", data: { model: "gpt-image-2" } }], edges: [] },
      })),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({
      repository: repository as any,
      isEnabled: () => true,
      usePostgresRepository: () => true,
      resolvePlanModelReferences,
    });

    await service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", idempotencyKey: "model-preflight" });

    expect(resolvePlanModelReferences).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1" }));
    expect(createCanvasRun.mock.calls[0][0].plan.steps[0].configuration).toMatchObject({
      modelId: "gpt-image-2",
      providerId: "provider-1",
      modelRecordId: "model-record-1",
    });
  });

  it("refuses file-backed or disabled runtime creation", async () => {
    const repository = { readOwnedCanvasSnapshot: vi.fn(), createCanvasRun: vi.fn(), readOwnedRun: vi.fn(), applyCommand: vi.fn() } as any;
    const disabled = createCanvasRunService({ repository, isEnabled: () => false, usePostgresRepository: () => true });
    await expect(disabled.createRun({ ownerId: "o", canvasId: "c", idempotencyKey: "i" })).rejects.toThrow("CANVAS_RUN_DISABLED");

    const fileBacked = createCanvasRunService({ repository, isEnabled: () => true, usePostgresRepository: () => false });
    await expect(fileBacked.createRun({ ownerId: "o", canvasId: "c", idempotencyKey: "i" })).rejects.toThrow("CANVAS_RUN_POSTGRES_REQUIRED");
  });

  it("freezes a validated workflow input snapshot when workflow scope is requested", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-workflow", ...input } }));
    const workflow = {
      schemaVersion: 1,
      id: "workflow-1",
      name: "海报工作流",
      revision: 4,
      memberNodeIds: ["workflow-input-1", "text-1", "workflow-variables-1"],
      variables: [{ id: "var-theme", key: "主题", label: "主题", type: "text", required: true, constraints: {}, allowAiFill: false, allowAiRewrite: true, version: 1 }],
      inputValues: { "var-theme": "海边" },
      bindings: [{ nodeId: "text-1", fieldPath: "prompt", fieldType: "text", binding: { mode: "template", segments: [{ kind: "text", value: "主题：" }, { kind: "variable", variableId: "var-theme", key: "主题" }] } }],
    };
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 8,
        data: {
          nodes: [
            { id: "workflow-input-1", type: "workflow-input", data: { portType: "text", variableId: "var-theme" } },
            { id: "text-1", type: "text", data: { prompt: "主题：##主题##" } },
            { id: "workflow-variables-1", type: "workflow-variables", data: {} },
          ],
          edges: [{ source: "workflow-input-1", target: "text-1" }],
          workflows: [workflow],
        },
      })),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    await service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", idempotencyKey: "workflow-1" });

    expect(createCanvasRun).toHaveBeenCalledWith(expect.objectContaining({
      runScope: "workflow",
      plan: expect.objectContaining({
        workflowId: "workflow-1",
        workflowRevision: 4,
        workflowSubgraphHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        steps: [
          expect.objectContaining({
            nodeId: "workflow-input-1",
            configuration: expect.objectContaining({ executionPayload: expect.objectContaining({ text: "海边", workflowVariableId: "var-theme" }) }),
          }),
          expect.objectContaining({ nodeId: "text-1", dependsOn: ["workflow-input-1"] }),
        ],
      }),
      inputSnapshot: {
        schemaVersion: 1,
        workflowId: "workflow-1",
        workflowRevision: 4,
        variables: [{ id: "var-theme", key: "主题", type: "text", value: "海边", source: "provided" }],
      },
    }));
    expect(Object.isFrozen(createCanvasRun.mock.calls[0][0].inputSnapshot)).toBe(true);
  });

  it("rejects ordinary edges crossing into a workflow before repository creation", async () => {
    const createCanvasRun = vi.fn();
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 2,
        data: {
          nodes: [{ id: "outside", type: "text", data: {} }, { id: "inside", type: "text", data: {} }],
          edges: [{ source: "outside", target: "inside" }],
          workflows: [{ schemaVersion: 1, id: "workflow-1", name: "Workflow", revision: 1, memberNodeIds: ["inside"], variables: [], inputValues: {}, bindings: [], region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" } }],
        },
      })),
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    await expect(service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", idempotencyKey: "crossing" }))
      .rejects.toThrow("WORKFLOW_BOUNDARY_EDGE_INVALID:outside->inside");
    expect(createCanvasRun).not.toHaveBeenCalled();
  });

  it("resolves media workflow inputs through the owner-scoped asset repository", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-media", ...input } }));
    const readOwnedWorkflowInputAssets = vi.fn(async () => [{ id: "asset-1", kind: "image", url: "/files/assets/asset-1.png" }]);
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 3,
        data: {
          nodes: [{ id: "input-1", type: "workflow-input", data: { portType: "image", variableId: "var-image" } }],
          edges: [],
          workflows: [{
            schemaVersion: 1,
            id: "workflow-1",
            name: "Media",
            revision: 2,
            memberNodeIds: ["input-1"],
            variables: [{ id: "var-image", key: "参考图", label: "参考图", type: "image", required: true, constraints: {}, allowAiFill: false, allowAiRewrite: false, version: 1 }],
            inputValues: { "var-image": { kind: "image", assetId: "asset-1" } },
            bindings: [],
            region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
          }],
        },
      })),
      readOwnedWorkflowInputAssets,
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    await service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", idempotencyKey: "media" });

    expect(readOwnedWorkflowInputAssets).toHaveBeenCalledWith("owner-1", ["asset-1"]);
    expect(createCanvasRun.mock.calls[0][0].plan.steps[0].configuration.executionPayload).toMatchObject({
      workflowVariableId: "var-image",
      workflowAssetId: "asset-1",
      imageUrl: "/files/assets/asset-1.png",
      imageUrls: ["/files/assets/asset-1.png"],
    });
  });

  it("rejects stale workflow bindings and missing required input before creating a run", async () => {
    const createCanvasRun = vi.fn();
    const data = {
      nodes: [{ id: "text-1", type: "text", data: { prompt: "##未闭合" } }],
      edges: [],
      workflows: [{
        schemaVersion: 1,
        id: "workflow-1",
        name: "工作流",
        revision: 1,
        memberNodeIds: ["text-1"],
        variables: [{ id: "var-theme", key: "主题", label: "主题", type: "text", required: true, constraints: {}, allowAiFill: false, allowAiRewrite: true, version: 1 }],
        inputValues: {},
        bindings: [{ nodeId: "text-1", fieldPath: "prompt", fieldType: "text", binding: { mode: "variable", variableId: "var-theme" } }],
      }],
    };
    const repository = { readOwnedCanvasSnapshot: vi.fn(async () => ({ id: "canvas-1", ownerId: "owner-1", revision: 1, data })), createCanvasRun, readOwnedRun: vi.fn(), applyCommand: vi.fn() };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    await expect(service.createRun({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1", idempotencyKey: "workflow-invalid" })).rejects.toThrow("WORKFLOW_VARIABLE_TOKEN_UNCLOSED");
    expect(createCanvasRun).not.toHaveBeenCalled();
  });

  it("rejects workflow input overrides when no workflow target is supplied", () => {
    expect(() => compileWorkflowInputSnapshot({ data: {}, values: { theme: "海边" } }))
      .toThrow("WORKFLOW_ID_REQUIRED");
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

  it("freezes four-layer supervision settings without persisting apply-once overrides", async () => {
    const createCanvasRun = vi.fn(async (input: any) => ({ created: true, run: { id: "run-settings", ...input } }));
    const writeOwnedWorkflowSupervisionSettings = vi.fn();
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 5,
        data: {
          nodes: [{ id: "image-1", type: "image", data: { agentQualityEvaluation: true } }],
          edges: [],
          workflows: [{
            schemaVersion: 1,
            id: "workflow-1",
            name: "Poster",
            revision: 3,
            memberNodeIds: ["image-1"],
            variables: [],
            inputValues: {},
            bindings: [],
            stages: [],
            supervisionDefaults: { defaultRetryCount: 2, stageConcurrency: 2 },
            region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
          }],
        },
      })),
      readOwnedWorkflowSupervisionSettings: vi.fn(async () => ({
        settings: { defaultRetryCount: 4, candidateSelectionMode: "ai", candidateSelectionCount: 3 },
        revision: 2,
        updatedAt: 10,
      })),
      writeOwnedWorkflowSupervisionSettings,
      createCanvasRun,
      readOwnedRun: vi.fn(),
      applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({
      repository: repository as any,
      isEnabled: () => true,
      usePostgresRepository: () => true,
      readSupervisionLimits: async () => ({ maxRetryCount: 5 }),
    });

    await service.createRun({
      ownerId: "owner-1",
      canvasId: "canvas-1",
      workflowId: "workflow-1",
      idempotencyKey: "settings-once",
      supervisionSettings: { defaultRetryCount: 8, candidateMinimumConfidence: 76 },
    });

    const request = createCanvasRun.mock.calls[0][0];
    expect(request.budgetSnapshot).toMatchObject({ maxAttemptsPerStep: 5 });
    expect(request.configurationSnapshot).toMatchObject({
      qualityEvaluationEnabled: true,
      selectionPolicy: "top_k",
      selectionMaximum: 3,
      selectionMinimumScore: 76,
      supervision: {
        schemaVersion: 1,
        settings: expect.objectContaining({ defaultRetryCount: 5, stageConcurrency: 2 }),
        sources: expect.objectContaining({
          defaultRetryCount: "run_override",
          stageConcurrency: "workflow_default",
          candidateSelectionMode: "remembered",
        }),
        overriddenFields: expect.arrayContaining(["defaultRetryCount", "candidateMinimumConfidence"]),
        clampedFields: expect.arrayContaining(["defaultRetryCount"]),
      },
    });
    expect(request.plan.steps[0].configuration).toMatchObject({ qualityEvaluationEnabled: false });
    expect(writeOwnedWorkflowSupervisionSettings).not.toHaveBeenCalled();
  });

  it("saves allowlisted remembered settings and restores workflow defaults", async () => {
    let remembered: any = null;
    const repository = {
      readOwnedCanvasSnapshot: vi.fn(async () => ({
        id: "canvas-1",
        ownerId: "owner-1",
        revision: 5,
        data: {
          nodes: [{ id: "image-1", type: "image", data: {} }],
          edges: [],
          workflows: [{
            schemaVersion: 1, id: "workflow-1", name: "Poster", revision: 3,
            memberNodeIds: ["image-1"], variables: [], inputValues: {}, bindings: [], stages: [],
            supervisionDefaults: { defaultRetryCount: 2 },
            region: { x: 0, y: 0, width: 640, height: 420, color: "#2F6B5F" },
          }],
        },
      })),
      readOwnedWorkflowSupervisionSettings: vi.fn(async () => remembered),
      writeOwnedWorkflowSupervisionSettings: vi.fn(async (input) => {
        remembered = { settings: input.settings, revision: 1, updatedAt: 100 };
        return remembered;
      }),
      deleteOwnedWorkflowSupervisionSettings: vi.fn(async () => {
        remembered = null;
        return true;
      }),
      createCanvasRun: vi.fn(), readOwnedRun: vi.fn(), applyCommand: vi.fn(),
    };
    const service = createCanvasRunService({ repository: repository as any, isEnabled: () => true, usePostgresRepository: () => true });

    const saved = await service.saveWorkflowSettings({
      ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1",
      settings: { defaultRetryCount: 5, candidateSelectionMode: "ai", apiKey: "drop" } as any,
    });
    expect(saved).toMatchObject({ hasRemembered: true, settings: { defaultRetryCount: 5, candidateSelectionMode: "ai" } });
    expect(repository.writeOwnedWorkflowSupervisionSettings.mock.calls[0][0].settings).not.toHaveProperty("apiKey");

    const restored = await service.resetWorkflowSettings({ ownerId: "owner-1", canvasId: "canvas-1", workflowId: "workflow-1" });
    expect(restored).toMatchObject({ hasRemembered: false, settings: { defaultRetryCount: 2 } });
  });
});
