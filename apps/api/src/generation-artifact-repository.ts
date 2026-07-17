import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  GenerationArtifact,
  GenerationArtifactKind,
  GenerationArtifactStatus,
  RegisterGenerationArtifactInput,
} from "@xinghuan/shared";
import {
  GENERATION_ARTIFACT_TTL_MS,
  buildGenerationArtifactDedupeKey,
  generationArtifactStorageKey,
  normalizeGenerationArtifactKind,
} from "@xinghuan/shared";

interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount?: number | null;
}

interface Queryable {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

interface FileDb {
  items: GenerationArtifact[];
}

interface ResourceItemProjection {
  id: string;
  kind: GenerationArtifactKind;
  title: string;
  url: string;
  sourceUrl: string;
  originalName: string;
  fileUrl: string;
  fileRel: string;
  mime: string;
  size: number;
  categoryId: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  revision: number;
  taskId: string;
  sourceNodeId: string;
  sourceCanvasId: string;
  providerId: string;
  modelId: string;
}

export function createGenerationArtifactRepository(deps: {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<Queryable & { connect: () => Promise<Queryable & { release: () => void }> }>;
  generationLibraryPath: (ownerId: string) => string;
  resourceLibraryPath: (ownerId: string) => string;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  const fileQueues = new Map<string, Promise<unknown>>();

  async function listOwned(ownerId: string, filters: { kind?: GenerationArtifactKind | ""; q?: string } = {}) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const values: unknown[] = [ownerId, new Date(now())];
      const predicates = ["owner_id = $1", "status in ('active', 'promoted')", "expires_at > $2"];
      if (filters.kind) {
        values.push(filters.kind);
        predicates.push(`kind = $${values.length}`);
      }
      if (filters.q) {
        values.push(`%${filters.q.toLowerCase()}%`);
        predicates.push(`lower(title || ' ' || coalesce(mime, '') || ' ' || file_url) like $${values.length}`);
      }
      const result = await pool.query(
        `select * from xh_generation_artifacts where ${predicates.join(" and ")} order by updated_at desc, created_at desc`,
        values,
      );
      return result.rows.map(toArtifact);
    }

    const db = await readFileDb(ownerId);
    const query = String(filters.q || "").trim().toLowerCase();
    const current = now();
    return db.items
      .filter((item) => (item.status === "active" || item.status === "promoted") && item.expiresAt > current)
      .filter((item) => !filters.kind || item.kind === filters.kind)
      .filter((item) => !query || `${item.title} ${item.mime || ""} ${item.fileUrl}`.toLowerCase().includes(query))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function findOwned(ownerId: string, id: string) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query("select * from xh_generation_artifacts where id = $1 and owner_id = $2 limit 1", [id, ownerId]);
      return result.rows[0] ? toArtifact(result.rows[0]) : null;
    }
    return (await readFileDb(ownerId)).items.find((item) => item.id === id) ?? null;
  }

  async function registerOwned(ownerId: string, input: RegisterGenerationArtifactInput) {
    const createdAt = positiveMillis(input.createdAt, now());
    const expiresAt = positiveMillis(input.expiresAt, createdAt + GENERATION_ARTIFACT_TTL_MS);
    const storageKey = String(input.storageKey || generationArtifactStorageKey(input.fileUrl)).trim();
    const dedupeKey = String(input.dedupeKey || buildGenerationArtifactDedupeKey({
      taskId: input.taskId,
      kind: input.kind,
      storageKey,
    })).trim();
    const normalized = {
      ...input,
      id: String(input.id || `gen-${createdAt}-${Math.random().toString(36).slice(2, 10)}`).trim(),
      title: String(input.title || storageKey || "生成产物").trim(),
      storageKey,
      fileUrl: String(input.fileUrl || "").trim(),
      sourceUrl: String(input.sourceUrl || input.fileUrl || "").trim(),
      size: Number(input.size) || 0,
      createdAt,
      expiresAt,
      dedupeKey,
    };

    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query(
        `insert into xh_generation_artifacts (
           id, owner_id, kind, status, title, storage_key, file_url, source_url, mime, size_bytes,
           source_task_id, source_canvas_id, source_node_id, provider_id, model_id, dedupe_key, metadata,
           created_at, updated_at, expires_at
         ) values ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9,
           (select id from xh_tasks where id = $10 and owner_id = $2),
           $11, $12, $13, $14, $15, $16::jsonb, $17, $17, $18)
         on conflict (owner_id, dedupe_key) do update set
           title = excluded.title,
           storage_key = excluded.storage_key,
           file_url = excluded.file_url,
           source_url = excluded.source_url,
           mime = excluded.mime,
           size_bytes = excluded.size_bytes,
           source_canvas_id = coalesce(excluded.source_canvas_id, xh_generation_artifacts.source_canvas_id),
           source_node_id = coalesce(excluded.source_node_id, xh_generation_artifacts.source_node_id),
           provider_id = coalesce(excluded.provider_id, xh_generation_artifacts.provider_id),
           model_id = coalesce(excluded.model_id, xh_generation_artifacts.model_id),
           metadata = xh_generation_artifacts.metadata || excluded.metadata,
           status = case when xh_generation_artifacts.status in ('deleted', 'missing', 'expired') then 'active' else xh_generation_artifacts.status end,
           deleted_at = null,
           updated_at = excluded.updated_at,
           expires_at = greatest(xh_generation_artifacts.expires_at, excluded.expires_at)
         returning *`,
        [
          normalized.id,
          ownerId,
          normalized.kind,
          normalized.title,
          normalized.storageKey,
          normalized.fileUrl,
          normalized.sourceUrl || null,
          normalized.mime || null,
          normalized.size,
          normalized.taskId || null,
          normalized.sourceCanvasId || null,
          normalized.sourceNodeId || null,
          normalized.providerId || null,
          normalized.modelId || null,
          normalized.dedupeKey,
          JSON.stringify(normalized.metadata || {}),
          new Date(createdAt),
          new Date(expiresAt),
        ],
      );
      return toArtifact(result.rows[0]);
    }

    return withFileLock(ownerId, async () => {
      const db = await readFileDb(ownerId);
      const existingIndex = db.items.findIndex((item) => artifactDedupeKey(item) === dedupeKey);
      const previous = existingIndex >= 0 ? db.items[existingIndex] : null;
      const artifact: GenerationArtifact = {
        id: previous?.id || normalized.id,
        kind: normalized.kind,
        status: previous?.status === "promoted" ? "promoted" : "active",
        title: normalized.title,
        storageKey: normalized.storageKey,
        url: normalized.sourceUrl || normalized.fileUrl,
        fileUrl: normalized.fileUrl,
        sourceUrl: normalized.sourceUrl,
        mime: normalized.mime,
        size: normalized.size,
        createdAt: previous?.createdAt || createdAt,
        updatedAt: now(),
        expiresAt: Math.max(previous?.expiresAt || 0, expiresAt),
        sourceNodeId: normalized.sourceNodeId,
        sourceCanvasId: normalized.sourceCanvasId,
        taskId: normalized.taskId,
        providerId: normalized.providerId,
        modelId: normalized.modelId,
        promotedAssetId: previous?.promotedAssetId,
        metadata: { ...(previous?.metadata || {}), ...(normalized.metadata || {}), dedupeKey },
      };
      const items = existingIndex >= 0
        ? [artifact, ...db.items.filter((_, index) => index !== existingIndex)]
        : [artifact, ...db.items];
      await writeFileDb(ownerId, { items });
      return artifact;
    });
  }

  async function deleteOwned(ownerId: string, id: string) {
    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("begin");
        const current = await client.query("select * from xh_generation_artifacts where id = $1 and owner_id = $2 for update", [id, ownerId]);
        if (!current.rows[0]) {
          await client.query("rollback");
          return null;
        }
        const artifact = toArtifact(current.rows[0]);
        const refs = await client.query(
          `select count(*)::int as count from xh_assets
           where owner_id = $1 and (id = $2 or metadata ->> 'fileUrl' = $3 or metadata ->> 'fileRel' = $3)`,
          [ownerId, artifact.promotedAssetId || "", artifact.fileUrl],
        );
        await client.query(
          "update xh_generation_artifacts set status = 'deleted', deleted_at = now(), updated_at = now() where id = $1 and owner_id = $2",
          [id, ownerId],
        );
        await client.query("commit");
        return { artifact: { ...artifact, status: "deleted" as const }, deleteBinary: Number(refs.rows[0]?.count) === 0 };
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    return withFileLock(ownerId, async () => {
      const db = await readFileDb(ownerId);
      const artifact = db.items.find((item) => item.id === id);
      if (!artifact) return null;
      const next = { ...artifact, status: "deleted" as const, updatedAt: now() };
      await writeFileDb(ownerId, { items: db.items.map((item) => item.id === id ? next : item) });
      return { artifact: next, deleteBinary: !artifact.promotedAssetId };
    });
  }

  async function promoteOwned(ownerId: string, id: string) {
    if (deps.usePostgresRepository()) return promotePostgres(ownerId, id);
    return promoteFile(ownerId, id);
  }

  async function promotePostgres(ownerId: string, id: string) {
    const pool = await deps.getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const current = await client.query("select * from xh_generation_artifacts where id = $1 and owner_id = $2 for update", [id, ownerId]);
      if (!current.rows[0]) {
        await client.query("rollback");
        return null;
      }
      const artifact = toArtifact(current.rows[0]);
      if (!["active", "promoted"].includes(artifact.status) || artifact.expiresAt <= now()) {
        await client.query("rollback");
        return null;
      }
      if (artifact.status === "promoted" && artifact.promotedAssetId) {
        const existingAsset = await client.query(
          "select * from xh_assets where id = $1 and owner_id = $2 limit 1",
          [artifact.promotedAssetId, ownerId],
        );
        if (existingAsset.rows[0]) {
          await client.query("commit");
          return { artifact, asset: toResourceProjection(existingAsset.rows[0]) };
        }
      }
      const assetId = artifact.promotedAssetId || `asset-${artifact.id}`;
      const metadata = artifactMetadata(artifact);
      const asset = await client.query(
        `insert into xh_assets (
           id, owner_id, project_id, kind, title, url, mime, size_bytes, metadata,
           category_id, tags, favorite, last_used_at, revision, created_at, updated_at
         ) values ($1, $2, null, $3, $4, $5, $6, $7, $8::jsonb, null, '[]'::jsonb, false, null, 1, now(), now())
         on conflict (id) do update set
           title = excluded.title,
           url = excluded.url,
           mime = excluded.mime,
           size_bytes = excluded.size_bytes,
           metadata = excluded.metadata,
           updated_at = now(),
           revision = xh_assets.revision + 1
         where xh_assets.owner_id = excluded.owner_id
         returning *`,
        [assetId, ownerId, artifact.kind, artifact.title, artifact.fileUrl, artifact.mime || "", artifact.size || 0, JSON.stringify(metadata)],
      );
      if (!asset.rows[0]) throw new Error("GENERATION_ARTIFACT_PROMOTION_OWNERSHIP_MISMATCH");
      const updated = await client.query(
        "update xh_generation_artifacts set status = 'promoted', promoted_asset_id = $3, updated_at = now() where id = $1 and owner_id = $2 returning *",
        [id, ownerId, assetId],
      );
      await client.query("commit");
      return { artifact: toArtifact(updated.rows[0]), asset: toResourceProjection(asset.rows[0]) };
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function promoteFile(ownerId: string, id: string) {
    return withFileLock(ownerId, async () => {
      const db = await readFileDb(ownerId);
      const artifact = db.items.find((item) => item.id === id);
      if (!artifact) return null;
      if (!["active", "promoted"].includes(artifact.status) || artifact.expiresAt <= now()) return null;
      const assetId = artifact.promotedAssetId || `asset-${artifact.id}`;
      const resourcePath = deps.resourceLibraryPath(ownerId);
      const resourceDb = await readJson(resourcePath, { categories: [], items: [] });
      const resourceItems = Array.isArray(resourceDb.items) ? resourceDb.items : [];
      const existingAsset = resourceItems.find((item: { id?: string }) => item?.id === assetId);
      if (artifact.status === "promoted" && existingAsset) {
        return { artifact, asset: existingAsset };
      }
      const asset = resourceProjectionFromArtifact(artifact, assetId);
      await atomicWrite(resourcePath, {
        categories: Array.isArray(resourceDb.categories) ? resourceDb.categories : [],
        items: [asset, ...resourceItems.filter((item: { id?: string }) => item?.id !== assetId)],
      });
      const promoted = { ...artifact, status: "promoted" as const, promotedAssetId: assetId, updatedAt: now() };
      await writeFileDb(ownerId, { items: db.items.map((item) => item.id === id ? promoted : item) });
      return { artifact: promoted, asset };
    });
  }

  function withFileLock<T>(ownerId: string, operation: () => Promise<T>) {
    const path = deps.generationLibraryPath(ownerId);
    const previous = fileQueues.get(path) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    fileQueues.set(path, next);
    void next.finally(() => {
      if (fileQueues.get(path) === next) fileQueues.delete(path);
    });
    return next;
  }

  async function readFileDb(ownerId: string): Promise<FileDb> {
    const raw = await readJson(deps.generationLibraryPath(ownerId), { items: [] });
    return {
      items: Array.isArray(raw.items)
        ? raw.items.map((item: unknown) => normalizeFileArtifact(item)).filter((item: GenerationArtifact | null): item is GenerationArtifact => Boolean(item))
        : [],
    };
  }

  function writeFileDb(ownerId: string, db: FileDb) {
    return atomicWrite(deps.generationLibraryPath(ownerId), { items: db.items });
  }

  return { listOwned, findOwned, registerOwned, deleteOwned, promoteOwned };
}

