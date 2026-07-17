import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = process.env.XINGHUAN_DATA_DIR || join(process.cwd(), "apps", "api", "data");
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
const apply = process.argv.includes("--apply");

export async function migrateGenerationLibraryArtifacts(options = {}) {
  const targetDataDir = options.dataDir || dataDir;
  const targetDatabaseUrl = options.databaseUrl || databaseUrl;
  const shouldApply = options.apply ?? apply;
  if (!targetDatabaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");

  const ownsPool = !options.pool;
  const pool = options.pool || await createPool(targetDatabaseUrl);
  const summary = {
    ok: true,
    apply: shouldApply,
    dataDir: targetDataDir,
    scannedUsers: 0,
    scannedFiles: 0,
    scannedItems: 0,
    validItems: 0,
    insertedOrUpdated: 0,
    skippedUsers: [],
    corruptFiles: [],
    invalidItems: [],
  };

  try {
    const usersDir = join(targetDataDir, "users");
    const users = await readdir(usersDir, { withFileTypes: true }).catch(() => []);
    for (const entry of users) {
      if (!entry.isDirectory()) continue;
      summary.scannedUsers += 1;
      const ownerId = entry.name;
      const owner = await pool.query("select id from xh_users where id = $1 limit 1", [ownerId]);
      if (!owner.rows[0]) {
        summary.skippedUsers.push({ ownerId, reason: "owner_not_found" });
        continue;
      }
      const sourcePath = join(usersDir, ownerId, "resources", "generation-library.json");
      let parsed;
      try {
        parsed = JSON.parse(await readFile(sourcePath, "utf8"));
        summary.scannedFiles += 1;
      } catch (error) {
        if (error?.code !== "ENOENT") summary.corruptFiles.push({ ownerId, path: sourcePath, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      summary.scannedItems += items.length;
      for (const [index, raw] of items.entries()) {
        const item = normalizeLegacyItem(raw, ownerId, index);
        if (!item) {
          summary.invalidItems.push({ ownerId, index, reason: "kind_or_url_invalid" });
          continue;
        }
        summary.validItems += 1;
        if (!shouldApply) continue;
        await upsertArtifact(pool, ownerId, item);
        summary.insertedOrUpdated += 1;
      }
    }
    return summary;
  } finally {
    if (ownsPool) await pool.end();
  }
}

function normalizeLegacyItem(raw, ownerId, index) {
  if (!raw || typeof raw !== "object") return null;
  const kind = ["image", "video", "audio"].includes(text(raw.kind)) ? text(raw.kind) : "";
  const fileUrl = text(raw.fileUrl || raw.url);
  if (!kind || !fileUrl) return null;
  const createdAt = positiveMillis(raw.createdAt, Date.now());
  const expiresAt = positiveMillis(raw.expiresAt, createdAt + 3 * 24 * 60 * 60 * 1000);
  const storageKey = outputStorageKey(fileUrl);
  const taskId = text(raw.taskId);
  const dedupeKey = `${taskId || "legacy"}:${kind}:${storageKey}`;
  return {
    id: `legacy-${safeId(ownerId)}-${safeId(raw.id || `${createdAt}-${index}`)}`,
    kind,
    status: expiresAt <= Date.now() ? "expired" : "active",
    title: text(raw.title, storageKey || "生成产物"),
    storageKey,
    fileUrl,
    sourceUrl: text(raw.url, fileUrl),
    mime: text(raw.mime),
    size: Number(raw.size) || 0,
    taskId,
    sourceCanvasId: text(raw.sourceCanvasId),
    sourceNodeId: text(raw.sourceNodeId),
    providerId: text(raw.providerId),
    modelId: text(raw.modelId),
    dedupeKey,
    createdAt,
    updatedAt: positiveMillis(raw.updatedAt, createdAt),
    expiresAt,
    metadata: { migrationSource: "generation-library.json", legacyId: text(raw.id), legacyIndex: index },
  };
}

async function upsertArtifact(pool, ownerId, item) {
  await pool.query(
    `insert into xh_generation_artifacts (
       id, owner_id, kind, status, title, storage_key, file_url, source_url, mime, size_bytes,
       source_task_id, source_canvas_id, source_node_id, provider_id, model_id, dedupe_key, metadata,
       created_at, updated_at, expires_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       (select id from xh_tasks where id = $11 and owner_id = $2),
       $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20)
     on conflict (owner_id, dedupe_key) do update set
       title = excluded.title,
       storage_key = excluded.storage_key,
       file_url = excluded.file_url,
       source_url = excluded.source_url,
       mime = excluded.mime,
       size_bytes = excluded.size_bytes,
       metadata = xh_generation_artifacts.metadata || excluded.metadata,
       updated_at = greatest(xh_generation_artifacts.updated_at, excluded.updated_at),
       expires_at = greatest(xh_generation_artifacts.expires_at, excluded.expires_at)`,
    [
      item.id, ownerId, item.kind, item.status, item.title, item.storageKey, item.fileUrl, item.sourceUrl,
      item.mime || null, item.size, item.taskId || null, item.sourceCanvasId || null, item.sourceNodeId || null,
      item.providerId || null, item.modelId || null, item.dedupeKey, JSON.stringify(item.metadata),
      new Date(item.createdAt), new Date(item.updatedAt), new Date(item.expiresAt),
    ],
  );
}

async function createPool(connectionString) {
  const pg = await import("pg");
  const { Pool } = pg.default || pg;
  return new Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });
}

function outputStorageKey(fileUrl) {
  if (fileUrl.startsWith("/files/output/")) return decodeURIComponent(fileUrl.slice("/files/output/".length));
  if (fileUrl.startsWith("/output/")) return decodeURIComponent(fileUrl.slice("/output/".length));
  return fileUrl;
}

function positiveMillis(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function safeId(value) {
  return text(value, "item").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "item";
}

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

async function main() {
  process.stdout.write(`${JSON.stringify(await migrateGenerationLibraryArtifacts(), null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
