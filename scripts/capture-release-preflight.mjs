import { execFile as execFileCallback } from "node:child_process";
import { readlink } from "node:fs/promises";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const baseUrl = process.env.XINGHUAN_VERIFY_BASE_URL ?? "http://127.0.0.1:18200";
const envLabel = process.env.XINGHUAN_ENV_LABEL ?? "unknown";
const releaseCurrentLink = process.env.XINGHUAN_RELEASE_CURRENT_LINK ?? "";
const apiServiceName = process.env.XINGHUAN_API_SERVICE_NAME ?? "";
const workerServiceName = process.env.XINGHUAN_WORKER_SERVICE_NAME ?? "";
const databaseUrl = process.env.XINGHUAN_DATABASE_URL ?? "";

async function main() {
  const startedAt = new Date().toISOString();
  const status = await fetchJson("/api/status");
  const dbSnapshot = databaseUrl ? await queryDatabaseSnapshot(databaseUrl) : null;
  const currentRelease = releaseCurrentLink ? await safeReadlink(releaseCurrentLink) : "";
  const serviceStates = await readServiceStates([
    ["api", apiServiceName],
    ["worker", workerServiceName],
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        capturedAt: startedAt,
        environment: envLabel,
        baseUrl,
        apiStatus: status.data ?? null,
        currentReleaseLink: releaseCurrentLink || null,
        currentReleaseTarget: currentRelease || null,
        database: dbSnapshot,
        services: serviceStates,
      },
      null,
      2,
    ),
  );
}

async function queryDatabaseSnapshot(connectionString) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const db = await client.query("select current_database() as value");
    const users = await client.query("select count(*)::int as value from xh_users");
    const canvases = await client.query("select count(*)::int as value from xh_canvases");
    const assets = await client.query("select count(*)::int as value from xh_assets");
    const tasks = await client.query("select count(*)::int as value from xh_tasks");
    const sessions = await client.query("select count(*)::int as value from xh_sessions");
    return {
      name: db.rows[0]?.value ?? "",
      counts: {
        users: users.rows[0]?.value ?? 0,
        canvases: canvases.rows[0]?.value ?? 0,
        assets: assets.rows[0]?.value ?? 0,
        tasks: tasks.rows[0]?.value ?? 0,
        sessions: sessions.rows[0]?.value ?? 0,
      },
    };
  } finally {
    await client.end();
  }
}

async function readServiceStates(entries) {
  const results = {};
  for (const [key, serviceName] of entries) {
    if (!serviceName) {
      results[key] = null;
      continue;
    }
    results[key] = await safeSystemctlStatus(serviceName);
  }
  return results;
}

async function safeSystemctlStatus(serviceName) {
  try {
    const { stdout } = await execFile("systemctl", ["is-active", serviceName], { timeout: 10_000 });
    return stdout.trim() || "unknown";
  } catch (error) {
    const stderr = safeText(error?.stderr);
    const stdout = safeText(error?.stdout);
    return stderr || stdout || "unavailable";
  }
}

async function safeReadlink(target) {
  try {
    return await readlink(target);
  } catch {
    return "";
  }
}

async function fetchJson(pathname, options) {
  const response = await fetch(toUrl(pathname), options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function toUrl(pathname) {
  if (String(pathname).startsWith("http://") || String(pathname).startsWith("https://")) return pathname;
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
