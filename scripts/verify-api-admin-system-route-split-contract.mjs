import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-system-routes.ts", import.meta.url), "utf8");
const settingsRoutes = await readFile(new URL("../apps/api/src/admin-system-settings-routes.ts", import.meta.url), "utf8");
const queueRoutes = await readFile(new URL("../apps/api/src/admin-queue-settings-routes.ts", import.meta.url), "utf8");
const assistantRoutes = await readFile(new URL("../apps/api/src/admin-assistant-settings-routes.ts", import.meta.url), "utf8");
const adapter = await readFile(new URL("../apps/api/src/admin-system-response-adapter.ts", import.meta.url), "utf8");

assert.match(server, /admin-system-routes/, "server.ts should import the extracted admin system route module");
assert.match(server, /handleAdminSystemRoutes\(/, "server.ts should delegate /api\\/admin\\/system to extracted routes");
assert.doesNotMatch(server, /handleAdminSystemSettingsRoutes\(/, "server.ts should not wire admin system GET sub-routes directly");
assert.doesNotMatch(server, /handleAdminQueueSettingsRoutes\(/, "server.ts should not wire admin queue settings sub-routes directly");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" && request\.method === "GET"\)/, "server.ts should not keep inline admin system GET handler");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" && request\.method === "PATCH"\)/, "server.ts should not keep inline admin system PATCH handler");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/assistant\/settings"\)/, "server.ts should not keep inline admin assistant settings handler");

assert.match(routes, /export async function handleAdminSystemRoutes/, "admin system route module should export the route handler");
assert.match(routes, /handleAdminSystemSettingsRoutes/, "admin system route shell should delegate GET /api/admin/system");
assert.match(routes, /handleAdminQueueSettingsRoutes/, "admin system route shell should delegate PATCH /api/admin/system and /api/admin/queue-settings");
assert.match(routes, /handleAdminAssistantSettingsRoutes/, "admin system route shell should delegate admin assistant settings");
assert.doesNotMatch(routes, /system\.read/, "admin system route shell should not keep system read audit logic inline");
assert.doesNotMatch(routes, /system\.taskQueue\.update/, "admin system route shell should not keep task queue update audit logic inline");
assert.doesNotMatch(routes, /buildAdminSystemStatusPayload/, "admin system route shell should not build status payloads inline");
assert.doesNotMatch(routes, /buildAdminSystemTaskQueuePayload/, "admin system route shell should not build task queue payloads inline");

assert.match(settingsRoutes, /system\.read/, "admin system settings route module should keep system read audit");
assert.match(queueRoutes, /system\.taskQueue\.update/, "admin queue settings route module should keep task queue update audit");
assert.match(assistantRoutes, /export async function handleAdminAssistantSettingsRoutes/, "assistant settings route module should export the handler");
assert.match(assistantRoutes, /assistant\.settings\.update/, "assistant settings route should keep assistant settings audit");
assert.match(assistantRoutes, /maskAssistantEndpoint/, "assistant settings route should sanitize assistant settings responses");

assert.match(adapter, /export function buildAdminSystemStatusPayload/, "admin system adapter should expose the status payload builder");
assert.match(adapter, /export function buildAdminSystemTaskQueuePayload/, "admin system adapter should expose the task queue payload builder");
assert.match(adapter, /service: input\.service \|\| "xinghuan-api"/, "admin system adapter should preserve the default service name");

console.log("PASS api admin system route split contract");
