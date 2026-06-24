import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const shared = await readFile(new URL("../packages/shared/src/announcements.ts", import.meta.url), "utf8");
const adminViewModel = await readFile(new URL("../apps/admin/src/admin-view-model.ts", import.meta.url), "utf8");
const adminMain = await readFile(new URL("../apps/admin/src/main.tsx", import.meta.url), "utf8");
const webApp = await readFile(new URL("../apps/web/src/App.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");

assert.match(shared, /AnnouncementPriority/);
assert.match(shared, /AnnouncementStreamEvent/);
assert.match(adminViewModel, /"announcement"/);
assert.match(adminMain, /AdminAnnouncementPanel/);
assert.match(webApp, /AnnouncementCenterDrawer/);
assert.match(server, /\/api\/announcements\/stream/);

console.log("PASS announcement contract");
