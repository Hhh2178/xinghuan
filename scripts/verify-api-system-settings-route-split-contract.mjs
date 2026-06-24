import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const systemShell = await readFile(new URL("../apps/api/src/admin-system-routes.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-system-settings-routes.ts", import.meta.url), "utf8");
const adapters = await readFile(new URL("../apps/api/src/api-response-adapters.ts", import.meta.url), "utf8");

assert.doesNotMatch(server, /admin-system-settings-routes/, "server.ts should not import admin system settings route directly once the shell owns sub-route wiring");
assert.doesNotMatch(server, /handleAdminSystemSettingsRoutes\(/, "server.ts should not delegate admin system GET handling directly once the shell owns sub-route wiring");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/system" \&\& request\.method === "GET"\)/, "server.ts should not keep inline admin system GET handling");

assert.match(systemShell, /handleAdminSystemSettingsRoutes\(/, "admin system route shell should wire the extracted admin system GET handler");
assert.match(routes, /export async function handleAdminSystemSettingsRoutes/, "system settings route module should export the route handler");
assert.match(routes, /url\.pathname !== "\/api\/admin\/system" \|\| request\.method !== "GET"/, "system settings route module should own the /api/admin/system GET boundary");
assert.match(routes, /system\.read/, "system settings route module should keep the system read audit");
assert.match(routes, /buildAdminSystemStatusPayload/, "system settings route module should use the shared response adapter");

assert.match(adapters, /export function buildAdminSystemStatusPayload/, "shared API response adapters should expose the admin system status payload builder");

console.log("PASS api system settings route split contract");
