import { describe, expect, it, vi } from "vitest";

import { handleGenerationArtifactRoutes } from "./generation-artifact-routes.js";

describe("generation artifact routes", () => {
  it("returns the server-authoritative output retention window", async () => {
    const sendT8 = vi.fn();
    const readOutputRetentionDays = vi.fn(async () => 15);
    const handled = await handleGenerationArtifactRoutes({
      request: { method: "GET" } as any,
      response: {} as any,
      url: new URL("http://localhost/api/generation-library/settings"),
      ownerId: "owner-a",
      lifecycle: {} as any,
      materialAccessService: {} as any,
      readJsonBody: vi.fn() as any,
      readOutputRetentionDays,
      sendT8,
      toHttpError: (error) => error,
    });

    expect(handled).toBe(true);
    expect(readOutputRetentionDays).toHaveBeenCalledOnce();
    expect(sendT8).toHaveBeenCalledWith(expect.anything(), { outputRetentionDays: 15 });
  });
});
