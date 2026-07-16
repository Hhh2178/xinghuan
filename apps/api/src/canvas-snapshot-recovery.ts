export interface CanvasSnapshotRecoveryCandidate {
  id: string;
  nodes: unknown[];
  edges: unknown[];
  revision: number;
  modifiedAt: number;
  viewport?: unknown;
  nextNodeSerialId?: number;
}

export function planCanvasSnapshotRecovery(input: {
  databaseIds: Iterable<string>;
  snapshots: CanvasSnapshotRecoveryCandidate[];
}): CanvasSnapshotRecoveryCandidate[] {
  const existing = new Set(input.databaseIds);
  return input.snapshots.filter((snapshot) => snapshot.id && !existing.has(snapshot.id));
}

export function findCanvasSnapshotOwnershipConflicts(input: {
  ownerId: string;
  snapshotIds: Iterable<string>;
  existingOwners: Iterable<{ id: string; ownerId: string }>;
}): string[] {
  const snapshotIds = new Set(input.snapshotIds);
  return [...input.existingOwners]
    .filter((item) => snapshotIds.has(item.id) && item.ownerId !== input.ownerId)
    .map((item) => item.id)
    .sort();
}
