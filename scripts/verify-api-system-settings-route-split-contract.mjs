import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-system-settings-routes.ts", import.meta.url), "utf8");
const adapters = await readFile(new URL("../apps/api/src/api-response-adapters.ts", import.meta.url), "utf8");

assert.match(server, /admin-system-settings-routes/, "server.ts should import the extracted admin system settings route module");
assert.match(server, /handleAdminSystemSettingsRoutes\(/, "server.ts should delegate admin system GET handling to the extracted module");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" \&\& request\.method === "GET"\)/, "server.ts should not keep inline admin system GET handling");

assert.match(routes, /export async function handleAdminSystemSettingsRoutes/, "system settings route module should export the route handler");
assert.match(routes, /url\.pathname !== "\/api\/admin\/system" \|\| request\.method !== "GET"/, "system settings route module should own the /api/admin/system GET boundary");
assert.match(routes, /system\.read/, "system settings route module should keep the system read audit");
assert.match(routes, /buildAdminSystemStatusPayload/, "system settings route module should use the shared response adapter");

assert.match(adapters, /export function buildAdminSystemStatusPayload/, "shared API response adapters should expose the admin system status payload builder");

console.log("PASS api system settings route split contract");
