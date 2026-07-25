import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const INPUT_ORPHAN_GRACE_MS = DAY_MS;
const OUTPUT_ORPHAN_GRACE_MS = 3 * DAY_MS;
const defaultDataDir = process.env.XINGHUAN_DATA_DIR || join(process.cwd(), "apps", "api", "data");
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";

export async function reconcileGenerationArtifacts(options = {}) {
  const dataDir = options.dataDir || defaultDataDir;
  const now = options.now ?? Date.now();
  const apply = Boolean(options.apply);
  const driver = options.storageDriver || storageDriver;
  if (driver === "postgres" && (options.databaseUrl || databaseUrl)) {
    return reconcilePostgres({ dataDir, now, apply, databaseUrl: options.databaseUrl || databaseUrl, pool: options.pool });
  }
  return reconcileFiles({ dataDir, now, apply });
}

async function reconcilePostgres({ dataDir, now, apply, databaseUrl, pool: injectedPool }) {
  const pool = injectedPool || await createPool(databaseUrl);
  const summary = baseSummary("postgres", dataDir, now, apply);
  try {
    const [artifactResult, uploadResult, userResult] = await Promise.all([
      pool.query(
        `select id, owner_id, status, file_url, storage_key, promoted_asset_id, expires_at
         from xh_generation_artifacts
         where status in ('active', 'promoted', 'expired', 'deleted')
         order by owner_id, created_at`,
      ),
      pool.query(
        `select id, owner_id, kind, status, file_url, storage_key, expires_at
         from xh_ephemeral_uploads
         where status in ('active', 'expired', 'deleted')
         order by owner_id, created_at`,
      ),
      pool.query("select id from xh_users"),
    ]);
    const artifactRows = artifactResult.rows;
    const uploadRows = uploadResult.rows;
    const ownerIds = new Set([
      ...userResult.rows.map((row) => text(row.id)),
      ...artifactRows.map((row) => text(row.owner_id)),
      ...uploadRows.map((row) => text(row.owner_id)),
    ].filter(Boolean));
    summary.scannedUsers = ownerIds.size;
    summary.scannedItems = artifactRows.length;
    summary.scannedUploads = uploadRows.length;

    for (const row of artifactRows) {
      const candidate = await evaluateArtifact(row, dataDir, now);
      if (!candidate.action) continue;
      if (candidate.deleteBinary && await hasProtectedReference(pool, candidate.ownerId, candidate.fileUrl, row)) {
        pushUnique(summary.protectedFiles, candidate.fileUrl);
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
      await deleteCandidateBinary(candidate, summary);
      summary.updatedIds.push(candidate.id);
    }

    for (const row of uploadRows) {
      const candidate = await evaluateInput(row, dataDir, now);
      if (!candidate.action) continue;
      if (candidate.deleteBinary && await hasProtectedReference(pool, candidate.ownerId, candidate.fileUrl, row)) {
        pushUnique(summary.protectedFiles, candidate.fileUrl);
        continue;
      }
      summary.candidates.push(candidate);
      if (!apply) continue;
      const claimed = await pool.query(
        `update xh_ephemeral_uploads
         set status = $3, updated_at = now()
         where id = $1 and owner_id = $2 and status = $4
         returning id`,
        [candidate.id, candidate.ownerId, candidate.nextStatus, candidate.currentStatus],
      );
      if (!claimed.rows[0]) continue;
      await deleteCandidateBinary(candidate, summary);
      if (candidate.deleteBinary && summary.deletedFiles.includes(candidate.fileUrl)) {
        await pool.query(
          "update xh_ephemeral_uploads set status = 'deleted', deleted_at = now(), updated_at = now() where id = $1 and owner_id = $2",
          [candidate.id, candidate.ownerId],
        );
      }
      summary.updatedIds.push(candidate.id);
    }

    for (const ownerId of ownerIds) {
      const registeredOutputs = new Set(artifactRows.filter((row) => text(row.owner_id) === ownerId).map((row) => text(row.storage_key)).filter(Boolean));
      const registeredInputs = new Set(uploadRows.filter((row) => text(row.owner_id) === ownerId).map((row) => text(row.storage_key)).filter(Boolean));
      await sweepOrphans({ pool, dataDir, ownerId, bucket: "output", registered: registeredOutputs, graceMs: OUTPUT_ORPHAN_GRACE_MS, now, apply, summary });
      await sweepOrphans({ pool, dataDir, ownerId, bucket: "input", registered: registeredInputs, graceMs: INPUT_ORPHAN_GRACE_MS, now, apply, summary });
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
    const resourcesDir = join(usersDir, ownerId, "resources");
    const artifactPath = join(resourcesDir, "generation-library.json");
    const uploadManifestPath = join(resourcesDir, "ephemeral-uploads.json");
    const artifactDb = await readJsonDb(artifactPath, { items: [] }, summary, ownerId);
    const uploadDb = await readJsonDb(uploadManifestPath, { items: [] }, summary, ownerId);
    const artifactItems = Array.isArray(artifactDb.items) ? artifactDb.items : [];
    const uploadItems = Array.isArray(uploadDb.items) ? uploadDb.items : [];
    summary.scannedItems += artifactItems.length;
    summary.scannedUploads += uploadItems.length;
    const nextArtifacts = [];
    const nextUploads = [];
    let artifactsChanged = false;
    let uploadsChanged = false;

    for (const item of artifactItems) {
      const row = {
        id: item?.id,
        owner_id: ownerId,
        status: text(item?.status, "active"),
        file_url: text(item?.fileUrl || item?.url),
        storage_key: text(item?.storageKey),
        promoted_asset_id: text(item?.promotedAssetId),
        expires_at: new Date(Number(item?.expiresAt) || 0),
      };
      const candidate = await evaluateArtifact(row, dataDir, now);
      if (!candidate.action) {
        nextArtifacts.push(item);
        continue;
      }
      if (candidate.deleteBinary && await hasFileReference(dataDir, ownerId, candidate.fileUrl)) {
        pushUnique(summary.protectedFiles, candidate.fileUrl);
        nextArtifacts.push(item);
        continue;
      }
      summary.candidates.push(candidate);
      if (!apply) {
        nextArtifacts.push(item);
        continue;
      }
      await deleteCandidateBinary(candidate, summary);
      nextArtifacts.push({ ...item, status: candidate.nextStatus, updatedAt: now });
      summary.updatedIds.push(candidate.id);
      artifactsChanged = true;
    }

    for (const item of uploadItems) {
      const row = {
        id: item?.id,
        owner_id: ownerId,
        status: text(item?.status, "active"),
        file_url: text(item?.fileUrl || item?.url),
        storage_key: text(item?.storageKey),
        expires_at: new Date(Number(item?.expiresAt) || 0),
      };
      const candidate = await evaluateInput(row, dataDir, now);
      if (!candidate.action) {
        nextUploads.push(item);
        continue;
      }
      if (candidate.deleteBinary && await hasFileReference(dataDir, ownerId, candidate.fileUrl)) {
        pushUnique(summary.protectedFiles, candidate.fileUrl);
        nextUploads.push(item);
        continue;
      }
      summary.candidates.push(candidate);
      if (!apply) {
        nextUploads.push(item);
        continue;
      }
      await deleteCandidateBinary(candidate, summary);
      nextUploads.push({ ...item, status: candidate.nextStatus, updatedAt: now });
      summary.updatedIds.push(candidate.id);
      uploadsChanged = true;
    }

    const registeredOutputs = new Set(artifactItems.map((item) => text(item?.storageKey, outputStorageKey(text(item?.fileUrl || item?.url)))).filter(Boolean));
    const registeredInputs = new Set(uploadItems.map((item) => text(item?.storageKey, inputStorageKey(text(item?.fileUrl || item?.url)))).filter(Boolean));
    await sweepOrphans({ dataDir, ownerId, bucket: "output", registered: registeredOutputs, graceMs: OUTPUT_ORPHAN_GRACE_MS, now, apply, summary });
    await sweepOrphans({ dataDir, ownerId, bucket: "input", registered: registeredInputs, graceMs: INPUT_ORPHAN_GRACE_MS, now, apply, summary });
    if (apply && artifactsChanged) await atomicWrite(artifactPath, { items: nextArtifacts });
    if (apply && uploadsChanged) await atomicWrite(uploadManifestPath, { items: nextUploads });
  }
  return summary;
}

async function evaluateArtifact(row, dataDir, now) {
  const ownerId = text(row.owner_id);
  const fileUrl = text(row.file_url);
  const storageKey = text(row.storage_key, outputStorageKey(fileUrl));
  const absolutePath = safeStoragePath(dataDir, ownerId, storageKey, "output");
  const exists = await isFile(absolutePath);
  const expiresAt = new Date(row.expires_at).getTime();
  const currentStatus = text(row.status, "active");
  const promotedAssetId = text(row.promoted_asset_id);
  if (currentStatus === "deleted") {
    return !promotedAssetId && exists ? candidate("delete_deleted_binary", row, absolutePath, "deleted", true) : { action: "" };
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    if (currentStatus === "expired") {
      return !promotedAssetId && exists ? candidate("delete_expired_binary", row, absolutePath, "expired", true) : { action: "" };
    }
    return candidate("expire", row, absolutePath, "expired", !promotedAssetId && exists);
  }
  if (!exists) return candidate("mark_missing", row, absolutePath, "missing", false);
  return { action: "" };
}

async function evaluateInput(row, dataDir, now) {
  const ownerId = text(row.owner_id);
  const fileUrl = text(row.file_url);
  const storageKey = text(row.storage_key, inputStorageKey(fileUrl));
  const absolutePath = safeStoragePath(dataDir, ownerId, storageKey, "input");
  const exists = await isFile(absolutePath);
  const expiresAt = new Date(row.expires_at).getTime();
  const currentStatus = text(row.status, "active");
  if (currentStatus === "deleted") return exists ? candidate("delete_deleted_input", row, absolutePath, "deleted", true) : { action: "" };
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    if (currentStatus === "expired") return exists ? candidate("delete_expired_input", row, absolutePath, "expired", true) : { action: "" };
    return candidate("expire_input", row, absolutePath, "expired", exists);
  }
  if (!exists) return candidate("mark_missing_input", row, absolutePath, "missing", false);
  return { action: "" };
}

function candidate(action, row, absolutePath, nextStatus, deleteBinary) {
  return {
    action,
    id: text(row.id),
    ownerId: text(row.owner_id),
    fileUrl: text(row.file_url),
    absolutePath,
    currentStatus: text(row.status, "active"),
    promotedAssetId: text(row.promoted_asset_id),
    nextStatus,
    deleteBinary,
  };
}

async function deleteCandidateBinary(candidate, summary) {
  if (!candidate.deleteBinary || !candidate.absolutePath) return;
  const removed = await unlink(candidate.absolutePath).then(() => true).catch(() => false);
  if (removed) summary.deletedFiles.push(candidate.fileUrl);
  else summary.deletionFailures.push(candidate.fileUrl);
}

async function sweepOrphans({ pool, dataDir, ownerId, bucket, registered, graceMs, now, apply, summary }) {
  const root = resolve(dataDir, "users", ownerId, bucket);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || registered.has(entry.name)) continue;
    const fileUrl = `/files/${bucket}/${encodeURIComponent(entry.name)}`;
    const absolutePath = safeStoragePath(dataDir, ownerId, entry.name, bucket);
    const info = await stat(absolutePath).catch(() => null);
    if (!info?.isFile()) continue;
    pushUnique(summary.orphanFiles, fileUrl);
    if (pool && await hasProtectedReference(pool, ownerId, fileUrl, { file_url: fileUrl })) {
      pushUnique(summary.protectedFiles, fileUrl);
      continue;
    }
    if (now - info.mtimeMs < graceMs || !apply) continue;
    const removed = await unlink(absolutePath).then(() => true).catch(() => false);
    if (removed) summary.deletedFiles.push(fileUrl);
    else summary.deletionFailures.push(fileUrl);
  }
}

