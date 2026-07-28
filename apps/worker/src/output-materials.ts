import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import {
  GENERATION_ARTIFACT_TTL_MS,
  buildGenerationArtifactDedupeKey,
  buildGenerationExecutionProvenance,
  buildTaskGenerationArtifactId,
  generationArtifactStorageKey,
  resolvePostgresPoolConfig,
  type GenerationArtifact,
  type GenerationArtifactKind,
  type UnifiedFailureCategory,
} from "@xinghuan/shared";

const storageDriver = process.env.XINGHUAN_STORAGE_DRIVER === "postgres" ? "postgres" : "file";
const databaseUrl = process.env.DATABASE_URL || process.env.XINGHUAN_DATABASE_URL || "";
let postgresPoolPromise: Promise<import("pg").Pool> | null = null;
const generationFileQueues = new Map<string, Promise<unknown>>();

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

export class OutputMaterializationError extends Error {
  readonly resultPatch: Record<string, unknown>;
  readonly status?: number;

  constructor(message: string, resultPatch: Record<string, unknown>, status?: number) {
    super(message);
    this.name = "OutputMaterializationError";
    this.resultPatch = resultPatch;
    this.status = status;
  }
}

interface OutputFetchContext {
  origin: string;
  headers: Record<string, string>;
}

const outputFetchContextSymbol = Symbol("xinghuan.outputFetchContext");

