import { describe, expect, it, vi } from "vitest";
import { createAdminUsageSummaryService } from "./admin-usage-summary-service.js";

function createDeps(overrides: Partial<Parameters<typeof createAdminUsageSummaryService>[0]> = {}) {
  return {
    readAdminUsageSummaryRecords: vi.fn(async () => ({
      tasks: [],
      groupMemberCounts: new Map<string, number>([["ungrouped", 0]]),
    })),
    publicRunningHubCatalog: vi.fn(async () => ({ items: [] })),
    ...overrides,
  } as Parameters<typeof createAdminUsageSummaryService>[0];
}

describe("admin usage summary service", () => {
  it("builds usage summary from repository records only", async () => {
    const readAdminUsageSummaryRecords = vi.fn(async () => ({
      tasks: [{
        id: "task-1",
        status: "succeeded",
        ownerId: "user-1",
        ownerName: "User One",
        ownerEmail: "user@example.test",
        ownerGroupId: "group-1",
        ownerGroupName: "Group One",
        providerId: "provider-1",
        providerName: "Provider One",
        modelId: "image-model",
        modelRecordId: "model-record-1",
        modelDisplayName: "Image Model",
        payload: { taskCapability: "image" },
        result: {},
        createdAt: Date.parse("2026-07-04T00:00:00.000Z"),
      }],
      groupMemberCounts: new Map<string, number>([
        ["group-1", 1],
        ["ungrouped", 0],
      ]),
    }));
    const service = createAdminUsageSummaryService(createDeps({ readAdminUsageSummaryRecords }));
    const query = {
      from: Date.parse("2026-07-01T00:00:00.000Z"),
      to: Date.parse("2026-07-05T00:00:00.000Z"),
    };

    const result = await service.readAdminUsageSummary(query);

    expect(readAdminUsageSummaryRecords).toHaveBeenCalledWith(query);
    expect(result.totals).toMatchObject({ successful: 1, image: 1 });
    expect(result.models[0]).toMatchObject({
      providerId: "provider-1",
      modelRecordId: "model-record-1",
      modelId: "image-model",
      total: 1,
    });
  });
});
