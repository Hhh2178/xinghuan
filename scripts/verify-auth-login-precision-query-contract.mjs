import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const repositoryPath = join(root, "apps", "api", "src", "auth-repository.ts");
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const repositorySource = existsSync(repositoryPath) ? readFileSync(repositoryPath, "utf8") : "";

const checks = [
  {
    name: "auth repository boundary exists before login query extraction",
    pass: existsSync(repositoryPath),
  },
  {
    name: "login still resolves enabled users by email without session joins",
    pass:
      serverSource.includes("db.users.find((item) => item.email.toLowerCase() === email && !item.disabled)") ||
      repositorySource.includes("lower(email) = lower($1)"),
  },
  {
    name: "repository does not introduce broad login joins",
    pass:
      !repositorySource.includes("from xh_sessions s join xh_users") &&
      !repositorySource.includes("from xh_login_attempts") &&
      !repositorySource.includes("from xh_group_permission_policies"),
  },
  {
    name: "current B1 batch keeps login extraction explicitly deferred",
    pass:
      serverSource.includes("async function loginUser") &&
      repositorySource.includes("createAuthCurrentUserRepository"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Auth login precision query contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
