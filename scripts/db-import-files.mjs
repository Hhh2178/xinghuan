import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.XINGHUAN_DATA_DIR || join(rootDir, "apps", "api", "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";

if (!databaseUrl) {
  console.error("DATABASE_NOT_CONFIGURED");
  process.exit(2);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("PG_DRIVER_NOT_INSTALLED");
  process.exit(3);
}

const authPath = join(dataDir, "auth", "auth.json");
const adminPath = join(dataDir, "admin", "admin.json");
const authDb = await readJson(authPath, { users: [], sessions: [] });
const adminDb = await readJson(adminPath, { providers: [], models: [], tasks: [], auditLogs: [] });
const userIds = new Set(authDb.users.map((user) => user.id));
const providerIds = new Set(adminDb.providers.map((provider) => provider.id));

const { Client } = pg.default || pg;
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("begin");
  await client.query("delete from xh_audit_logs");
  await client.query("delete from xh_tasks");
  await client.query("delete from xh_models");
  await client.query("delete from xh_providers");
  await client.query("delete from xh_sessions");
  await client.query("delete from xh_users");

  for (const user of authDb.users) {
    await client.query(
      `insert into xh_users (id, email, name, role, password_hash, disabled, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        user.email,
        user.name,
        user.role === "admin" ? "admin" : "member",
        user.passwordHash,
        Boolean(user.disabled),
        toDate(user.createdAt),
        toDate(user.updatedAt),
      ],
    );
  }

  for (const session of authDb.sessions) {
    if (!userIds.has(session.userId)) continue;
    await client.query(
      `insert into xh_sessions (id, user_id, created_at, expires_at)
       values ($1, $2, $3, $4)`,
      [session.id, session.userId, toDate(session.createdAt), toDate(session.expiresAt)],
    );
  }

  for (const provider of adminDb.providers) {
    await client.query(
      `insert into xh_providers (id, name, base_url, enabled, api_key_cipher, api_key_preview, note, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        provider.id,
        provider.name,
        provider.baseUrl || "",
        Boolean(provider.enabled),
        provider.apiKey || null,
        provider.apiKeyPreview || null,
        provider.note || null,
        toDate(provider.createdAt),
        toDate(provider.updatedAt),
      ],
    );
  }

  let skippedModels = 0;
  for (const model of adminDb.models) {
    if (!providerIds.has(model.providerId)) {
      skippedModels += 1;
      continue;
    }
    await client.query(
      `insert into xh_models (id, provider_id, model_id, display_name, capability, enabled, input_profile, parameter_schema, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        model.id,
        model.providerId,
        model.modelId,
        model.displayName,
        normalizeCapability(model.capability),
        Boolean(model.enabled),
        model.inputProfile || "prompt",
        JSON.stringify(parseJsonObject(model.parameterSchema)),
        toDate(model.createdAt),
        toDate(model.updatedAt),
      ],
    );
  }

  for (const task of adminDb.tasks) {
    await client.query(
      `insert into xh_tasks (id, owner_id, title, status, provider_id, model_id, logs, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        task.id,
        userIds.has(task.ownerId) ? task.ownerId : null,
        task.title,
        normalizeTaskStatus(task.status),
        providerIds.has(task.providerId) ? task.providerId : null,
        task.modelId || null,
        JSON.stringify(Array.isArray(task.logs) ? task.logs : []),
        toDate(task.createdAt),
        toDate(task.updatedAt),
      ],
    );
  }

  for (const audit of adminDb.auditLogs || []) {
    await client.query(
      `insert into xh_audit_logs (id, actor_id, actor_email, action, target_type, target_id, summary, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        audit.id,
        userIds.has(audit.actorId) ? audit.actorId : null,
        audit.actorEmail || "",
        audit.action,
        audit.targetType,
        audit.targetId,
        audit.summary,
        toDate(audit.createdAt),
      ],
    );
  }

  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    users: authDb.users.length,
    sessions: authDb.sessions.length,
    providers: adminDb.providers.length,
    models: adminDb.models.length,
    skippedModels,
    tasks: adminDb.tasks.length,
    auditLogs: (adminDb.auditLogs || []).length,
  }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf-8"));
}

function toDate(value) {
  const time = typeof value === "number" && Number.isFinite(value) ? value : Date.now();
  return new Date(time);
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeCapability(value) {
  return ["text", "image", "video", "audio"].includes(value) ? value : "text";
}

function normalizeTaskStatus(value) {
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(value) ? value : "queued";
}
