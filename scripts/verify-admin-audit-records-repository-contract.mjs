import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../apps/api/src/admin-audit-routes.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../apps/api/src/admin-repository.ts", import.meta.url), "utf8");
const appendAuditRecord = repository.match(/async function appendAuditRecord\([\s\S]*?\n  }\n}\n\nfunction toCount/)?.[0] || "";
const readAuditRecords = repository.match(/async function readAuditRecords\([\s\S]*?\n  }\n\n  async function appendAuditRecord/)?.[0] || "";

assert.match(server, /createAdminRepository\(/, "server.ts should instantiate the admin repository");
assert.match(server, /readAuditRecords:\s*adminRepository\.readAuditRecords/, "admin audit route should receive repository audit reader");
assert.match(server, /async function appendAuditRecord\([\s\S]*?adminRepository\.appendAuditRecord\(record\)/, "appendAuditRecord should delegate to admin repository");
assert.match(routes, /readAuditRecords\?:/, "admin audit routes should accept a focused audit reader");
assert.match(routes, /readAuditRecords\s*\?\s*await readAuditRecords\(200\)/, "audit list route should prefer focused audit reader");
assert.match(repository, /insert into xh_audit_logs/, "admin repository should append audit records through xh_audit_logs");
assert.doesNotMatch(appendAuditRecord, /delete from/i, "audit append must not full-replace admin tables");
assert.doesNotMatch(readAuditRecords, /xh_tasks/i, "audit records reader must not load tasks");

console.log("PASS admin audit records repository contract");
