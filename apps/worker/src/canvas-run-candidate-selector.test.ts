import { describe, expect, it, vi } from "vitest";

import {
  createSmartCandidateRuntimeContext,
  initializeSmartCandidateSelector,
  resolveSmartCandidateQualityGate,
} from "./canvas-run-candidate-selector.js";

describe("canvas run smart candidate selector", () => {
  it("transfers unavailable AI evaluation to manual selection unless policy requires stop", () => {
    expect(resolveSmartCandidateQualityGate({ mode: "ai", lowConfidencePolicy: "request_manual" }, false)).toBe("manual");
    expect(resolveSmartCandidateQualityGate({ mode: "ai", lowConfidencePolicy: "stop" }, false)).toBe("stop");
    expect(resolveSmartCandidateQualityGate({ mode: "ai", lowConfidencePolicy: "request_manual" }, true)).toBe("evaluate");
  });

  it("freezes provenance, criteria and the remembered supervision mode", () => {
    const result = createSmartCandidateRuntimeContext({
      selectorStep: {
        nodeId: "selector-1",
        dependsOn: ["criteria-1", "image-a", "image-b"],
      },
      planSnapshot: {
        steps: [
          { nodeId: "criteria-1", nodeType: "text", configuration: { executionPayload: { text: "Prefer a wide composition." } } },
          { nodeId: "image-a", nodeType: "image", configuration: { executionPayload: { prompt: "city at night" } } },
          { nodeId: "image-b", nodeType: "image", configuration: { executionPayload: { prompt: "city at sunrise" } } },
          { nodeId: "selector-1", nodeType: "smart-candidate-selector", configuration: { smartCandidateSelector: {
            mediaKind: "image",
            mode: "manual",
            maximum: 1,
            minimumConfidence: 0.7,
            lowConfidencePolicy: "request_manual",
            note: "Keep the whole building.",
          } } },
        ],
      },
      inputSnapshot: { variables: [{ id: "city", value: "Shanghai" }] },
      configurationSnapshot: {
        candidateSelectionMode: "ai",
        selectionMaximum: 2,
        candidateMinimumConfidence: 85,
        lowConfidenceManualFallback: true,
      },
      upstreamSteps: [
        { id: "step-criteria", nodeId: "criteria-1", status: "succeeded", outputBinding: { text: "Prefer a wide composition." } },
        { id: "step-a", nodeId: "image-a", status: "succeeded", outputBinding: { generationArtifactIds: ["artifact-a"] } },
        { id: "step-b", nodeId: "image-b", status: "succeeded", outputBinding: { generationArtifactIds: ["artifact-b"] } },
      ],
      artifacts: [
        { id: "artifact-a", kind: "image", fileUrl: "/files/output/a.png", sourceNodeId: "image-a", providerId: "provider-a", modelId: "model-a", metadata: {}, createdAt: 1 },
        { id: "artifact-b", kind: "image", fileUrl: "/files/output/b.png", sourceNodeId: "image-b", providerId: "provider-b", modelId: "model-b", metadata: {}, createdAt: 2 },
      ],
    });

    expect(result).toMatchObject({
      mode: "ai",
      mediaKind: "image",
      maximum: 2,
      minimumConfidence: 0.85,
      lowConfidencePolicy: "request_manual",
      criteria: "Prefer a wide composition.",
      note: "Keep the whole building.",
      candidates: [
        { artifactId: "artifact-a", sourceNodeId: "image-a", prompt: "city at night", providerId: "provider-a", modelRecordId: "model-a" },
        { artifactId: "artifact-b", sourceNodeId: "image-b", prompt: "city at sunrise", providerId: "provider-b", modelRecordId: "model-b" },
      ],
    });
    expect(result.candidates[0].variableSnapshot).toEqual({ city: "Shanghai" });
  });

  it("atomically parks a manual selector and records its candidate ledger", async () => {
    const state = { stepStatus: "ready", candidateRows: 0 };
    const appendEvent = vi.fn(async () => undefined);
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "begin" || sql === "commit" || sql === "rollback") return { rows: [] };
      if (sql.includes("s.node_type = 'smart-candidate-selector'") && sql.includes("for update")) {
        return state.stepStatus === "ready" ? { rows: [{
          id: "step-selector",
          run_id: "run-1",
          owner_id: "owner-1",
          node_id: "selector-1",
          status: "ready",
          depends_on: ["image-a", "image-b"],
          plan_snapshot: { steps: [
            { nodeId: "image-a", configuration: { executionPayload: { prompt: "A" } } },
            { nodeId: "image-b", configuration: { executionPayload: { prompt: "B" } } },
            { nodeId: "selector-1", configuration: { smartCandidateSelector: { mediaKind: "image", mode: "manual", maximum: 1, minimumConfidence: 0.7, lowConfidencePolicy: "request_manual", note: "" } } },
          ] },
          input_snapshot: { variables: [] },
          configuration_snapshot: { candidateSelectionMode: "manual" },
        }] } : { rows: [] };
      }
      if (sql.includes("from xh_canvas_run_steps d") && sql.includes("d.node_id = any")) return { rows: [
        { id: "step-a", node_id: "image-a", status: "succeeded", output_binding: { generationArtifactIds: ["artifact-a"] } },
        { id: "step-b", node_id: "image-b", status: "succeeded", output_binding: { generationArtifactIds: ["artifact-b"] } },
      ] };
      if (sql.includes("from xh_generation_artifacts")) return { rows: [
        { id: "artifact-a", kind: "image", file_url: "/files/output/a.png", source_node_id: "image-a", provider_id: "provider-a", model_id: "model-a", metadata: {}, created_at: new Date(1) },
        { id: "artifact-b", kind: "image", file_url: "/files/output/b.png", source_node_id: "image-b", provider_id: "provider-b", model_id: "model-b", metadata: {}, created_at: new Date(2) },
      ] };
      if (sql.includes("insert into xh_canvas_run_candidate_artifacts")) {
        state.candidateRows += 1;
        return { rows: [] };
      }
      if (sql.includes("set status = $2") && sql.includes("candidate_context")) {
        state.stepStatus = String(params?.[1]);
        return { rows: [] };
      }
      if (sql.includes("update xh_canvas_runs set status = 'running'")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const pool = { connect: vi.fn(async () => ({ query, release: vi.fn() })) } as any;

    await initializeSmartCandidateSelector({ pool, environment: "test", appendEvent });

    expect(state).toEqual({ stepStatus: "selecting", candidateRows: 2 });
    expect(appendEvent).toHaveBeenCalledWith(expect.anything(), "run-1", "step-selector", "canvas_run.candidate_selection_waiting", expect.objectContaining({ candidateCount: 2 }));
  });

  it("fails only the current run when the candidate set is invalid", async () => {
    const updates: string[] = [];
    const appendEvent = vi.fn(async () => undefined);
    const query = vi.fn(async (sql: string) => {
      if (["begin", "commit", "rollback"].includes(sql)) return { rows: [] };
      if (sql.includes("s.node_type = 'smart-candidate-selector'") && sql.includes("for update")) {
        return { rows: [{
          id: "step-selector",
          run_id: "run-1",
          owner_id: "owner-1",
          node_id: "selector-1",
          depends_on: ["image-a"],
          plan_snapshot: { steps: [
            { nodeId: "image-a", configuration: { executionPayload: { prompt: "A" } } },
            { nodeId: "selector-1", configuration: { smartCandidateSelector: { mediaKind: "image", mode: "ai", maximum: 1 } } },
          ] },
          input_snapshot: { variables: [] },
          configuration_snapshot: { candidateSelectionMode: "ai" },
        }] };
      }
      if (sql.includes("from xh_canvas_run_steps d")) return { rows: [
        { id: "step-a", node_id: "image-a", status: "succeeded", output_binding: { generationArtifactIds: ["artifact-a"] } },
      ] };
      if (sql.includes("from xh_generation_artifacts")) return { rows: [
        { id: "artifact-a", kind: "image", file_url: "/a.png", source_node_id: "image-a", provider_id: "provider-a", model_id: "model-a", metadata: {}, created_at: new Date(1) },
      ] };
      if (sql.includes("update xh_canvas_run_steps") || sql.includes("update xh_canvas_runs")) {
        updates.push(sql);
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const release = vi.fn();
    const pool = { connect: vi.fn(async () => ({ query, release })) } as any;

    await expect(initializeSmartCandidateSelector({ pool, environment: "test", appendEvent })).resolves.toBe(true);

    expect(updates).toHaveLength(2);
    expect(appendEvent).toHaveBeenCalledWith(expect.anything(), "run-1", "step-selector", "canvas_run.step_failed", expect.objectContaining({ code: "SMART_CANDIDATE_COUNT_INSUFFICIENT" }));
    expect(appendEvent).toHaveBeenCalledWith(expect.anything(), "run-1", null, "canvas_run.failed", expect.objectContaining({ code: "SMART_CANDIDATE_COUNT_INSUFFICIENT" }));
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects candidates that do not match the selector media mode", () => {
    expect(() => createSmartCandidateRuntimeContext({
      selectorStep: { nodeId: "selector-1", dependsOn: ["image-a", "image-b"] },
      planSnapshot: { steps: [
        { nodeId: "image-a", configuration: { executionPayload: { prompt: "A" } } },
        { nodeId: "image-b", configuration: { executionPayload: { prompt: "B" } } },
        { nodeId: "selector-1", configuration: { smartCandidateSelector: { mediaKind: "video" } } },
      ] },
      inputSnapshot: { variables: [] },
      configurationSnapshot: {},
      upstreamSteps: [
        { id: "step-a", nodeId: "image-a", status: "succeeded", outputBinding: { generationArtifactIds: ["artifact-a"] } },
        { id: "step-b", nodeId: "image-b", status: "succeeded", outputBinding: { generationArtifactIds: ["artifact-b"] } },
      ],
      artifacts: [
        { id: "artifact-a", kind: "image", fileUrl: "/a.png", sourceNodeId: "image-a", providerId: "provider-a", modelId: "model-a", metadata: {}, createdAt: 1 },
        { id: "artifact-b", kind: "image", fileUrl: "/b.png", sourceNodeId: "image-b", providerId: "provider-b", modelId: "model-b", metadata: {}, createdAt: 2 },
      ],
    })).toThrow("SMART_CANDIDATE_SELECTOR_MEDIA_KIND_MISMATCH");
  });
});
