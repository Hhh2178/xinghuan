import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const defaultDataDir = process.env.XINGHUAN_DATA_DIR || join(process.cwd(), "apps", "api", "data");
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";

export async function reconcileGenerationArtifacts(options = {}) {
  const dataDir = options.dataDir || defaultDataDir;
  const now = options.now ?? Date.now();
  const apply = Boolean(options.apply);
  if ((options.storageDriver || storageDriver) === "postgres" && (options.databaseUrl || databaseUrl)) {
    return reconcilePostgres({ dataDir, now, apply, databaseUrl: options.databaseUrl || databaseUrl, pool: options.pool });
  }
  return reconcileFiles({ dataDir, now, apply });
}

async function reconcilePostgres({ dataDir, now, apply, databaseUrl, pool: injectedPool }) {
  const pool = injectedPool || await createPool(databaseUrl);
  const summary = baseSummary("postgres", dataDir, now, apply);
  try {
    const result = await pool.query(
      `select id, owner_id, status, file_url, storage_key, promoted_asset_id, expires_at
       from xh_generation_artifacts
       where status in ('active', 'promoted', 'expired', 'deleted')
       order by owner_id, created_at`,
    );
    summary.scannedItems = result.rows.length;
    summary.scannedUsers = new Set(result.rows.map((row) => String(row.owner_id))).size;
    for (const row of result.rows) {
      const candidate = await evaluate(row, dataDir, now);
      if (!candidate.action) continue;
      if (candidate.deleteBinary && await hasResourceAssetReference(pool, row, candidate)) {
        if (!summary.protectedFiles.includes(candidate.fileUrl)) summary.protectedFiles.push(candidate.fileUrl);
        continue;
      }
      summary.candidates.push(candidate);
      if (!apply) continue;
      const claimed = await pool.query(
        `update xh_generation_artifacts
         set status = $3, updated_at = now()
         where id = $1 and owner_id = $2 and status = $4
           and promoted_asset_id is not distinct from $5
         returning id`,
        [candidate.id, candidate.ownerId, candidate.nextStatus, candidate.currentStatus, candidate.promotedAssetId || null],
      );
      if (!claimed.rows[0]) continue;
      if (candidate.deleteBinary) {
        if (!await hasResourceAssetReference(pool, row, candidate) && candidate.absolutePath) {
          const removed = await unlink(candidate.absolutePath).then(() => true).catch(() => false);
          if (removed) summary.deletedFiles.push(candidate.fileUrl);
          else summary.deletionFailures.push(candidate.fileUrl);
        }
      }
      summary.updatedIds.push(candidate.id);
    }
    for (const ownerId of new Set(result.rows.map((row) => text(row.owner_id)))) {
      const registered = new Set(result.rows.filter((row) => text(row.owner_id) === ownerId).map((row) => text(row.storage_key)).filter(Boolean));
      summary.orphanFiles.push(...await findOutputOrphans(dataDir, ownerId, registered));
    }
    return summary;
  } finally {
    if (!injectedPool) await pool.end();
  }
}

async function reconcileFiles({ dataDir, now, apply }) {
  const summary = baseSummary("file", dataDir, now, apply);
  const usersDir = join(dataDir, "users");
  const users = await readdir(usersDir, { withFileTypes: true }).catch(() => []);
  for (const entry of users) {
    if (!entry.isDirectory()) continue;
    summary.scannedUsers += 1;
    const ownerId = entry.name;
    const path = join(usersDir, ownerId, "resources", "generation-library.json");
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") summary.corruptFiles.push({ ownerId, path, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    summary.scannedItems += items.length;
    const nextItems = [];
    let changed = false;
    for (const item of items) {
      if (!item || !["active", "promoted", "expired", "deleted"].includes(text(item.status, "active"))) {
        nextItems.push(item);
        continue;
      }
      const row = {
        id: item.id,
        owner_id: ownerId,
        status: text(item.status, "active"),
        file_url: text(item.fileUrl || item.url),
        storage_key: text(item.storageKey),
        promoted_asset_id: text(item.promotedAssetId),
        expires_at: new Date(Number(item.expiresAt) || 0),
      };
      const candidate = await evaluate(row, dataDir, now);
      if (!candidate.action) {
        nextItems.push(item);
        continue;
      }
      summary.candidates.push(candidate);
      if (!apply) {
        nextItems.push(item);
        continue;
      }
      if (candidate.deleteBinary && candidate.absolutePath) {
        const removed = await unlink(candidate.absolutePath).then(() => true).catch(() => false);
        if (removed) summary.deletedFiles.push(candidate.fileUrl);
        else summary.deletionFailures.push(candidate.fileUrl);
      }
      nextItems.push({ ...item, status: candidate.nextStatus, updatedAt: now });
      summary.updatedIds.push(candidate.id);
      changed = true;
    }
    const registered = new Set(items.map((item) => text(item?.storageKey, outputStorageKey(text(item?.fileUrl || item?.url)))).filter(Boolean));
    summary.orphanFiles.push(...await findOutputOrphans(dataDir, ownerId, registered));
    if (apply && changed) await atomicWrite(path, { items: nextItems });
  }
  return summary;
}

