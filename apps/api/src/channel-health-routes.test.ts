import { describe, expect, it, vi } from "vitest";

import { createChannelHealthRouteHandlers } from "./channel-health-routes.js";

const report = {
  generatedAt: 1,
  windowStartAt: 0,
  windowEndAt: 2,
  bucketHours: 2 as const,
  bucketCount: 36 as const,
  providers: [],
};

function createResponse() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

describe("channel health routes", () => {
  it("serves member reads and owner-scoped votes", async () => {
    const readReport = vi.fn(async () => report);
    const submitVote = vi.fn(async () => ({ kind: "saved" as const, vote: "up" as const, report }));
    const sendT8 = vi.fn();
    const { handleMemberRoutes } = createChannelHealthRouteHandlers({
      service: { readReport, submitVote },
      sendT8,
      readJsonBody: vi.fn(async () => ({ providerId: "p1", modelId: "m1", vote: "up" })),
      invalidRequest: (code) => new Error(code),
      forbidden: (code) => new Error(code),
      notFound: (code) => new Error(code),
    });

    expect(await handleMemberRoutes({
      request: { method: "GET", headers: {} } as any,
      response: createResponse() as any,
      url: new URL("http://localhost/api/channel-health"),
      currentUser: { id: "user-1", role: "member" },
    })).toBe(true);
    expect(readReport).toHaveBeenCalledWith({ audience: "member", ownerId: "user-1" });

    expect(await handleMemberRoutes({
      request: { method: "POST", headers: {} } as any,
      response: createResponse() as any,
      url: new URL("http://localhost/api/channel-health/feedback"),
      currentUser: { id: "user-1", role: "member" },
    })).toBe(true);
    expect(submitVote).toHaveBeenCalledWith({ ownerId: "user-1", providerId: "p1", modelRecordId: "m1", vote: "up" });
  });

  it("restricts filtered analytics reads to admins", async () => {
    const readReport = vi.fn(async () => report);
    const { handleAdminRoutes } = createChannelHealthRouteHandlers({
      service: { readReport, submitVote: vi.fn() },
      sendT8: vi.fn(),
      readJsonBody: vi.fn(),
      invalidRequest: (code) => new Error(code),
      forbidden: (code) => new Error(code),
      notFound: (code) => new Error(code),
    });

    await handleAdminRoutes({
      request: { method: "GET", headers: {} } as any,
      response: createResponse() as any,
      url: new URL("http://localhost/api/admin/analytics/model-success-rates?capability=image&providerId=p1"),
      currentUser: { id: "admin-1", role: "admin" },
    });

    expect(readReport).toHaveBeenCalledWith({ audience: "admin", ownerId: "admin-1", filters: { capability: "image", providerId: "p1" } });
  });

  it("returns 304 when the ETag matches", async () => {
    const readReport = vi.fn(async () => report);
    const sendT8 = vi.fn();
    const { handleMemberRoutes } = createChannelHealthRouteHandlers({
      service: { readReport, submitVote: vi.fn() },
      sendT8,
      readJsonBody: vi.fn(),
      invalidRequest: (code) => new Error(code),
      forbidden: (code) => new Error(code),
      notFound: (code) => new Error(code),
    });
    const firstResponse = createResponse();
    await handleMemberRoutes({ request: { method: "GET", headers: {} } as any, response: firstResponse as any, url: new URL("http://localhost/api/channel-health"), currentUser: { id: "user-1", role: "member" } });
    const etag = sendT8.mock.calls[0][3].etag;
    const secondResponse = createResponse();

    await handleMemberRoutes({ request: { method: "GET", headers: { "if-none-match": etag } } as any, response: secondResponse as any, url: new URL("http://localhost/api/channel-health"), currentUser: { id: "user-1", role: "member" } });

    expect(secondResponse.writeHead).toHaveBeenCalledWith(304, expect.objectContaining({ etag }));
    expect(secondResponse.end).toHaveBeenCalledWith();
  });
});
