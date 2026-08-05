import { readFile } from "node:fs/promises";

const loaders = await readFile("apps/admin/src/admin-data-loaders.ts", "utf8");
const main = await readFile("apps/admin/src/main.tsx", "utf8");
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1; };
if (!loaders.includes('readAdminQuery(["shell", "summary"]')) fail("shell summary is not query-coordinated");
if (!loaders.includes('subpageId === "accounts"')) fail("organization subpage routing is missing");
if (!loaders.includes('return { sessions: await readAdminQuery(["directory", "sessions"]')) fail("organization route matrix has no sessions boundary");
const sessionsBoundary = loaders.indexOf('if (subpageId === "sessions")');
const organizationUsersRead = loaders.indexOf('const usersPromise = readAdminQuery(["directory", "users"]');
if (sessionsBoundary < 0 || organizationUsersRead < 0 || sessionsBoundary > organizationUsersRead) {
  fail("sessions route must be checked before organization directory requests are created");
}
const reliabilityBoundary = loaders.indexOf('if (subpageId === "reliability")');
const analyticsUsersRead = loaders.indexOf('const users = readAdminQuery(["directory", "users"]');
if (reliabilityBoundary < 0 || analyticsUsersRead < 0 || reliabilityBoundary > analyticsUsersRead) {
  fail("reliability route must not create directory requests");
}
if ((loaders.match(/readAdminQuery\(\["analytics", "audit"\]/g) || []).length !== 1) {
  fail("analytics audit route must have exactly one audit query");
}
if (!/void loadWorkspaceData\(activeWorkspaceId\);[\s\S]{0,120}\[activeSubpageIdForLoad, activeWorkspaceId, isAdmin\]/.test(main)) {
  fail("workspace reads must react to subpage changes");
}
if (process.exitCode) process.exit();
console.log("PASS admin route request matrix contract");
