import { describe, expect, it } from "vitest";

import {
  findCanvasSnapshotOwnershipConflicts,
  planCanvasSnapshotRecovery,
} from "./canvas-snapshot-recovery.js";

describe("planCanvasSnapshotRecovery", () => {
  it("recovers only file snapshots missing from a partially migrated database", () => {
    const result = planCanvasSnapshotRecovery({
      databaseIds: ["canvas-a"],
      snapshots: [
        { id: "canvas-a", nodes: [], edges: [], revision: 2, modifiedAt: 100 },
        { id: "canvas-b", nodes: [{ id: "node-b" }], edges: [], revision: 7, modifiedAt: 200 },
      ],
    });
    expect(result).toEqual([{ id: "canvas-b", nodes: [{ id: "node-b" }], edges: [], revision: 7, modifiedAt: 200 }]);
  });

  it("is idempotent after recovered ids exist in the database", () => {
    expect(planCanvasSnapshotRecovery({
      databaseIds: ["canvas-a", "canvas-b"],
      snapshots: [{ id: "canvas-b", nodes: [], edges: [], revision: 1, modifiedAt: 200 }],
    })).toEqual([]);
  });
});

describe("findCanvasSnapshotOwnershipConflicts", () => {
  it("reports only candidate ids owned by another user", () => {
    expect(findCanvasSnapshotOwnershipConflicts({
      ownerId: "user-a",
      snapshotIds: ["canvas-a", "canvas-b", "canvas-c"],
      existingOwners: [
        { id: "canvas-a", ownerId: "user-a" },
        { id: "canvas-b", ownerId: "user-b" },
        { id: "canvas-outside", ownerId: "user-b" },
      ],
    })).toEqual(["canvas-b"]);
  });
});
