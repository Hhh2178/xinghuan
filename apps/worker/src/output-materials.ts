import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
let postgresPoolPromise: Promise<import("pg").Pool> | null = null;

interface ResourceCategory {
  id: string;
  kind: ResourceKind;
  name: string;
  createdAt: number;
  updatedAt: number;
}

type ResourceKind = "image" | "video" | "audio" | "set" | "pose" | "workflow";

interface ResourceItem {
  id: string;
  kind: ResourceKind;
  title: string;
  url?: string;
  sourceUrl?: string;
  originalName?: string;
  fileUrl?: string;
  fileRel?: string;
  mime?: string;
  size?: number;
  categoryId?: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  sourceNodeId?: string;
  sourceCanvasId?: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
}

interface ResourceDb {
  categories: ResourceCategory[];
  items: ResourceItem[];
}

interface MaterializeTaskPayload {
  sourceNodeId?: unknown;
  sourceCanvasId?: unknown;
}

interface MaterializeTask {
  id: string;
  ownerId: string;
  title: string;
  providerId: string;
  providerName: string;
  modelRecordId: string;
  providerModelId: string;
  modelDisplayName: string;
  payload: MaterializeTaskPayload & Record<string, unknown>;
}

interface MaterializeTaskOutputsArgs {
  dataDir: string;
  task: MaterializeTask;
  result: Record<string, unknown>;
}

interface SavedOutput {
  filename: string;
  fileUrl: string;
  size: number;
  mime: string;
  sourceUrl: string;
}

export async function materializeTaskOutputs({ dataDir, task, result }: MaterializeTaskOutputsArgs) {
  if (!safeText(task.ownerId)) throw new Error("任务缺少 ownerId，无法写入输出素材");

  const imageUrls = readStringList(result.imageUrls);
  const videoUrls = readStringList(result.videoUrls);
  const audioUrls = readStringList(result.audioUrls);
  if (imageUrls.length === 0 && videoUrls.length === 0 && audioUrls.length === 0) {
    return {
      resourceItems: [] as ResourceItem[],
      resultPatch: {
        resourceItemIds: [],
        resourceCount: 0,
        materializedImageUrls: [],
        materializedVideoUrls: [],
        materializedAudioUrls: [],
      },
    };
  }

  const dirs = userDataDirs(dataDir, task.ownerId);
  await ensureUserDataDirs(dirs);
  const createdAt = Date.now();
  const resourceItems: ResourceItem[] = [];

  for (const [index, sourceUrl] of imageUrls.entries()) {
    const saved = await materializeImageOutput(sourceUrl, dirs.outputDir, task.id, index);
    resourceItems.push({
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "image",
      title: buildResourceTitle(task.title, index, imageUrls.length),
      url: saved.sourceUrl,
      sourceUrl: saved.sourceUrl,
      originalName: saved.filename,
      fileUrl: saved.fileUrl,
      fileRel: saved.fileUrl,
      mime: saved.mime,
      size: saved.size,
      categoryId: "",
      tags: buildTaskTags(task),
      favorite: false,
      createdAt,
      updatedAt: createdAt,
      sourceNodeId: safeText(task.payload.sourceNodeId),
      sourceCanvasId: safeText(task.payload.sourceCanvasId),
      taskId: task.id,
      providerId: task.providerId,
      modelId: task.providerModelId || task.modelRecordId,
    });
  }

  for (const [index, sourceUrl] of videoUrls.entries()) {
    const saved = await materializeVideoOutput(sourceUrl, dirs.outputDir, task.id, index);
    resourceItems.push({
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "video",
      title: buildResourceTitle(task.title, imageUrls.length + index, imageUrls.length + videoUrls.length),
      url: saved.sourceUrl,
      sourceUrl: saved.sourceUrl,
      originalName: saved.filename,
      fileUrl: saved.fileUrl,
      fileRel: saved.fileUrl,
      mime: saved.mime,
      size: saved.size,
      categoryId: "",
      tags: buildTaskTags(task),
      favorite: false,
      createdAt,
      updatedAt: createdAt,
      sourceNodeId: safeText(task.payload.sourceNodeId),
      sourceCanvasId: safeText(task.payload.sourceCanvasId),
      taskId: task.id,
      providerId: task.providerId,
      modelId: task.providerModelId || task.modelRecordId,
    });
  }

  for (const [index, sourceUrl] of audioUrls.entries()) {
    const saved = await materializeAudioOutput(sourceUrl, dirs.outputDir, task.id, index);
    resourceItems.push({
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "audio",
      title: buildResourceTitle(task.title, imageUrls.length + videoUrls.length + index, imageUrls.length + videoUrls.length + audioUrls.length),
      url: saved.sourceUrl,
      sourceUrl: saved.sourceUrl,
      originalName: saved.filename,
      fileUrl: saved.fileUrl,
      fileRel: saved.fileUrl,
      mime: saved.mime,
      size: saved.size,
      categoryId: "",
      tags: buildTaskTags(task),
      favorite: false,
      createdAt,
      updatedAt: createdAt,
      sourceNodeId: safeText(task.payload.sourceNodeId),
      sourceCanvasId: safeText(task.payload.sourceCanvasId),
      taskId: task.id,
      providerId: task.providerId,
      modelId: task.providerModelId || task.modelRecordId,
    });
  }

  if (usePostgresResourceRepository()) {
    await writeTaskOutputResourcesToPostgres(task.ownerId, task.id, resourceItems);
  } else {
    const db = await readResourceDb(dirs.resourceDbPath);
    const retainedItems = db.items.filter((item) => safeText(item.taskId) !== task.id);
    await writeResourceDb(
      {
        categories: Array.isArray(db.categories) ? db.categories : [],
        items: [...resourceItems, ...retainedItems],
      },
      dirs.resourceDbPath,
    );
  }

  return {
    resourceItems,
    resultPatch: {
      resourceItemIds: resourceItems.map((item) => item.id),
      resourceCount: resourceItems.length,
      materializedImageUrls: resourceItems.filter((item) => item.kind === "image").map((item) => item.fileUrl || item.url).filter(Boolean),
      materializedVideoUrls: resourceItems.filter((item) => item.kind === "video").map((item) => item.fileUrl || item.url).filter(Boolean),
      materializedAudioUrls: resourceItems.filter((item) => item.kind === "audio").map((item) => item.fileUrl || item.url).filter(Boolean),
    },
  };
}

