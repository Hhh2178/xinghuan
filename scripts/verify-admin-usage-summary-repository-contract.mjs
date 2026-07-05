import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-audit-routes.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../apps/api/src/admin-usage-summary-repository.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../apps/api/src/admin-usage-summary-service.ts", import.meta.url), "utf8");

assert.match(server, /createAdminUsageSummaryRepository\(/, "server.ts should instantiate usage summary repository");
assert.match(server, /createAdminUsageSummaryService\(/, "server.ts should instantiate usage summary service");
assert.match(server, /readAdminUsageSummary:\s*adminUsageSummaryService\.readAdminUsageSummary/, "audit route should receive usage summary service");

assert.match(routes, /readAdminUsageSummary:\s*\(query: AdminUsageSummaryQuery\) => Promise<AdminUsageSummary>/, "audit route should depend on injected usage summary reader");
assert.doesNotMatch(routes, /buildAdminUsageSummary/, "audit route should not build usage summary inline");
assert.doesNotMatch(routes, /from xh_tasks/, "audit route should not own usage summary SQL");

assert.match(repository, /createAdminUsageSummaryRepository/, "repository should expose usage summary repository factory");
assert.match(repository, /jsonb_build_object/, "repository should select a narrowed payload/result shape for analytics");
assert.doesNotMatch(repository, /select t\.payload\s*,|select[\s\S]*t\.payload,\s*t\.result,/i, "repository should not select raw task payload/result wholesale");
assert.match(service, /buildAdminUsageSummary/, "service should compose analytics from repository records");
assert.doesNotMatch(service, /getPostgresPool|readAdminDb|readAuthDb|from xh_tasks/, "service should not access storage directly");

console.log("PASS admin usage summary repository contract");
