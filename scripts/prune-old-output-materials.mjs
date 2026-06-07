import { readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const defaultDataDir = process.env.XINGHUAN_DATA_DIR || join(process.cwd(), "apps", "api", "data");
const defaultRetentionDays = clampDays(process.env.XINGHUAN_OUTPUT_MATERIAL_RETENTION_DAYS || "14");
const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
let pgPoolPromise = null;

export async function pruneOldOutputMaterials({
  dataDir = defaultDataDir,
  retentionDays = defaultRetentionDays,
  now = Date.now(),
  apply = false,
} = {}) {
  if (storageDriver === "postgres" && databaseUrl) {
    return pruneOldOutputMaterialsPostgres({ dataDir, retentionDays, now, apply });
  }
  const usersDir = join(dataDir, "users");
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const userEntries = await readdir(usersDir, { withFileTypes: true }).catch(() => []);

  const summary = {
    ok: true,
    apply,
    dataDir,
    retentionDays,
    cutoff,
    scannedUsers: 0,
    scannedItems: 0,
    deletedItemIds: [],
    deletedFiles: [],
    skipped: [],
  };

  for (const entry of userEntries) {
    if (!entry.isDirectory()) continue;
    summary.scannedUsers += 1;

    const userId = entry.name;
    const outputDir = join(usersDir, userId, "output");
    const resourceDbPath = join(usersDir, userId, "resources", "resource-library.json");
    const db = await readResourceDb(resourceDbPath);
    const evaluations = db.items.map((item) => evaluateItem(item, outputDir, cutoff));
    summary.scannedItems += evaluations.length;

    const retainedRefs = new Set(
      evaluations
        .filter((entry) => !entry.eligible && entry.fileUrl)
        .map((entry) => entry.fileUrl),
    );

    const nextItems = [];
    const deletedFileUrls = new Set();

    for (const evaluation of evaluations) {
      if (!evaluation.eligible) {
        nextItems.push(evaluation.item);
        if (evaluation.reason && evaluation.reason !== "not_old_enough" && evaluation.reason !== "not_task_output") {
          summary.skipped.push({
            userId,
            itemId: evaluation.item.id,
            fileUrl: evaluation.fileUrl || "",
            reason: evaluation.reason,
          });
        }
        continue;
      }

      summary.deletedItemIds.push(evaluation.item.id);
      if (!apply) {
        nextItems.push(evaluation.item);
        continue;
      }

      if (evaluation.fileUrl && retainedRefs.has(evaluation.fileUrl)) {
        summary.skipped.push({
          userId,
          itemId: evaluation.item.id,
          fileUrl: evaluation.fileUrl,
          reason: "shared_file_kept",
        });
        continue;
      }

      if (evaluation.fileUrl && evaluation.filePath && !deletedFileUrls.has(evaluation.fileUrl)) {
        const exists = await stat(evaluation.filePath).then((info) => info.isFile()).catch(() => false);
        if (exists) {
          await unlink(evaluation.filePath);
          summary.deletedFiles.push(evaluation.fileUrl);
          deletedFileUrls.add(evaluation.fileUrl);
        } else {
          summary.skipped.push({
            userId,
            itemId: evaluation.item.id,
            fileUrl: evaluation.fileUrl,
            reason: "file_missing",
          });
        }
      }
    }

    if (apply && nextItems.length !== db.items.length) {
      await writeResourceDb({ categories: db.categories, items: nextItems }, resourceDbPath);
    }
  }

  return summary;
}

async function pruneOldOutputMaterialsPostgres({ dataDir, retentionDays, now, apply }) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const pool = await getPostgresPool();
  const result = await pool.query(
    `select
       a.owner_id,
       a.id,
       a.kind,
       a.title,
       a.url,
       a.mime,
       a.size_bytes,
       a.category_id,
       a.tags,
       a.favorite,
       a.last_used_at,
       a.metadata,
       a.created_at,
       a.updated_at,
       c.id as resource_category_id
     from xh_assets a
     left join xh_resource_categories c on c.id = a.category_id
     order by a.owner_id asc, a.created_at desc`,
  );

  const summary = {
    ok: true,
    apply,
    dataDir,
    retentionDays,
    cutoff,
    scannedUsers: 0,
    scannedItems: 0,
    deletedItemIds: [],
    deletedFiles: [],
    skipped: [],
  };

  const itemsByUser = new Map();
  for (const row of result.rows) {
    const ownerId = safeText(row.owner_id);
    if (!ownerId) continue;
    const entries = itemsByUser.get(ownerId) || [];
    entries.push(toResourceItem(row));
    itemsByUser.set(ownerId, entries);
  }

  summary.scannedUsers = itemsByUser.size;

  for (const [userId, items] of itemsByUser.entries()) {
    const outputDir = join(dataDir, "users", userId, "output");
    const evaluations = items.map((item) => evaluateItem(item, outputDir, cutoff));
    summary.scannedItems += evaluations.length;

    const retainedRefs = new Set(
      evaluations
        .filter((entry) => !entry.eligible && entry.fileUrl)
        .map((entry) => entry.fileUrl),
    );

    for (const evaluation of evaluations) {
      if (!evaluation.eligible) {
        if (evaluation.reason && evaluation.reason !== "not_old_enough" && evaluation.reason !== "not_task_output") {
          summary.skipped.push({
            userId,
            itemId: evaluation.item.id,
            fileUrl: evaluation.fileUrl || "",
            reason: evaluation.reason,
          });
        }
        continue;
      }

      summary.deletedItemIds.push(evaluation.item.id);
      if (!apply) continue;

      if (evaluation.fileUrl && retainedRefs.has(evaluation.fileUrl)) {
        summary.skipped.push({
          userId,
          itemId: evaluation.item.id,
          fileUrl: evaluation.fileUrl,
          reason: "shared_file_kept",
        });
      } else if (evaluation.fileUrl && evaluation.filePath) {
        const exists = await stat(evaluation.filePath).then((info) => info.isFile()).catch(() => false);
        if (exists) {
          await unlink(evaluation.filePath);
          summary.deletedFiles.push(evaluation.fileUrl);
        } else {
          summary.skipped.push({
            userId,
            itemId: evaluation.item.id,
            fileUrl: evaluation.fileUrl,
            reason: "file_missing",
          });
        }
      }

      await pool.query("delete from xh_assets where owner_id = $1 and id = $2", [userId, evaluation.item.id]);
    }
  }

  return summary;
}

