import type { PoolClient } from "pg";

export const CANVAS_RUN_DISPATCH_SCOPES = {
  generation: "canvas-run-generation",
  quality: "canvas-run-quality",
} as const;

export async function lockCanvasRunDispatchCursor(client: PoolClient, scope: string) {
  await client.query(
    "insert into xh_canvas_run_dispatch_cursors (scope) values ($1) on conflict (scope) do nothing",
    [scope],
  );
  const result = await client.query<{ last_owner_id: string }>(
    "select last_owner_id from xh_canvas_run_dispatch_cursors where scope = $1 for update",
    [scope],
  );
  return String(result.rows[0]?.last_owner_id || "");
}

export async function advanceCanvasRunDispatchCursor(client: PoolClient, scope: string, ownerId: string) {
  await client.query(
    "update xh_canvas_run_dispatch_cursors set last_owner_id = $2, updated_at = now() where scope = $1",
    [scope, ownerId],
  );
}

export function roundRobinOwnerOrder(ownerIds: string[], lastOwnerId: string) {
  const owners = [...new Set(ownerIds.filter(Boolean))].sort();
  return [...owners.filter((ownerId) => ownerId > lastOwnerId), ...owners.filter((ownerId) => ownerId <= lastOwnerId)];
}
