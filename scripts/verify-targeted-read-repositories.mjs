import { readFile } from "node:fs/promises";

const server = await readFile("apps/api/src/server.ts", "utf8");
const taskRoutes = await readFile("apps/api/src/admin-task-list-routes.ts", "utf8");
const providerRoutes = await readFile("apps/api/src/admin-provider-routes.ts", "utf8");
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1; };

const catalogStart = server.indexOf("async function publicRunningHubCatalog");
const catalogEnd = server.indexOf("async function resolveRunningHubProvider", catalogStart);
const publicCatalog = catalogStart >= 0 && catalogEnd > catalogStart ? server.slice(catalogStart, catalogEnd) : "";
if (!publicCatalog) fail("public RH catalog function was not found");
if (publicCatalog.includes("readAdminDb()")) fail("public RH catalog still uses aggregate admin DB reads");
if (!taskRoutes.includes("jsonb_array_length") || taskRoutes.includes("t.logs,\n")) fail("task list projection still returns complete logs");
if (!providerRoutes.includes("readProviderRecords")) fail("provider route has no targeted repository boundary");
if (process.exitCode) process.exit();
console.log("PASS targeted read repository contract");