async function readResourceDb(resourceDbPath) {
  try {
    const parsed = JSON.parse(await readFile(resourceDbPath, "utf-8"));
    return {
      categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return { categories: [], items: [] };
  }
}

async function writeResourceDb(db, resourceDbPath) {
  await writeFile(resourceDbPath, JSON.stringify(db, null, 2), "utf-8");
}

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  pgPoolPromise ??= import("pg").then((pg) => {
    const { Pool } = pg.default || pg;
    return new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 3,
    });
  });
  return pgPoolPromise;
}

function toMillisFromDate(value) {
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toResourceItem(row) {
  const metadata = plainObject(row.metadata);
  return {
    id: row.id,
    kind: safeText(row.kind),
    title: safeText(row.title),
    url: safeText(row.url),
    sourceUrl: safeText(metadata.sourceUrl || row.url),
    originalName: safeText(metadata.originalName),
    fileUrl: safeText(metadata.fileUrl),
    fileRel: safeText(metadata.fileRel),
    mime: safeText(row.mime),
    size: Number(row.size_bytes) || 0,
    categoryId: safeText(row.category_id),
    tags: Array.isArray(row.tags) ? row.tags.map((tag) => safeText(tag)).filter(Boolean) : [],
    favorite: Boolean(row.favorite),
    createdAt: toMillisFromDate(row.created_at),
    updatedAt: toMillisFromDate(row.updated_at),
    lastUsedAt: row.last_used_at ? toMillisFromDate(row.last_used_at) : 0,
    taskId: safeText(metadata.taskId),
  };
}

function evaluateItem(item, outputDir, cutoff) {
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => safeText(tag)).filter(Boolean) : [];
  const activityAt = Math.max(toMillis(item?.lastUsedAt), toMillis(item?.updatedAt), toMillis(item?.createdAt));
  const fileUrl = safeText(item?.fileUrl || item?.fileRel || item?.url);
  const safeTarget = resolveOutputPath(fileUrl, outputDir);

  if (!tags.includes("task-output")) return { item, eligible: false, reason: "not_task_output", fileUrl, filePath: safeTarget?.path || "" };
  if (!safeText(item?.taskId)) return { item, eligible: false, reason: "missing_task_id", fileUrl, filePath: safeTarget?.path || "" };
  if (Boolean(item?.favorite)) return { item, eligible: false, reason: "favorited", fileUrl, filePath: safeTarget?.path || "" };
  if (safeText(item?.categoryId)) return { item, eligible: false, reason: "categorized", fileUrl, filePath: safeTarget?.path || "" };
  if (activityAt >= cutoff) return { item, eligible: false, reason: "not_old_enough", fileUrl, filePath: safeTarget?.path || "" };
  if (!safeTarget?.ok) return { item, eligible: false, reason: "unsafe_output_path", fileUrl, filePath: "" };

  return {
    item,
    eligible: true,
    reason: "",
    fileUrl,
    filePath: safeTarget.path,
  };
}

function resolveOutputPath(fileUrl, outputDir) {
  const filename = decodeOutputFilename(fileUrl);
  if (!filename) return { ok: false, path: "" };
  const outputRoot = resolve(outputDir);
  const target = resolve(outputDir, filename);
  const boundary = `${outputRoot}${sep}`;
  if (target !== outputRoot && !target.startsWith(boundary)) return { ok: false, path: "" };
  return { ok: true, path: target };
}

function decodeOutputFilename(fileUrl) {
  if (fileUrl.startsWith("/files/output/")) return decodeURIComponent(fileUrl.slice("/files/output/".length));
  if (fileUrl.startsWith("/output/")) return decodeURIComponent(fileUrl.slice("/output/".length));
  return "";
}

function safeText(value) {
  return String(value ?? "").trim();
}

function toMillis(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function clampDays(value) {
  const number = Number.parseInt(String(value || "14"), 10);
  if (!Number.isFinite(number) || number < 1) return 14;
  return Math.min(number, 3650);
}

function parseCli(argv) {
  const options = {
    dataDir: defaultDataDir,
    retentionDays: defaultRetentionDays,
    apply: false,
  };
  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg.startsWith("--days=")) {
      options.retentionDays = clampDays(arg.slice("--days=".length));
      continue;
    }
    if (arg.startsWith("--data-dir=")) {
      options.dataDir = arg.slice("--data-dir=".length) || options.dataDir;
      continue;
    }
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const summary = await pruneOldOutputMaterials(options);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