function userDataDirs(dataDir: string, ownerId: string) {
  const baseDir = join(dataDir, "users", safeUserId(ownerId));
  const outputDir = join(baseDir, "output");
  const resourceDir = join(baseDir, "resources");
  return {
    outputDir,
    resourceDir,
    resourceDbPath: join(resourceDir, "resource-library.json"),
  };
}

async function ensureUserDataDirs(dirs: ReturnType<typeof userDataDirs>) {
  await mkdir(dirs.outputDir, { recursive: true });
  await mkdir(dirs.resourceDir, { recursive: true });
}

async function readResourceDb(resourceDbPath: string): Promise<ResourceDb> {
  try {
    const parsed = JSON.parse(await readFile(resourceDbPath, "utf-8")) as ResourceDb;
    return {
      categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return { categories: [], items: [] };
  }
}

async function writeResourceDb(db: ResourceDb, resourceDbPath: string) {
  await writeFile(resourceDbPath, JSON.stringify(db, null, 2), "utf-8");
}

function usePostgresResourceRepository() {
  return storageDriver === "postgres" && Boolean(databaseUrl);
}

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  postgresPoolPromise ??= import("pg").then((pg) => {
    const { Pool } = pg.default || pg;
    return new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 3,
    });
  });
  return postgresPoolPromise;
}

function resourceItemMetadata(item: ResourceItem) {
  return {
    sourceUrl: item.sourceUrl || "",
    originalName: item.originalName || "",
    fileUrl: item.fileUrl || "",
    fileRel: item.fileRel || "",
    sourceNodeId: item.sourceNodeId || "",
    sourceCanvasId: item.sourceCanvasId || "",
    taskId: item.taskId || "",
    providerId: item.providerId || "",
    modelId: item.modelId || "",
  };
}

function millisToDate(value: number | undefined) {
  return new Date(typeof value === "number" && Number.isFinite(value) ? value : Date.now());
}

async function writeTaskOutputResourcesToPostgres(ownerId: string, taskId: string, resourceItems: ResourceItem[]) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from xh_assets where owner_id = $1 and metadata ->> 'taskId' = $2", [ownerId, taskId]);
    for (const item of resourceItems) {
      await client.query(
        `insert into xh_assets (id, owner_id, project_id, kind, title, url, mime, size_bytes, metadata, category_id, tags, favorite, last_used_at, created_at, updated_at)
         values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14)`,
        [
          item.id,
          ownerId,
          item.kind,
          safeText(item.title, "资源"),
          item.url || "",
          item.mime || "",
          Number(item.size) || 0,
          JSON.stringify(resourceItemMetadata(item)),
          item.categoryId || null,
          JSON.stringify(Array.isArray(item.tags) ? item.tags.map((tag) => safeText(tag)).filter(Boolean) : []),
          Boolean(item.favorite),
          null,
          millisToDate(item.createdAt),
          millisToDate(item.updatedAt),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function materializeImageOutput(sourceUrl: string, outputDir: string, taskId: string, index: number): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  const dataUrlMatch = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(sourceUrl);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const ext = imageExtensionFromMime(mime) || "png";
    const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    await writeFile(join(outputDir, filename), buffer);
    return {
      filename,
      fileUrl: `/files/output/${filename}`,
      size: buffer.length,
      mime,
      sourceUrl,
    };
  }

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(`暂不支持的输出 URL: ${sourceUrl.slice(0, 120)}`);
  }

  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(120000) });
  if (!upstream.ok) throw new Error(`下载输出素材失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("image/")) throw new Error(`输出素材不是图片: ${mime || "unknown"}`);
  const ext = imageExtensionFromMime(mime) || imageExtensionFromUrl(sourceUrl) || "png";
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  const buffer = Buffer.from(await upstream.arrayBuffer());
  await writeFile(join(outputDir, filename), buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: buffer.length,
    mime,
    sourceUrl,
  };
}

async function materializeVideoOutput(sourceUrl: string, outputDir: string, taskId: string, index: number): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(`暂不支持的输出视频 URL: ${sourceUrl.slice(0, 120)}`);
  }

  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(180000) });
  if (!upstream.ok) throw new Error(`下载输出视频失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("video/")) throw new Error(`输出素材不是视频: ${mime || "unknown"}`);
  const ext = videoExtensionFromMime(mime) || videoExtensionFromUrl(sourceUrl) || "mp4";
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  const buffer = Buffer.from(await upstream.arrayBuffer());
  await writeFile(join(outputDir, filename), buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: buffer.length,
    mime,
    sourceUrl,
  };
}

