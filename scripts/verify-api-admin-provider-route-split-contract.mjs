import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-provider-routes.ts", import.meta.url), "utf8");

assert.match(server, /admin-provider-routes/, "server.ts should import the extracted admin provider route module");
assert.match(server, /handleAdminProviderRoutes\(/, "server.ts should delegate provider admin routes to the extracted module");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/providers"\)/, "server.ts should not keep inline /api/admin/providers GET/POST handlers");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/providers\/probe" && request\.method === "POST"\)/, "server.ts should not keep inline provider draft probe handler");
assert.doesNotMatch(server, /if \(url\.pathname === "\/api\/admin\/providers\/fetch-models" && request\.method === "POST"\)/, "server.ts should not keep inline provider draft fetch-models handler");
assert.doesNotMatch(server, /const providerProbeMatch = url\.pathname\.match\(\^?\/\\\/api\\\/admin\\\/providers\\\/\(\[\^\/\]\+\)\\\/probe/, "server.ts should not keep inline provider probe-by-id handler");
assert.doesNotMatch(server, /const providerFetchModelsMatch = url\.pathname\.match\(\^?\/\\\/api\\\/admin\\\/providers\\\/\(\[\^\/\]\+\)\\\/fetch-models/, "server.ts should not keep inline provider fetch-models-by-id handler");
assert.doesNotMatch(server, /const providerMatch = url\.pathname\.match\(\^?\/\\\/api\\\/admin\\\/providers\\\/\(\[\^\/\]\+\)\$/, "server.ts should not keep inline provider PATCH/DELETE handlers");

assert.match(routes, /export async function handleAdminProviderRoutes/, "admin provider route module should export the route handler");
assert.match(routes, /\/api\/admin\/providers/, "admin provider route module should own provider admin pathnames");
assert.match(routes, /providers\.read/, "admin provider route module should keep provider list audit");
assert.match(routes, /provider\.create/, "admin provider route module should keep provider create audit");
assert.match(routes, /provider\.probe/, "admin provider route module should keep provider probe audit");
assert.match(routes, /provider\.fetchModels/, "admin provider route module should keep provider fetch-models audit");
assert.match(routes, /provider\.update/, "admin provider route module should keep provider update audit");
assert.match(routes, /provider\.delete/, "admin provider route module should keep provider delete audit");
assert.match(routes, /probeProviderDraft/, "admin provider route module should call the provider probe helper via deps");
assert.match(routes, /fetchProviderModelsDraft/, "admin provider route module should call the provider fetch-models helper via deps");
assert.match(routes, /updateProviderProbeResult/, "admin provider route module should persist provider probe results via deps");
assert.match(routes, /updateProviderLastFetchedAt/, "admin provider route module should persist provider fetch-model timestamps via deps");

console.log("PASS api admin provider route split contract");
