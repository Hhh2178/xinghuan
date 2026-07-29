import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

const internalSnapshotRouteSource = serverSource.slice(
  serverSource.indexOf('if (url.pathname === "/api/internal/environment-sync/snapshot"'),
  serverSource.indexOf('if (url.pathname === "/api/internal/environment-sync/apply"'),
);
const internalApplyRouteSource = serverSource.slice(
  serverSource.indexOf('if (url.pathname === "/api/internal/environment-sync/apply"'),
  serverSource.indexOf("if (await handleInternalComfyuiConnectorRoutes"),
);
const adminRoutesSource = serverSource.slice(
  serverSource.indexOf("async function handleAdminRequest("),
  serverSource.indexOf('if (url.pathname === "/api/admin/summary"'),
);
const internalGuardSource = serverSource.slice(
  serverSource.indexOf("function assertInternalEnvironmentSyncRequest("),
  serverSource.indexOf("async function readEnvironmentSyncLocalSnapshot("),
);
const remoteSnapshotSource = serverSource.slice(
  serverSource.indexOf("async function readEnvironmentSyncRemoteSnapshot("),
  serverSource.indexOf("async function applyEnvironmentSyncRemoteSnapshot("),
);
const remoteApplySource = serverSource.slice(
  serverSource.indexOf("async function applyEnvironmentSyncRemoteSnapshot("),
  serverSource.indexOf("function joinEnvironmentSyncUrl("),
);

assert.match(internalSnapshotRouteSource, /assertInternalEnvironmentSyncRequest\(request\)/, "internal snapshot route should require the shared-token guard");
assert.match(internalApplyRouteSource, /assertInternalEnvironmentSyncRequest\(request\)/, "internal apply route should require the shared-token guard");
assert.match(internalGuardSource, /x-environment-sync-token/, "internal sync guard should read the environment-sync token header");
assert.match(internalGuardSource, /ENVIRONMENT_SYNC_FORBIDDEN/, "invalid internal sync tokens should be forbidden");
assert.match(remoteSnapshotSource, /"x-environment-sync-token": environmentSyncToken/, "remote snapshot requests should carry the shared token");
assert.match(remoteApplySource, /"x-environment-sync-token": environmentSyncToken/, "remote apply requests should carry the shared token");
assert.match(adminRoutesSource, /\/api\/admin\/environment-sync\/preview/, "preview should remain inside the authenticated admin handler");
assert.match(adminRoutesSource, /\/api\/admin\/environment-sync\/apply/, "apply should remain inside the authenticated admin handler");
assert.match(adminRoutesSource, /actorEmail:\s*adminUser\.email/, "environment sync apply should preserve the authenticated admin actor");
assert.match(adminRoutesSource, /"environment_sync\.apply"/, "environment sync apply should remain audited");

console.log(JSON.stringify({ ok: true }, null, 2));