async function materializeAudioOutput(sourceUrl: string, outputDir: string, taskId: string, index: number): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  const dataUrlMatch = /^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i.exec(sourceUrl);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const ext = audioExtensionFromMime(mime) || "wav";
    const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    await writeFile(join(outputDir, filename), buffer);
    return {
      filename,
      fileUrl: `/files/output/${filename}`,
      size: buffer.length,
      mime,
      sourceUrl,
    };
  }

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(`暂不支持的输出音频 URL: ${sourceUrl.slice(0, 120)}`);
  }

  const upstream = await fetch(sourceUrl, { signal: AbortSignal.timeout(180000) });
  if (!upstream.ok) throw new Error(`下载输出音频失败 ${upstream.status}`);
  const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("audio/")) throw new Error(`输出素材不是音频: ${mime || "unknown"}`);
  const ext = audioExtensionFromMime(mime) || audioExtensionFromUrl(sourceUrl) || "mp3";
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  const buffer = Buffer.from(await upstream.arrayBuffer());
  await writeFile(join(outputDir, filename), buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: buffer.length,
    mime,
    sourceUrl,
  };
}

async function tryReadLocalOutput(sourceUrl: string, outputDir: string) {
  const filename = decodeOutputFilename(sourceUrl);
  if (!filename) return null;
  const targetPath = join(outputDir, filename);
  const info = await stat(targetPath).catch(() => null);
  if (!info?.isFile()) return null;
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: info.size,
    mime: inferMime(filename),
    sourceUrl,
  };
}

function tryResolveLocalOutput(sourceUrl: string, outputDir: string) {
  if (!sourceUrl.startsWith("/files/output/") && !sourceUrl.startsWith("/output/")) return null;
  return tryReadLocalOutput(sourceUrl, outputDir);
}

function decodeOutputFilename(sourceUrl: string) {
  if (sourceUrl.startsWith("/files/output/")) return decodeURIComponent(sourceUrl.slice("/files/output/".length));
  if (sourceUrl.startsWith("/output/")) return decodeURIComponent(sourceUrl.slice("/output/".length));
  return "";
}

function buildResourceTitle(taskTitle: string, index: number, total: number) {
  const base = safeText(taskTitle, "输出素材");
  return total > 1 ? `${base} #${index + 1}` : base;
}

function buildTaskTags(task: MaterializeTask) {
  return [
    "task-output",
    safeText(task.providerName),
    safeText(task.modelDisplayName || task.providerModelId),
  ].filter(Boolean);
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean) : [];
}

function safeUserId(value: unknown) {
  return String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function safeFilename(value: unknown, fallback = "file") {
  const normalized = String(value || "").trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_").replace(/\s+/g, "_");
  return normalized.replace(/_+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function safeText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function inferMime(filename: string) {
  const ext = extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".m4v") return "video/x-m4v";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function imageExtensionFromMime(mime: string) {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "";
}

function imageExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "";
  } catch {
    return "";
  }
}

function videoExtensionFromMime(mime: string) {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/x-m4v") return "m4v";
  return "";
}

function videoExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["mp4", "webm", "mov", "m4v"].includes(ext) ? ext : "";
  } catch {
    return "";
  }
}

function audioExtensionFromMime(mime: string) {
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/mp4" || mime === "audio/x-m4a") return "m4a";
  return "";
}

function audioExtensionFromUrl(sourceUrl: string) {
  try {
    const ext = extname(new URL(sourceUrl).pathname).replace(/^\./, "").toLowerCase();
    return ["mp3", "wav", "ogg", "m4a"].includes(ext) ? ext : "";
  } catch {
    return "";
  }
}
