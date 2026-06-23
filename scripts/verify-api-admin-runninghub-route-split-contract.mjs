import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-runninghub-routes.ts", import.meta.url), "utf8");

assert.match(server, /admin-runninghub-routes/);
assert.match(server, /handleAdminRunningHubRoutes/);

assert.match(routes, /export async function handleAdminRunningHubRoutes/);
assert.match(routes, /\/api\/admin\/runninghub\/items/);
assert.match(routes, /\/api\/admin\/runninghub\/analyze/);
assert.match(routes, /runninghub\.item\.create/);
assert.match(routes, /runninghub\.item\.update/);
assert.match(routes, /runninghub\.item\.delete/);
assert.match(routes, /runninghub\.item\.test/);
assert.match(routes, /runninghub\.item\.analyze/);

console.log("PASS api admin runninghub route split contract");
