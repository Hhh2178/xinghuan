import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const systemShell = await readFile(new URL("../apps/api/src/admin-system-routes.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-queue-settings-routes.ts", import.meta.url), "utf8");
const adapters = await readFile(new URL("../apps/api/src/api-response-adapters.ts", import.meta.url), "utf8");

assert.doesNotMatch(server, /admin-queue-settings-routes/, "server.ts should not import the queue settings route directly once the shell owns sub-route wiring");
assert.doesNotMatch(server, /handleAdminQueueSettingsRoutes\(/, "server.ts should not delegate queue settings handling directly once the shell owns sub-route wiring");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" \&\& request\.method === "PATCH"\)/, "server.ts should not keep inline admin system PATCH handling");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/queue-settings"/, "server.ts should not keep inline admin queue settings handlers");

assert.match(systemShell, /handleAdminQueueSettingsRoutes\(/, "admin system route shell should wire the extracted queue settings handlers");
assert.match(routes, /export async function handleAdminQueueSettingsRoutes/, "queue settings route module should export the route handler");
assert.match(routes, /\/api\/admin\/queue-settings/, "queue settings route module should own the dedicated queue settings pathname");
assert.match(routes, /system\.taskQueue\.update/, "queue settings route module should keep the task queue update audit");
assert.match(routes, /buildAdminQueueSettingsPayload/, "queue settings route module should use the shared queue settings adapter");

assert.match(adapters, /export function buildAdminQueueSettingsPayload/, "shared API response adapters should expose the queue settings payload builder");

console.log("PASS api queue settings route split contract");