async function hasProtectedReference(pool, ownerId, fileUrl, row) {
  const assetRefs = await pool.query(
    `select count(*)::int as count from xh_assets
     where owner_id = $1 and (id = $2 or url = $3 or metadata ->> 'fileUrl' = $3 or metadata ->> 'fileRel' = $3)`,
    [ownerId, text(row.promoted_asset_id), fileUrl],
  );
  if (Number(assetRefs.rows[0]?.count) > 0) return true;
  const taskRefs = await pool.query(
    `select 1 from xh_tasks
     where owner_id = $1 and status in ('queued', 'running')
       and (payload::text like $2 or result::text like $2)
     limit 1`,
    [ownerId, `%${fileUrl}%`],
  );
  if (taskRefs.rows[0]) return true;
  try {
    const runRefs = await pool.query(
      `select 1 from xh_canvas_run_steps
       where owner_id = $1 and status in ('queued', 'running', 'awaiting_approval')
         and (input_binding::text like $2 or output_binding::text like $2)
       limit 1`,
      [ownerId, `%${fileUrl}%`],
    );
    return Boolean(runRefs.rows[0]);
  } catch {
    return false;
  }
}

async function hasFileReference(dataDir, ownerId, fileUrl) {
  const resourcePath = join(dataDir, "users", ownerId, "resources", "resource-library.json");
  const canvasRoot = join(dataDir, "users", ownerId, "canvases");
  const resourceText = await readFile(resourcePath, "utf8").catch(() => "");
  if (resourceText.includes(fileUrl)) return true;
  const canvases = await readdir(canvasRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of canvases) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    if ((await readFile(join(canvasRoot, entry.name), "utf8").catch(() => "")).includes(fileUrl)) return true;
  }
  return false;
}

async function readJsonDb(path, fallback, summary, ownerId) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") summary.corruptFiles.push({ ownerId, path, error: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}

async function isFile(path) {
  return Boolean(path) && await stat(path).then((info) => info.isFile()).catch(() => false);
}

function safeStoragePath(dataDir, ownerId, storageKey, bucket) {
  if (!ownerId || !storageKey || /[\\/]/.test(storageKey) || storageKey.includes("..")) return "";
  const root = resolve(dataDir, "users", ownerId, bucket);
  const target = resolve(root, storageKey);
  return target.startsWith(`${root}${sep}`) ? target : "";
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
    scannedUploads: 0,
    candidates: [],
    updatedIds: [],
    deletedFiles: [],
    deletionFailures: [],
    protectedFiles: [],
    orphanFiles: [],
    corruptFiles: [],
  };
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

function inputStorageKey(fileUrl) {
  if (fileUrl.startsWith("/files/input/")) return decodeURIComponent(fileUrl.slice("/files/input/".length));
  if (fileUrl.startsWith("/input/")) return decodeURIComponent(fileUrl.slice("/input/".length));
  return fileUrl;
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
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
