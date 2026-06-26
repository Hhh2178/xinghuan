import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverSource = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const sharedRouteSource = await readFile(new URL("../apps/api/src/shared-resource-routes.ts", import.meta.url), "utf8");
const webApiSource = await readFile(new URL("../apps/web/src/services/api.ts", import.meta.url), "utf8");
const sharedWebApiSource = await readFile(new URL("../apps/web/src/services/sharedResourceApi.ts", import.meta.url), "utf8");
const resourceDrawerSource = await readFile(new URL("../apps/web/src/components/ResourceLibraryDrawer.tsx", import.meta.url), "utf8");
const adminViewModelSource = await readFile(new URL("../apps/admin/src/admin-view-model.ts", import.meta.url), "utf8");
const adminMainSource = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
const adminPanelSource = await readFile(new URL("../apps/admin/src/admin-public-resources-panel.tsx", import.meta.url), "utf8");

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
assert.match(sharedWebApiSource, /uploadSharedResourceFile/, "web api should expose local file upload for shared resources");
assert.doesNotMatch(resourceDrawerSource, /window\.prompt\(['"]输入公共资源 URL['"]\)/, "shared upload must not ask admins to paste a URL");
assert.match(resourceDrawerSource, /type="file"/, "resource drawer should use a file input for public uploads");
assert.match(
  sharedWebApiSource,
  /copySharedResourceToPersonal/,
  "web api should expose copy-to-personal entry",
);
assert.match(adminViewModelSource, /public-resources/, "admin navigation should include public resources");
assert.match(adminMainSource, /AdminPublicResourcesPanel/, "admin app should render the public resources panel");
assert.match(adminPanelSource, /adminSharedResourceApi/, "admin public resources panel should use shared resource api");
assert.match(adminPanelSource, /uploadFile/, "admin public resources panel should support local file uploads");

console.log("PASS shared resource library contract");
