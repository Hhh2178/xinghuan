import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
const repository = await readFile(new URL("../apps/api/src/admin-repository.ts", import.meta.url), "utf8");

assert.match(server, /createAdminRepository\(/, "server.ts should instantiate the admin repository");
assert.match(server, /async function readAnnouncementRecords\([\s\S]*?adminRepository\.readAnnouncementRecords\(\)/, "announcement reader should delegate to admin repository");
assert.match(server, /async function writeAnnouncementRecords\([\s\S]*?adminRepository\.writeAnnouncementRecords\(announcements\)/, "announcement writer should delegate to admin repository");
assert.match(repository, /readAnnouncementRecordsPostgres/, "admin repository should expose announcement postgres reads");
assert.match(repository, /writeAnnouncementRecordsPostgres/, "admin repository should expose announcement postgres writes");
assert.match(repository, /delete from xh_announcements/, "announcement full-list replacement may only touch xh_announcements");
assert.doesNotMatch(repository, /writeAnnouncementRecordsPostgres[\s\S]*?delete from xh_tasks/i, "announcement writer must not replace tasks");
assert.doesNotMatch(repository, /writeAnnouncementRecordsPostgres[\s\S]*?delete from xh_providers/i, "announcement writer must not replace providers");
assert.doesNotMatch(repository, /writeAnnouncementRecordsPostgres[\s\S]*?delete from xh_models/i, "announcement writer must not replace models");

console.log("PASS admin announcement records repository contract");
