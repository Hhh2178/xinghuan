import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-system-routes.ts", import.meta.url), "utf8");
const adapter = await readFile(new URL("../apps/api/src/admin-system-response-adapter.ts", import.meta.url), "utf8");

assert.match(server, /admin-system-routes/, "server.ts should import the extracted admin system route module");
assert.match(server, /handleAdminSystemRoutes\(/, "server.ts should delegate /api\\/admin\\/system to extracted routes");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" && request\.method === "GET"\)/, "server.ts should not keep inline admin system GET handler");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" && request\.method === "PATCH"\)/, "server.ts should not keep inline admin system PATCH handler");

assert.match(routes, /export async function handleAdminSystemRoutes/, "admin system route module should export the route handler");
assert.match(routes, /\/api\/admin\/system/, "admin system route module should own the /api/admin/system pathname");
assert.match(routes, /system\.read/, "admin system route module should keep system read audit");
assert.match(routes, /system\.taskQueue\.update/, "admin system route module should keep task queue update audit");
assert.match(routes, /buildAdminSystemStatusPayload/, "admin system route module should use the response adapter for system status payloads");
assert.match(routes, /buildAdminSystemTaskQueuePayload/, "admin system route module should use the response adapter for task queue payloads");

assert.match(adapter, /export function buildAdminSystemStatusPayload/, "admin system adapter should expose the status payload builder");
assert.match(adapter, /export function buildAdminSystemTaskQueuePayload/, "admin system adapter should expose the task queue payload builder");
assert.match(adapter, /service: input\.service \|\| "xinghuan-api"/, "admin system adapter should preserve the default service name");

console.log("PASS api admin system route split contract");