function toArtifact(row: Record<string, unknown>): GenerationArtifact {
  const fileUrl = text(row.file_url);
  return {
    id: text(row.id),
    kind: normalizeGenerationArtifactKind(row.kind) || "image",
    status: normalizeStatus(row.status),
    title: text(row.title, "生成产物"),
    storageKey: text(row.storage_key, generationArtifactStorageKey(fileUrl)),
    url: text(row.source_url, fileUrl),
    fileUrl,
    sourceUrl: text(row.source_url),
    mime: text(row.mime),
    size: Number(row.size_bytes) || 0,
    createdAt: dateMillis(row.created_at),
    updatedAt: dateMillis(row.updated_at),
    expiresAt: dateMillis(row.expires_at),
    sourceNodeId: text(row.source_node_id),
    sourceCanvasId: text(row.source_canvas_id),
    taskId: text(row.source_task_id),
    providerId: text(row.provider_id),
    modelId: text(row.model_id),
    promotedAssetId: text(row.promoted_asset_id),
    metadata: object(row.metadata),
  };
}

function normalizeFileArtifact(value: unknown): GenerationArtifact | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind = normalizeGenerationArtifactKind(row.kind);
  const fileUrl = text(row.fileUrl || row.url);
  if (!kind || !fileUrl) return null;
  const createdAt = positiveMillis(row.createdAt, Date.now());
  const storageKey = text(row.storageKey, generationArtifactStorageKey(fileUrl));
  return {
    id: text(row.id, `gen-${createdAt}-${Math.random().toString(36).slice(2, 8)}`),
    kind,
    status: normalizeStatus(row.status),
    title: text(row.title, storageKey),
    storageKey,
    url: text(row.sourceUrl || row.url, fileUrl),
    fileUrl,
    sourceUrl: text(row.sourceUrl || row.url),
    mime: text(row.mime),
    size: Number(row.size) || 0,
    createdAt,
    updatedAt: positiveMillis(row.updatedAt, createdAt),
    expiresAt: positiveMillis(row.expiresAt, createdAt + GENERATION_ARTIFACT_TTL_MS),
    sourceNodeId: text(row.sourceNodeId),
    sourceCanvasId: text(row.sourceCanvasId),
    taskId: text(row.taskId),
    providerId: text(row.providerId),
    modelId: text(row.modelId),
    promotedAssetId: text(row.promotedAssetId),
    metadata: object(row.metadata),
  };
}