export function attachOutputFetchContext<T extends object>(
  result: T,
  context: OutputFetchContext,
): T {
  const origin = normalizeHttpOrigin(context.origin);
  const headers = normalizeOutputFetchHeaders(context.headers);
  if (!origin || Object.keys(headers).length === 0) return result;
  Object.defineProperty(result, outputFetchContextSymbol, {
    value: { origin, headers } satisfies OutputFetchContext,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return result;
}

export function inheritOutputFetchContext<T extends object>(
  result: T,
  sources: object | object[],
): T {
  for (const source of Array.isArray(sources) ? sources : [sources]) {
    const context = (source as { [outputFetchContextSymbol]?: OutputFetchContext })[outputFetchContextSymbol];
    if (context) return attachOutputFetchContext(result, context);
  }
  return result;
}

export async function materializeTaskOutputs({ dataDir, task, result }: MaterializeTaskOutputsArgs) {
  if (!safeText(task.ownerId)) throw new Error("任务缺少 ownerId，无法写入输出素材");

  const imageUrls = readStringList(result.imageUrls);
  const videoUrls = readStringList(result.videoUrls);
  const audioUrls = readStringList(result.audioUrls);
  if (imageUrls.length === 0 && videoUrls.length === 0 && audioUrls.length === 0) {
    return {
      artifacts: [] as GenerationArtifact[],
      resourceItems: [] as GenerationArtifact[],
      resultPatch: {
        generationArtifactIds: [],
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
  const artifacts: GenerationArtifact[] = [];

  for (const [index, sourceUrl] of imageUrls.entries()) {
    const saved = await materializeImageOutput(
      sourceUrl,
      dirs.outputDir,
      task.id,
      index,
      outputFetchHeadersForUrl(result, sourceUrl),
    );
    artifacts.push(buildTaskArtifact(task, saved, "image", index, createdAt, buildResourceTitle(task.title, index, imageUrls.length)));
  }

  for (const [index, sourceUrl] of videoUrls.entries()) {
    const saved = await materializeVideoOutput(
      sourceUrl,
      dirs.outputDir,
      task.id,
      index,
      outputFetchHeadersForUrl(result, sourceUrl),
    );
    artifacts.push(buildTaskArtifact(
      task,
      saved,
      "video",
      index,
      createdAt,
      buildResourceTitle(task.title, imageUrls.length + index, imageUrls.length + videoUrls.length),
    ));
  }

  for (const [index, sourceUrl] of audioUrls.entries()) {
    const saved = await materializeAudioOutput(
      sourceUrl,
      dirs.outputDir,
      task.id,
      index,
      outputFetchHeadersForUrl(result, sourceUrl),
    );
    artifacts.push(buildTaskArtifact(
      task,
      saved,
      "audio",
      index,
      createdAt,
      buildResourceTitle(task.title, imageUrls.length + videoUrls.length + index, imageUrls.length + videoUrls.length + audioUrls.length),
    ));
  }

  if (usePostgresArtifactRepository()) {
    await writeTaskGenerationArtifactsToPostgres(task.ownerId, artifacts);
  } else {
    await writeTaskGenerationArtifactsToFile(dirs.generationLibraryDbPath, task.id, artifacts);
  }

  const generationBatch = bindGenerationBatchArtifacts(result.generationBatch, artifacts);

  return {
    artifacts,
    resourceItems: artifacts,
    resultPatch: {
      generationArtifactIds: artifacts.map((item) => item.id),
      resourceItemIds: artifacts.map((item) => item.id),
      resourceCount: artifacts.length,
      materializedImageUrls: artifacts.filter((item) => item.kind === "image").map((item) => item.fileUrl).filter(Boolean),
      materializedVideoUrls: artifacts.filter((item) => item.kind === "video").map((item) => item.fileUrl).filter(Boolean),
      materializedAudioUrls: artifacts.filter((item) => item.kind === "audio").map((item) => item.fileUrl).filter(Boolean),
      ...(generationBatch ? { generationBatch } : {}),
    },
  };
}

function bindGenerationBatchArtifacts(value: unknown, artifacts: GenerationArtifact[]) {
  const batch = object(value);
  if (!Array.isArray(batch.children)) return null;
  const unassignedArtifacts = [...artifacts];
  const children = batch.children.map(object)
    .sort((left, right) => Number(left.batchIndex) - Number(right.batchIndex))
    .map((child) => {
      const batchIndex = Math.max(0, Math.floor(Number(child.batchIndex) || 0));
      const generationArtifactIds = child.status === "succeeded"
        ? takeChildArtifactIds(child, unassignedArtifacts)
        : [];
      return compact({
        batchIndex,
        status: generationBatchStatus(child.status),
        taskId: safeText(child.taskId) || undefined,
        error: safeBatchError(child.error) || undefined,
        generationArtifactIds,
        startedAt: positiveMillis(child.startedAt),
        finishedAt: positiveMillis(child.finishedAt),
      });
    })
    .sort((left, right) => Number(left.batchIndex) - Number(right.batchIndex));
  return {
    total: Math.max(children.length, Math.floor(Number(batch.total) || 0)),
    completed: children.filter((child) => child.status === "succeeded").length,
    providerRequestCount: Math.max(0, Math.floor(Number(batch.providerRequestCount) || 0)),
    children,
  };
}

function takeChildArtifactIds(child: Record<string, unknown>, unassignedArtifacts: GenerationArtifact[]) {
  const outputUrls = readStringList(child.outputUrls);
  const selected: GenerationArtifact[] = [];
  for (const outputUrl of outputUrls) {
    const index = unassignedArtifacts.findIndex((artifact) => artifact.sourceUrl === outputUrl);
    if (index >= 0) selected.push(...unassignedArtifacts.splice(index, 1));
  }
  if (outputUrls.length === 0 && unassignedArtifacts.length > 0) {
    selected.push(...unassignedArtifacts.splice(0, 1));
  }
  return selected.map((artifact) => artifact.id);
}

function generationBatchStatus(value: unknown) {
  const status = safeText(value);
  return ["queued", "running", "succeeded", "failed", "cancelled"].includes(status) ? status : "queued";
}

function safeBatchError(value: unknown) {
  return safeText(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted url]")
    .slice(0, 500);
}

function positiveMillis(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function buildTaskArtifact(
  task: MaterializeTask,
  saved: SavedOutput,
  kind: GenerationArtifactKind,
  index: number,
  createdAt: number,
  title: string,
): GenerationArtifact {
  return {
    id: buildTaskGenerationArtifactId({ taskId: task.id, kind, index }),
    kind,
    status: "active",
    title,
    storageKey: generationArtifactStorageKey(saved.fileUrl),
    url: saved.sourceUrl,
    fileUrl: saved.fileUrl,
    sourceUrl: saved.sourceUrl,
    mime: saved.mime,
    size: saved.size,
    createdAt,
    updatedAt: createdAt,
    expiresAt: createdAt + GENERATION_ARTIFACT_TTL_MS,
    sourceNodeId: safeText(task.payload.sourceNodeId),
    sourceCanvasId: safeText(task.payload.sourceCanvasId),
    taskId: task.id,
    providerId: task.providerId,
    modelId: task.providerModelId || task.modelRecordId,
    metadata: {
      dedupeKey: buildGenerationArtifactDedupeKey({ taskId: task.id, kind, storageKey: generationArtifactStorageKey(saved.fileUrl) }),
      registrationSource: "worker",
      provenance: buildGenerationExecutionProvenance({
        sourceTaskId: task.id,
        sourceNodeId: safeText(task.payload.sourceNodeId),
        canvasRunId: safeText(task.payload.canvasRunId),
        canvasRunStepId: safeText(task.payload.canvasRunStepId),
        providerId: task.providerId,
        modelRecordId: task.modelRecordId,
        resolvedPrompt: safeText(task.payload.prompt) || safeText(task.payload.text),
      }),
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
    generationLibraryDbPath: join(resourceDir, "generation-library.json"),
  };
}

async function ensureUserDataDirs(dirs: ReturnType<typeof userDataDirs>) {
  await mkdir(dirs.outputDir, { recursive: true });
  await mkdir(dirs.resourceDir, { recursive: true });
}

function usePostgresArtifactRepository() {
  return storageDriver === "postgres" && Boolean(databaseUrl);
}

async function getPostgresPool() {
  if (!databaseUrl) throw new Error("DATABASE_NOT_CONFIGURED");
  postgresPoolPromise ??= import("pg").then((pg) => {
    const { Pool } = pg.default || pg;
    const poolConfig = resolvePostgresPoolConfig(process.env, {
      serviceEnvPrefix: "XINGHUAN_WORKER",
      defaultMax: 3,
      defaultConnectionTimeoutMillis: 3000,
    });
    return new Pool({
      connectionString: databaseUrl,
      ...poolConfig,
    });
  });
  return postgresPoolPromise;
}

function millisToDate(value: number | undefined) {
  return new Date(typeof value === "number" && Number.isFinite(value) ? value : Date.now());
}

async function writeTaskGenerationArtifactsToPostgres(ownerId: string, artifacts: GenerationArtifact[]) {
  const pool = await getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const taskId = safeText(artifacts[0]?.taskId);
    // A task can be materialized more than once: progress snapshots may overlap
    // with the final write, and a lease takeover can briefly leave two workers
    // finishing the same provider request. Serialize the task's artifact
    // projection across workers so the delete/upsert pair is atomic and
    // deterministic. This also prevents a stale writer from racing a newer one
    // while remote output downloads are bandwidth constrained.
    if (taskId) {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`${ownerId}:${taskId}`],
      );
    }
    const artifactIds = artifacts.map((item) => item.id);
    if (taskId) {
      await client.query(
        `update xh_generation_artifacts
         set status = 'deleted', deleted_at = now(), updated_at = now()
         where owner_id = $1 and source_task_id = $2 and status <> 'promoted' and not (id = any($3::text[]))`,
        [ownerId, taskId, artifactIds],
      );
    }
    for (const item of artifacts) {
      const dedupeKey = safeText(item.metadata?.dedupeKey, buildGenerationArtifactDedupeKey({
        taskId: item.taskId,
        kind: item.kind,
        storageKey: item.storageKey,
      }));
      await upsertTaskGenerationArtifact(client, {
        id: item.id,
        ownerId,
        kind: item.kind,
        title: safeText(item.title, "生成产物"),
        storageKey: item.storageKey,
        fileUrl: item.fileUrl,
        sourceUrl: item.sourceUrl || item.url || item.fileUrl,
        mime: item.mime || "",
        size: Number(item.size) || 0,
        taskId: item.taskId || null,
        sourceCanvasId: item.sourceCanvasId || null,
        sourceNodeId: item.sourceNodeId || null,
        providerId: item.providerId || null,
        modelId: item.modelId || null,
        dedupeKey,
        metadata: JSON.stringify(item.metadata || {}),
        createdAt: millisToDate(item.createdAt),
        expiresAt: millisToDate(item.expiresAt),
      });
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function materializeImageOutput(
  sourceUrl: string,
  outputDir: string,
  taskId: string,
  index: number,
  headers?: Record<string, string>,
): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  const dataUrlMatch = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(sourceUrl);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const ext = imageExtensionFromMime(mime) || "png";
    const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    await writeOutputAtomically(outputDir, filename, buffer);
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

  const downloaded = await downloadRemoteOutput(sourceUrl, {
    headers,
    timeoutMs: 120000,
    mediaLabel: "图片",
    supportsMime: (mime) => mime.startsWith("image/") || (mime === "application/octet-stream" && Boolean(imageExtensionFromUrl(sourceUrl))),
  });
  const mime = downloaded.mime;
  const extFromUrl = imageExtensionFromUrl(sourceUrl);
  const isGenericBinaryImage = mime === "application/octet-stream" && Boolean(extFromUrl);
  if (!mime.startsWith("image/") && !isGenericBinaryImage) throw new Error(`输出素材不是图片: ${mime || "unknown"}`);
  const ext = imageExtensionFromMime(mime) || extFromUrl || "png";
  const effectiveMime = mime.startsWith("image/") ? mime : inferMime(`placeholder.${ext}`);
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  await writeOutputAtomically(outputDir, filename, downloaded.buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: downloaded.buffer.length,
    mime: effectiveMime,
    sourceUrl,
  };
}

async function materializeVideoOutput(
  sourceUrl: string,
  outputDir: string,
  taskId: string,
  index: number,
  headers?: Record<string, string>,
): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error(`暂不支持的输出视频 URL: ${sourceUrl.slice(0, 120)}`);
  }

  const downloaded = await downloadRemoteOutput(sourceUrl, {
    headers,
    timeoutMs: 180000,
    mediaLabel: "视频",
    supportsMime: (mime) => mime.startsWith("video/"),
    resumeRange: true,
  });
  const mime = downloaded.mime;
  const ext = videoExtensionFromMime(mime) || videoExtensionFromUrl(sourceUrl) || "mp4";
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  await writeOutputAtomically(outputDir, filename, downloaded.buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: downloaded.buffer.length,
    mime,
    sourceUrl,
  };
}

interface TaskGenerationArtifactRow {
  id: string;
  ownerId: string;
  kind: GenerationArtifactKind;
  title: string;
  storageKey: string;
  fileUrl: string;
  sourceUrl: string;
  mime: string;
  size: number;
  taskId: string | null;
  sourceCanvasId: string | null;
  sourceNodeId: string | null;
  providerId: string | null;
  modelId: string | null;
  dedupeKey: string;
  metadata: string;
  createdAt: Date;
  expiresAt: Date;
}

async function upsertTaskGenerationArtifact(
  client: import("pg").PoolClient,
  item: TaskGenerationArtifactRow,
) {
  const values = [
    item.id,
    item.ownerId,
    item.kind,
    item.title,
    item.storageKey,
    item.fileUrl,
    item.sourceUrl,
    item.mime,
    item.size,
    item.taskId,
    item.sourceCanvasId,
    item.sourceNodeId,
    item.providerId,
    item.modelId,
    item.dedupeKey,
    item.metadata,
    item.createdAt,
    item.expiresAt,
  ];
  const columns = `(
    id, owner_id, kind, status, title, storage_key, file_url, source_url, mime, size_bytes,
    source_task_id, source_canvas_id, source_node_id, provider_id, model_id, dedupe_key, metadata,
    created_at, updated_at, expires_at
  ) values ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $17, $18)`;
  const update = `
    title = excluded.title,
    storage_key = excluded.storage_key,
    file_url = excluded.file_url,
    source_url = excluded.source_url,
    mime = excluded.mime,
    size_bytes = excluded.size_bytes,
    source_canvas_id = excluded.source_canvas_id,
    source_node_id = excluded.source_node_id,
    provider_id = excluded.provider_id,
    model_id = excluded.model_id,
    metadata = xh_generation_artifacts.metadata || excluded.metadata,
    status = case when xh_generation_artifacts.status = 'promoted' then 'promoted' else 'active' end,
    deleted_at = null,
    updated_at = excluded.updated_at,
    expires_at = greatest(xh_generation_artifacts.expires_at, excluded.expires_at),
    dedupe_key = excluded.dedupe_key`;

  await client.query("savepoint generation_artifact_upsert");
  try {
    await client.query(
      `insert into xh_generation_artifacts ${columns} on conflict (id) do update set ${update}`,
      values,
    );
    await client.query("release savepoint generation_artifact_upsert");
  } catch (error) {
    await client.query("rollback to savepoint generation_artifact_upsert");
    if (!isUniqueViolation(error)) {
      await client.query("release savepoint generation_artifact_upsert");
      throw error;
    }
    // A historical row may have the same task/kind slot but a different
    // storage extension (for example, a provider changed its content-type on
    // retry). Fall back to the owner/dedupe unique key without aborting the
    // enclosing task transaction; the existing row id remains canonical.
    await client.query(
      `insert into xh_generation_artifacts ${columns} on conflict (owner_id, dedupe_key) do update set ${update}`,
      values,
    );
    await client.query("release savepoint generation_artifact_upsert");
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505");
}

const OUTPUT_DOWNLOAD_MAX_ATTEMPTS = 4;
const OUTPUT_DOWNLOAD_RETRY_BASE_DELAY_MS = 250;

async function downloadRemoteOutput(
  sourceUrl: string,
  input: {
    headers?: Record<string, string>;
    timeoutMs: number;
    mediaLabel: string;
    supportsMime: (mime: string) => boolean;
    resumeRange?: boolean;
  },
) {
  let accumulated: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let lastError: unknown;
  for (let attempt = 1; attempt <= OUTPUT_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      const requestHeaders: Record<string, string> = { ...(input.headers || {}) };
      if (input.resumeRange && accumulated.length > 0) requestHeaders.range = `bytes=${accumulated.length}-`;
      const upstream = await fetch(sourceUrl, {
        ...(Object.keys(requestHeaders).length > 0 ? { headers: requestHeaders } : {}),
        signal: AbortSignal.timeout(input.timeoutMs),
      });
      if (!upstream.ok) {
        const snippet = await readResponseSnippet(upstream);
        const category = contentFailureCategory(upstream.status);
        const error = new OutputMaterializationError(
          `下载输出${input.mediaLabel}失败 ${upstream.status}${snippet ? `: ${snippet}` : ""}`,
          {
            failureCategory: category,
            providerDiagnostic: `Provider 内容接口返回 HTTP ${upstream.status}`,
            upstreamHttpStatus: upstream.status,
            upstreamResponseSnippet: snippet || undefined,
          },
          upstream.status,
        );
        lastError = error;
        if (!isRetryableContentStatus(upstream.status) || attempt === OUTPUT_DOWNLOAD_MAX_ATTEMPTS) throw error;
        await sleep(OUTPUT_DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      const mime = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!input.supportsMime(mime)) throw new OutputMaterializationError(
        `输出素材不是${input.mediaLabel}: ${mime || "unknown"}`,
        { failureCategory: "provider_content_unavailable", providerDiagnostic: `Provider 内容接口返回非${input.mediaLabel}类型 ${mime || "unknown"}` },
        upstream.status,
      );
      try {
        const chunk = await readResponseBody(upstream);
        return {
          buffer: input.resumeRange && accumulated.length > 0 && upstream.status === 206
            ? Buffer.concat([accumulated, chunk])
            : chunk,
          mime,
        };
      } catch (error) {
        const partial = error instanceof OutputStreamReadError ? error.partial : Buffer.alloc(0);
        if (input.resumeRange && partial.length > 0) {
          accumulated = upstream.status === 206 ? Buffer.concat([accumulated, partial]) : partial;
        }
        lastError = new OutputMaterializationError(
          `Provider ${input.mediaLabel}流中断（已接收 ${input.resumeRange ? accumulated.length : partial.length} 字节）`,
          {
            failureCategory: "provider_content_stream_terminated",
            providerDiagnostic: error instanceof Error ? error.message : String(error),
            materializedBytes: input.resumeRange ? accumulated.length : partial.length,
          },
        );
        if (attempt === OUTPUT_DOWNLOAD_MAX_ATTEMPTS) throw lastError;
        await sleep(OUTPUT_DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
    } catch (error) {
      if (error instanceof OutputMaterializationError) {
        lastError = error;
        if (error.resultPatch.failureCategory === "provider_content_stream_terminated" && attempt < OUTPUT_DOWNLOAD_MAX_ATTEMPTS) continue;
        throw error;
      }
      lastError = new OutputMaterializationError(
        `下载输出${input.mediaLabel}失败: ${error instanceof Error ? error.message : String(error)}`,
        { failureCategory: "provider_content_stream_terminated", providerDiagnostic: error instanceof Error ? error.message : String(error) },
      );
      if (attempt === OUTPUT_DOWNLOAD_MAX_ATTEMPTS) throw lastError;
      await sleep(OUTPUT_DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`下载输出${input.mediaLabel}失败`);
}

async function writeOutputAtomically(outputDir: string, filename: string, buffer: Buffer) {
  const targetPath = join(outputDir, filename);
  const temporaryPath = join(outputDir, `.${filename}.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.part`);
  try {
    await writeFile(temporaryPath, buffer);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

class OutputStreamReadError extends Error {
  constructor(public readonly partial: Buffer, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "OutputStreamReadError";
  }
}

async function readResponseBody(response: Response & { body?: ReadableStream<Uint8Array> | null }) {
  if (!response.body?.getReader) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value?.length) chunks.push(Buffer.from(next.value));
    }
  } catch (error) {
    throw new OutputStreamReadError(Buffer.concat(chunks), error);
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

async function readResponseSnippet(response: Response) {
  try {
    return (await response.text()).replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return "";
  }
}

function isRetryableContentStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function contentFailureCategory(status: number): UnifiedFailureCategory {
  if (status === 401 || status === 403) return "provider_content_forbidden";
  return "provider_content_unavailable";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function outputFetchHeadersForUrl(result: Record<string, unknown>, sourceUrl: string) {
  const context = (result as Record<PropertyKey, unknown>)[outputFetchContextSymbol] as OutputFetchContext | undefined;
  if (!context) return undefined;
  const sourceOrigin = normalizeHttpOrigin(sourceUrl);
  return sourceOrigin && sourceOrigin === context.origin ? context.headers : undefined;
}

function normalizeHttpOrigin(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

async function writeTaskGenerationArtifactsToFile(path: string, taskId: string, artifacts: GenerationArtifact[]) {
  return withGenerationFileLock(path, async () => {
    const db = await readGenerationFileDb(path);
    const preserved = db.items.filter((item) => safeText(item.taskId) !== taskId || item.status === "promoted");
    const promotedById = new Map(
      db.items.filter((item) => item.status === "promoted").map((item) => [item.id, item]),
    );
    const nextArtifacts = artifacts.map((item) => {
      const previous = promotedById.get(item.id);
      return previous ? { ...item, status: "promoted" as const, promotedAssetId: previous.promotedAssetId } : item;
    });
    await atomicWriteJson(path, { items: [...nextArtifacts, ...preserved.filter((item) => !nextArtifacts.some((next) => next.id === item.id))] });
  });
}

async function readGenerationFileDb(path: string): Promise<{ items: GenerationArtifact[] }> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return { items: Array.isArray(parsed?.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

function withGenerationFileLock<T>(path: string, operation: () => Promise<T>) {
  const previous = generationFileQueues.get(path) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  generationFileQueues.set(path, next);
  void next.finally(() => {
    if (generationFileQueues.get(path) === next) generationFileQueues.delete(path);
  });
  return next;
}

async function atomicWriteJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function normalizeOutputFetchHeaders(value: Record<string, string>) {
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value || {})) {
    const name = rawName.trim().toLowerCase();
    const headerValue = String(rawValue || "").trim();
    if (!headerValue || !["authorization", "x-api-key"].includes(name)) continue;
    headers[name] = headerValue;
  }
  return headers;
}

async function materializeAudioOutput(
  sourceUrl: string,
  outputDir: string,
  taskId: string,
  index: number,
  headers?: Record<string, string>,
): Promise<SavedOutput> {
  const localOutput = await tryResolveLocalOutput(sourceUrl, outputDir);
  if (localOutput) return localOutput;

  const dataUrlMatch = /^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i.exec(sourceUrl);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    const ext = audioExtensionFromMime(mime) || "wav";
    const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
    const buffer = Buffer.from(dataUrlMatch[2], "base64");
    await writeOutputAtomically(outputDir, filename, buffer);
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

  const downloaded = await downloadRemoteOutput(sourceUrl, {
    headers,
    timeoutMs: 180000,
    mediaLabel: "音频",
    supportsMime: (mime) => mime.startsWith("audio/"),
  });
  const mime = downloaded.mime;
  const ext = audioExtensionFromMime(mime) || audioExtensionFromUrl(sourceUrl) || "mp3";
  const filename = `task_output_${safeFilename(taskId, "task")}_${index + 1}.${ext}`;
  await writeOutputAtomically(outputDir, filename, downloaded.buffer);
  return {
    filename,
    fileUrl: `/files/output/${filename}`,
    size: downloaded.buffer.length,
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
