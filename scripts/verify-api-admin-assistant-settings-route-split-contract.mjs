import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const systemShell = await readFile(new URL("../apps/api/src/admin-system-routes.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-assistant-settings-routes.ts", import.meta.url), "utf8");

assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/assistant\/settings"\)/, "server.ts should not keep inline admin assistant settings handling");
assert.match(systemShell, /handleAdminAssistantSettingsRoutes\(/, "admin system route shell should delegate assistant settings handling");

assert.match(routes, /export async function handleAdminAssistantSettingsRoutes/, "assistant settings route module should export the route handler");
assert.match(routes, /\/api\/admin\/assistant\/settings/, "assistant settings route module should own the admin assistant settings pathname");
assert.match(routes, /assistant\.settings\.update/, "assistant settings route module should keep assistant settings audit");
assert.match(routes, /maskAssistantEndpoint/, "assistant settings route module should sanitize assistant settings responses");
assert.match(routes, /writeAssistantSettingsRecord/, "assistant settings route module should persist assistant settings updates");

console.log("PASS api admin assistant settings route split contract");