function artifactDedupeKey(item: GenerationArtifact) {
  return text(item.metadata?.dedupeKey, buildGenerationArtifactDedupeKey({
    taskId: item.taskId,
    kind: item.kind,
    storageKey: item.storageKey,
  }));
}

function artifactMetadata(artifact: GenerationArtifact) {
  return {
    sourceUrl: artifact.sourceUrl || artifact.url || "",
    originalName: artifact.storageKey || "",
    fileUrl: artifact.fileUrl,
    fileRel: artifact.fileUrl,
    sourceNodeId: artifact.sourceNodeId || "",
    sourceCanvasId: artifact.sourceCanvasId || "",
    taskId: artifact.taskId || "",
    providerId: artifact.providerId || "",
    modelId: artifact.modelId || "",
    generationArtifactId: artifact.id,
  };
}

function resourceProjectionFromArtifact(artifact: GenerationArtifact, assetId: string): ResourceItemProjection {
  return {
    id: assetId,
    kind: artifact.kind,
    title: artifact.title,
    url: artifact.fileUrl,
    sourceUrl: artifact.sourceUrl || artifact.url || artifact.fileUrl,
    originalName: artifact.storageKey,
    fileUrl: artifact.fileUrl,
    fileRel: artifact.fileUrl,
    mime: artifact.mime || "",
    size: artifact.size || 0,
    categoryId: "",
    tags: [],
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: 1,
    taskId: artifact.taskId || "",
    sourceNodeId: artifact.sourceNodeId || "",
    sourceCanvasId: artifact.sourceCanvasId || "",
    providerId: artifact.providerId || "",
    modelId: artifact.modelId || "",
  };
}

