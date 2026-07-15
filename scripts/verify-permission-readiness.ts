import { evaluatePermissionReadiness } from "../apps/api/src/permissions/permission-readiness.js";
import {
  connectPermissionDatabase,
  readPermissionDatabaseState,
} from "./permission-db-state.js";

async function main() {
  const expectedReady = argument("expect-ready", "true") !== "false";
  const { client, currentDatabase } = await connectPermissionDatabase();
  try {
    const state = await readPermissionDatabaseState(client);
    const report = evaluatePermissionReadiness(state);
    const output = {
      ok: report.ready === expectedReady,
      database: currentDatabase,
      expectedReady,
      ready: report.ready,
      mode: String(process.env.XINGHUAN_PERMISSION_MODE || "legacy"),
      metrics: report.metrics,
      failures: report.failures.map(({ code, message, count }) => ({
        code,
        message,
        count,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    if (!output.ok) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
