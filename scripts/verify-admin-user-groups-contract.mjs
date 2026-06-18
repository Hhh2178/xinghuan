import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const typesSource = readFileSync(join(root, "apps", "admin", "src", "admin-types.ts"), "utf8");

function snippetAround(source, needle, radius = 700) {
  const index = source.indexOf(needle);
  if (index < 0) return "";
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + needle.length + radius);
  return source.slice(start, end);
}

const userGroupsRouteSnippet = snippetAround(serverSource, '"/api/admin/user-groups"');

const checks = [
  {
    name: "admin types export AdminUserGroup",
    pass: typesSource.includes("export interface AdminUserGroup"),
  },
  {
    name: "admin user group has groupId",
    pass: typesSource.includes("groupId?: string;"),
  },
  {
    name: "admin user group has groupName",
    pass: typesSource.includes("groupName?: string;"),
  },
  {
    name: "admin user group has remark",
    pass: typesSource.includes("remark: string;"),
  },
  {
    name: "admin user group has ownerRemark",
    pass: typesSource.includes("ownerRemark?: string;"),
  },
  {
    name: "admin user group has ownerGroupName",
    pass: typesSource.includes("ownerGroupName?: string;"),
  },
  {
    name: "admin api exposes user-groups route",
    pass: Boolean(userGroupsRouteSnippet),
  },
  {
    name: "admin api deletes user groups by DELETE",
    pass: userGroupsRouteSnippet.includes('request.method === "DELETE"'),
  },
  {
    name: "admin api tracks ownerDeleted",
    pass: userGroupsRouteSnippet.includes("ownerDeleted"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error("Admin user groups contract verification failed:");
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