function toResourceProjection(row: Record<string, unknown>): ResourceItemProjection {
  const metadata = object(row.metadata);
  return {
    id: text(row.id),
    kind: normalizeGenerationArtifactKind(row.kind) || "image",
    title: text(row.title, "资源"),
    url: text(row.url),
    sourceUrl: text(metadata.sourceUrl || row.url),
    originalName: text(metadata.originalName),
    fileUrl: text(metadata.fileUrl),
    fileRel: text(metadata.fileRel),
    mime: text(row.mime),
    size: Number(row.size_bytes) || 0,
    categoryId: text(row.category_id),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => text(item)).filter(Boolean) : [],
    favorite: Boolean(row.favorite),
    createdAt: dateMillis(row.created_at),
    updatedAt: dateMillis(row.updated_at),
    revision: Number(row.revision) || 1,
    taskId: text(metadata.taskId),
    sourceNodeId: text(metadata.sourceNodeId),
    sourceCanvasId: text(metadata.sourceCanvasId),
    providerId: text(metadata.providerId),
    modelId: text(metadata.modelId),
  };
}

async function readJson(path: string, fallback: Record<string, unknown>) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

function normalizeStatus(value: unknown): GenerationArtifactStatus {
  const status = text(value);
  return status === "promoted" || status === "expired" || status === "missing" || status === "deleted" ? status : "active";
}

function positiveMillis(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function dateMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value || "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
