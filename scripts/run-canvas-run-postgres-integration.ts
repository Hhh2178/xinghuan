import { spawn } from "node:child_process";

import { Client } from "pg";

const databaseUrl = String(process.env.XINGHUAN_TEST_DATABASE_URL || "").trim();

if (!databaseUrl) {
  throw new Error("XINGHUAN_TEST_DATABASE_URL_REQUIRED");
}

const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
await client.connect();
try {
  const result = await client.query<{ database_name: string }>("select current_database() as database_name");
  const databaseName = String(result.rows[0]?.database_name || "");
  if (!/^xinghuan_agent_test_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error("XINGHUAN_TEST_DATABASE_NAME_UNSAFE");
  }
  console.log(JSON.stringify({ databaseName, integration: "canvas-run-postgres" }));
} finally {
  await client.end();
}

const testEnvironment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  XINGHUAN_DATABASE_URL: databaseUrl,
  XINGHUAN_TEST_DATABASE_URL: databaseUrl,
};

await run(process.execPath, ["scripts/db-migrate.mjs"], testEnvironment);
await run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "apps/worker/src/canvas-run-postgres.integration.test.ts"], testEnvironment);

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CANVAS_RUN_POSTGRES_INTEGRATION_COMMAND_FAILED:${command}:${code ?? "signal"}`));
    });
  });
}