async function evaluate(row, dataDir, now) {
  const ownerId = text(row.owner_id);
  const fileUrl = text(row.file_url);
  const storageKey = text(row.storage_key, outputStorageKey(fileUrl));
  const absolutePath = safeOutputPath(dataDir, ownerId, storageKey);
  const exists = absolutePath ? await stat(absolutePath).then((info) => info.isFile()).catch(() => false) : false;
  const expiresAt = new Date(row.expires_at).getTime();
  const currentStatus = text(row.status, "active");
  const promotedAssetId = text(row.promoted_asset_id);
  if (currentStatus === "deleted") {
    if (!promotedAssetId && exists) {
      return {
        action: "delete_deleted_binary",
        id: text(row.id),
        ownerId,
        fileUrl,
        absolutePath,
        currentStatus,
        promotedAssetId,
        nextStatus: "deleted",
        deleteBinary: true,
      };
    }
    return { action: "" };
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    if (currentStatus === "expired") {
      if (!promotedAssetId && exists) {
        return {
          action: "delete_expired_binary",
          id: text(row.id),
          ownerId,
          fileUrl,
          absolutePath,
          currentStatus,
          promotedAssetId,
          nextStatus: "expired",
          deleteBinary: true,
        };
      }
      return { action: "" };
    }
    return {
      action: "expire",
      id: text(row.id),
      ownerId,
      fileUrl,
      absolutePath,
      currentStatus,
      promotedAssetId,
      nextStatus: "expired",
      deleteBinary: !promotedAssetId && exists,
    };
  }
  if (!exists) {
    return {
      action: "mark_missing",
      id: text(row.id),
      ownerId,
      fileUrl,
      absolutePath,
      currentStatus,
      promotedAssetId,
      nextStatus: "missing",
      deleteBinary: false,
    };
  }
  return { action: "" };
}

function safeOutputPath(dataDir, ownerId, storageKey) {
  if (!ownerId || !storageKey || /[\\/]/.test(storageKey) || storageKey.includes("..")) return "";
  const outputRoot = resolve(dataDir, "users", ownerId, "output");
  const target = resolve(outputRoot, storageKey);
  return target.startsWith(`${outputRoot}${sep}`) ? target : "";
}

function baseSummary(driver, dataDir, now, apply) {
  return {
    ok: true,
    driver,
    apply,
    dataDir,
    evaluatedAt: new Date(now).toISOString(),
    scannedUsers: 0,
    scannedItems: 0,
    candidates: [],
    updatedIds: [],
    deletedFiles: [],
    deletionFailures: [],
    protectedFiles: [],
    orphanFiles: [],
    corruptFiles: [],
  };
}

async function hasResourceAssetReference(pool, row, candidate) {
  const refs = await pool.query(
    `select count(*)::int as count from xh_assets
     where owner_id = $1 and (id = $2 or metadata ->> 'fileUrl' = $3 or metadata ->> 'fileRel' = $3)`,
    [candidate.ownerId, text(row.promoted_asset_id), candidate.fileUrl],
  );
  return Number(refs.rows[0]?.count) > 0;
}

async function findOutputOrphans(dataDir, ownerId, registered) {
  const outputDir = resolve(dataDir, "users", ownerId, "output");
  const entries = await readdir(outputDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && !registered.has(entry.name))
    .map((entry) => `/files/output/${encodeURIComponent(entry.name)}`);
}

async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
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

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function cliOptions(argv) {
  return { apply: argv.includes("--apply") };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await reconcileGenerationArtifacts(cliOptions(process.argv.slice(2))), null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
