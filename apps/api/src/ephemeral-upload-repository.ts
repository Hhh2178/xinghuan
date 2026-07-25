import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const EPHEMERAL_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export type EphemeralUploadKind = "image" | "video" | "audio";

export interface EphemeralUploadRecord {
  id: string;
  ownerId: string;
  kind: EphemeralUploadKind;
  storageKey: string;
  fileUrl: string;
  mime: string;
  size: number;
  status: "active" | "expired" | "missing" | "deleted";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface RegisterEphemeralUploadInput {
  filename: string;
  url: string;
  kind: EphemeralUploadKind;
  mime?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

interface FileDb {
  items: EphemeralUploadRecord[];
}

export function createEphemeralUploadRepository(deps: {
  usePostgresRepository: () => boolean;
  getPostgresPool: () => Promise<Queryable>;
  manifestPath: (ownerId: string) => string;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  const fileQueues = new Map<string, Promise<unknown>>();

  async function registerOwned(ownerId: string, input: RegisterEphemeralUploadInput) {
    const storageKey = normalizeStorageKey(input.filename);
    const fileUrl = normalizeFileUrl(input.url, storageKey);
    const createdAt = now();
    const expiresAt = createdAt + EPHEMERAL_UPLOAD_TTL_MS;
    const id = `upload-${createdAt}-${Math.random().toString(36).slice(2, 10)}`;
    const normalized = {
      id,
      ownerId,
      kind: input.kind,
      storageKey,
      fileUrl,
      mime: String(input.mime || "application/octet-stream").trim(),
      size: Number(input.size) || 0,
      status: "active" as const,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      metadata: input.metadata || {},
    };

    if (deps.usePostgresRepository()) {
      const pool = await deps.getPostgresPool();
      const result = await pool.query(
        `insert into xh_ephemeral_uploads (
           id, owner_id, kind, storage_key, file_url, mime, size_bytes, status,
           metadata, created_at, updated_at, expires_at
         ) values ($1, $2, $3, $4, $5, $6, $7, 'active', $8::jsonb, $9, $9, $10)
         on conflict (owner_id, storage_key) do update set
           kind = excluded.kind,
           file_url = excluded.file_url,
           mime = excluded.mime,
           size_bytes = excluded.size_bytes,
           metadata = xh_ephemeral_uploads.metadata || excluded.metadata,
           status = case when xh_ephemeral_uploads.status in ('deleted', 'missing') then 'active' else xh_ephemeral_uploads.status end,
           updated_at = excluded.updated_at,
           expires_at = least(xh_ephemeral_uploads.expires_at, excluded.expires_at)
         returning *`,
        [
          normalized.id,
          normalized.ownerId,
          normalized.kind,
          normalized.storageKey,
          normalized.fileUrl,
          normalized.mime,
          normalized.size,
          JSON.stringify(normalized.metadata),
          new Date(normalized.createdAt),
          new Date(normalized.expiresAt),
        ],
      );
      return toRecord(result.rows[0]);
    }

    const manifestPath = deps.manifestPath(ownerId);
    return withFileLock(manifestPath, async () => {
      const db = await readFileDb(manifestPath);
      const existingIndex = db.items.findIndex((item) => item.ownerId === ownerId && item.storageKey === storageKey);
      const previous = existingIndex >= 0 ? db.items[existingIndex] : undefined;
      const record: EphemeralUploadRecord = {
        ...normalized,
        id: previous?.id || normalized.id,
        createdAt: previous?.createdAt || normalized.createdAt,
        expiresAt: Math.min(previous?.expiresAt || normalized.expiresAt, normalized.expiresAt),
        updatedAt: normalized.updatedAt,
        metadata: { ...(previous?.metadata || {}), ...normalized.metadata },
      };
      const items = existingIndex >= 0
        ? [record, ...db.items.filter((_, index) => index !== existingIndex)]
        : [record, ...db.items];
      await atomicWrite(manifestPath, { items });
      return record;
    });
  }

  function withFileLock<T>(path: string, operation: () => Promise<T>) {
    const previous = fileQueues.get(path) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    fileQueues.set(path, next);
    void next.finally(() => {
      if (fileQueues.get(path) === next) fileQueues.delete(path);
    });
    return next;
  }

  return { registerOwned };
}

function normalizeStorageKey(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "." || normalized === ".." || /[\\/]/.test(normalized) || normalized.includes("..")) {
    throw new Error("EPHEMERAL_UPLOAD_STORAGE_KEY_INVALID");
  }
  return normalized;
}

function normalizeFileUrl(value: string, storageKey: string) {
  const candidate = String(value || "").trim();
  if (candidate.startsWith("/files/input/")) return candidate;
  return `/files/input/${encodeURIComponent(storageKey)}`;
}

function toRecord(row: Record<string, unknown>): EphemeralUploadRecord {
  return {
    id: String(row.id || ""),
    ownerId: String(row.owner_id || ""),
    kind: normalizeKind(row.kind),
    storageKey: String(row.storage_key || ""),
    fileUrl: String(row.file_url || ""),
    mime: String(row.mime || "application/octet-stream"),
    size: Number(row.size_bytes) || 0,
    status: normalizeStatus(row.status),
    createdAt: dateMillis(row.created_at),
    updatedAt: dateMillis(row.updated_at),
    expiresAt: dateMillis(row.expires_at),
    metadata: object(row.metadata),
  };
}

function normalizeKind(value: unknown): EphemeralUploadKind {
  const kind = String(value || "").trim().toLowerCase();
  return kind === "video" || kind === "audio" ? kind : "image";
}

function normalizeStatus(value: unknown): EphemeralUploadRecord["status"] {
  const status = String(value || "").trim().toLowerCase();
  return status === "expired" || status === "missing" || status === "deleted" ? status : "active";
}

function dateMillis(value: unknown) {
  const millis = value instanceof Date ? value.getTime() : new Date(String(value || "")).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readFileDb(path: string): Promise<FileDb> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    return { items: Array.isArray(raw?.items) ? raw.items as EphemeralUploadRecord[] : [] };
  } catch {
    return { items: [] };
  }
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}
