import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createQualityRecoveryRouteHandler } from "./quality-recovery-routes.js";

function request(body: unknown) {
  const stream = Readable.from([JSON.stringify(body)]) as any;
  stream.method = "POST";
  stream.headers = {};
  return stream;
}

describe("quality and recovery routes", () => {
  it("forces evaluation ownership and run coordinates from the authenticated route", async () => {
    const evaluate = vi.fn(async () => ({ evaluationId: "eval-1" }));
    const sendT8 = vi.fn();
    const handler = createQualityRecoveryRouteHandler({ sendT8, evaluate, select: vi.fn(), recover: vi.fn(), publicOrigin: () => "https://canvas.test", invalidRequest: (message) => new Error(message) });
    await handler({ request: request({ artifactId: "artifact-1", idempotencyKey: "eval-key", ownerId: "attacker" }), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1/steps/step-2/evaluations"), currentUser: { id: "owner-1" } });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1", canvasRunId: "run-1", runStepId: "step-2", artifactId: "artifact-1" }), { id: "owner-1" }, "https://canvas.test");
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { evaluationId: "eval-1" }, 201);
  });

  it("routes selection and recovery as explicit writes", async () => {
    const select = vi.fn(async () => ({ selectionId: "selection-1" }));
    const recover = vi.fn(async () => ({ decisionId: "recovery-1" }));
    const handler = createQualityRecoveryRouteHandler({ sendT8: vi.fn(), evaluate: vi.fn(), select, recover, publicOrigin: () => "", invalidRequest: (message) => new Error(message) });
    await handler({ request: request({ idempotencyKey: "select-1", candidates: [{ artifactId: "a" }] }), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1/steps/step-2/selections"), currentUser: { id: "owner-1" } });
    await handler({ request: request({ idempotencyKey: "recover-1", error: { statusCode: 503 } }), response: {} as any, url: new URL("http://localhost/api/canvas-runs/run-1/steps/step-2/recovery-decisions"), currentUser: { id: "owner-1" } });
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1" }));
    expect(recover).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-1" }));
  });
});
