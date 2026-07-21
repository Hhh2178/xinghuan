import { describe, expect, it } from "vitest";

import { buildSystemHealthDomainCards } from "./admin-system-health-view-model.js";
import type { SystemInfo } from "./admin-types.js";

describe("admin system health view model", () => {
  it("prioritizes real health states and keeps unavailable metrics unknown", () => {
    const cards = buildSystemHealthDomainCards({
      environment: "gray",
      service: "xinghuan-api",
      version: "v0.7.5",
      database: { configured: true, status: "connected", migrations: [], error: "", currentDatabase: "gray", expectedDatabase: "prod", targetMatched: false },
      redis: { configured: true, status: "connected", queue: "gray:tasks", depth: 0, queues: [], error: "" },
      storage: { canvases: 1, resources: 2, inputFiles: 3, outputFiles: 4 },
      observability: { tasks: { health: { status: "unknown", summary: "样本不足" } } },
    } as unknown as SystemInfo);

    expect(cards.map((card) => [card.id, card.status])).toEqual([
      ["api", "healthy"],
      ["database", "critical"],
      ["redis", "healthy"],
      ["worker", "unknown"],
      ["storage", "unknown"],
    ]);
  });
});
