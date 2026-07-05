import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const serverSource = readFileSync(join(root, "apps", "api", "src", "server.ts"), "utf8");
const repositoryPath = join(root, "apps", "api", "src", "auth-repository.ts");
const repositorySource = readFileSync(repositoryPath, "utf8");
const getCurrentUserMatch = serverSource.match(/async function getCurrentUser[\s\S]*?\n}\n/);
const getCurrentUserSource = getCurrentUserMatch?.[0] || "";

const checks = [
  {
    name: "auth current user repository module exists",
    pass: existsSync(repositoryPath),
  },
  {
    name: "server imports and instantiates current user repository",
    pass:
      serverSource.includes('from "./auth-repository.js"') &&
      serverSource.includes("createAuthCurrentUserRepository") &&
      serverSource.includes("authCurrentUserRepository"),
  },
  {
    name: "getCurrentUser delegates session lookup to repository",
    pass:
      getCurrentUserSource.includes("authCurrentUserRepository.findCurrentUserBySessionId") &&
      !getCurrentUserSource.includes("const db = await readAuthDb()") &&
      !getCurrentUserSource.includes("db.sessions.find") &&
      !getCurrentUserSource.includes("db.users.find"),
  },
  {
    name: "postgres current-user lookup uses targeted session query",
    pass:
      repositorySource.includes("from xh_sessions") &&
      repositorySource.includes("where id = $1") &&
      repositorySource.includes("expires_at > $2") &&
      repositorySource.includes("revoked_at is null"),
  },
  {
    name: "postgres current-user lookup uses targeted user query",
    pass:
      repositorySource.includes("from xh_users") &&
      repositorySource.includes("where id = $1") &&
      repositorySource.includes("disabled = false") &&
      !repositorySource.includes("from xh_user_groups") &&
      !repositorySource.includes("from xh_login_attempts"),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error("Auth current-user repository contract verification failed:");
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.name) }, null, 2));
