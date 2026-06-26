import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const sharedRouteSource = await readFile(new URL("../apps/api/src/shared-resource-routes.ts", import.meta.url), "utf8");
const webApiSource = await readFile(new URL("../apps/web/src/services/api.ts", import.meta.url), "utf8");
const sharedWebApiSource = await readFile(new URL("../apps/web/src/services/sharedResourceApi.ts", import.meta.url), "utf8");

assert.match(serverSource, /createSharedResourceRouteHandler/, "server should wire shared resource route handler");
assert.match(serverSource, /handleSharedResourceRoutes/, "server should invoke shared resource route handler");
assert.match(sharedRouteSource, /\/api\/shared-resources\/items/, "shared route module should expose item routes");
assert.match(sharedRouteSource, /\/api\/shared-resources\/categories/, "shared route module should expose category routes");
assert.match(sharedRouteSource, /currentUser\.role !== "admin"|ADMIN_REQUIRED/, "shared resource writes must require admin");
assert.match(
  sharedRouteSource,
  /copySharedResourceToPersonal|cloneSharedResourceToPersonal/,
  "server should expose copy-to-personal workflow",
);

assert.match(sharedWebApiSource, /getSharedResourceItems/, "web api should expose shared resource listing");
assert.match(sharedWebApiSource, /getSharedResourceCategories/, "web api should expose shared resource category listing");
assert.match(
  sharedWebApiSource,
  /addSharedResourceItem|addSharedResourceSet|addSharedResourcePose|addSharedResourceWorkflow/,
  "web api should expose shared resource upload entries",
);
assert.match(
  sharedWebApiSource,
  /copySharedResourceToPersonal/,
  "web api should expose copy-to-personal entry",
);

console.log("PASS shared resource library contract");
