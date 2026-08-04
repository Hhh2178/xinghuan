import { createHash, randomUUID } from "node:crypto";
import { lstat, realpath, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import type { Pool } from "pg";
import {
  OUTPUT_ARCHIVE_CONFIG,
  type OutputArchiveErrorCode,
  type OutputArchiveJobSummary,
  type OutputArchiveManifest,
  type OutputArchiveManifestFile,
  type OutputArchiveStatus,
} from "@xinghuan/shared";
import type { TaskRecordShape } from "./task-repository.js";

type ArchiveUserDirs = { baseDir: string; outputDir: string };

export interface ArchiveSourceFile extends OutputArchiveManifestFile {
  absolutePath: string;
}

export interface OutputArchiveRepositoryDeps {
  getPostgresPool: () => Promise<Pool>;
  usePostgresRepository: () => boolean;
  readTaskRecord: (taskId: string) => Promise<TaskRecordShape | null>;
  userDataDirs: (ownerId: string) => ArchiveUserDirs;
  now?: () => Date;
  newId?: () => string;
}

interface ArchiveJobRow {
  id: string;
  owner_id: string;
  status: OutputArchiveStatus;
  file_count: number;
  source_bytes: string | number;
  archive_bytes?: string | number | null;
  archive_relative_path?: string | null;
  archive_filename?: string | null;
  manifest: unknown;
  error_code?: OutputArchiveErrorCode | null;
  expires_at?: Date | string | null;
}

const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);
const materializedKeys = [
  ["image", "materializedImageUrls"],
  ["video", "materializedVideoUrls"],
  ["audio", "materializedAudioUrls"],
] as const;

export function createOutputArchiveRepository(deps: OutputArchiveRepositoryDeps) {
  const now = deps.now || (() => new Date());
  const newId = deps.newId || (() => `archive-${randomUUID()}`);

  function assertPostgres() {
    if (!deps.usePostgresRepository()) throw new Error("OUTPUT_ARCHIVE_POSTGRES_REQUIRED");
  }

  function safeArchiveFilename(value: string, fallback: string) {
    const normalized = basename(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_").trim();
    return normalized || fallback;
  }

  async function resolveSourceFiles(ownerId: string, task: TaskRecordShape): Promise<ArchiveSourceFile[]> {
    if (!terminalStatuses.has(task.status)) throw new Error("source_task_not_terminal");
    const dirs = deps.userDataDirs(ownerId);
    const outputRoot = resolve(dirs.outputDir);
    const outputRealRoot = await realpath(outputRoot).catch(() => outputRoot);
    const result = task.result || {};
    const artifactIds = Array.isArray(result.generationArtifactIds)
      ? result.generationArtifactIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const artifactFiles: ArchiveSourceFile[] = [];
    if (artifactIds.length > 0) {
      const pool = await deps.getPostgresPool();
      const artifacts = await pool.query<{ id: string; kind: string; file_url: string; size: number | string | null }>(
        `select id, kind, file_url, size_bytes as size
           from xh_generation_artifacts
          where owner_id = $1 and id = any($2::text[]) and status in ('active', 'promoted')
          order by created_at asc, id asc`,
        [ownerId, artifactIds],
      );
      const kindIndexes = new Map<string, number>();
      for (const row of artifacts.rows) {
        const kindIndex = kindIndexes.get(row.kind) || 0;
        kindIndexes.set(row.kind, kindIndex + 1);
        const resolved = await resolveOutputFile(outputRoot, outputRealRoot, row.file_url, row.kind, row.id, row.size, kindIndex);
        if (resolved) artifactFiles.push(resolved);
      }
    }
    if (artifactFiles.length > 0) return artifactFiles;

    const fallbackFiles: ArchiveSourceFile[] = [];
    let index = 0;
    for (const [kind, key] of materializedKeys) {
      const urls = Array.isArray(result[key]) ? result[key].map((value) => String(value || "").trim()).filter(Boolean) : [];
      for (const sourceUrl of urls) {
        const resolved = await resolveOutputFile(outputRoot, outputRealRoot, sourceUrl, kind, undefined, undefined, index++);
        if (resolved) fallbackFiles.push(resolved);
      }
    }
    return fallbackFiles;
  }

  async function resolveOutputFile(
    outputRoot: string,
    outputRealRoot: string,
    sourceUrl: string,
    kind: string,
    artifactId?: string,
    knownSize?: number | string | null,
    fallbackIndex = 0,
  ): Promise<ArchiveSourceFile | null> {
    if (!sourceUrl.startsWith("/files/output/")) return null;
    const encodedSegment = sourceUrl.slice("/files/output/".length);
    let fileSegment = "";
    try {
      fileSegment = decodeURIComponent(encodedSegment);
    } catch {
      throw new Error("archive_source_invalid");
    }
    if (!fileSegment || fileSegment.includes("..") || /[\\/]/.test(fileSegment)) throw new Error("archive_source_invalid");
    const absolutePath = join(outputRoot, fileSegment);
    const relativePath = relative(outputRealRoot, resolve(absolutePath));
    if (!relativePath || relativePath.startsWith("..") || relativePath.includes(".." + "\\") || relativePath.includes(".." + "/")) {
      throw new Error("archive_source_invalid");
    }
    const linkInfo = await lstat(absolutePath).catch(() => null);
    if (!linkInfo?.isFile() || linkInfo.isSymbolicLink()) return null;
    const resolvedPath = await realpath(absolutePath).catch(() => absolutePath);
    const resolvedRelative = relative(outputRealRoot, resolvedPath);
    if (!resolvedRelative || resolvedRelative.startsWith("..") || resolvedRelative.includes(".." + "\\") || resolvedRelative.includes(".." + "/")) {
      throw new Error("archive_source_invalid");
    }
    const info = await stat(absolutePath);
    const safeName = safeArchiveFilename(fileSegment, `output-${fallbackIndex + 1}`);
    return {
      artifactId,
      sourceUrl,
      archivePath: `${kind || "other"}s/${String(fallbackIndex + 1).padStart(3, "0")}-${safeName}`,
      kind: kind || "other",
      sourceBytes: Number(knownSize) > 0 ? Number(knownSize) : info.size,
      absolutePath,
    };
  }

  function buildFingerprint(taskId: string, files: ArchiveSourceFile[]) {
    return createHash("sha256").update(JSON.stringify({
      version: 1,
      taskId,
      files: files.map(({ absolutePath: _absolutePath, ...file }) => file),
    })).digest("hex");
  }

  function summary(row: ArchiveJobRow, reused: boolean): OutputArchiveJobSummary {
    return {
      jobId: row.id,
      status: row.status,
      reused,
      fileCount: Number(row.file_count) || 0,
      sourceBytes: Number(row.source_bytes) || 0,
      ...(Number(row.archive_bytes) > 0 ? { archiveBytes: Number(row.archive_bytes) } : {}),
      ...(row.error_code ? { errorCode: row.error_code } : {}),
      ...(row.expires_at ? { expiresAt: new Date(row.expires_at).toISOString() } : {}),
    };
  }

  async function createOrReuse(taskId: string, ownerId: string): Promise<OutputArchiveJobSummary> {
    assertPostgres();
    const task = await deps.readTaskRecord(taskId);
    if (!task || (task.ownerId && task.ownerId !== ownerId)) throw new Error("ARCHIVE_TASK_NOT_FOUND");
    const files = await resolveSourceFiles(ownerId, task);
    if (files.length === 0) throw new Error("no_materialized_outputs");
    const sourceBytes = files.reduce((total, file) => total + file.sourceBytes, 0);
    if (sourceBytes > OUTPUT_ARCHIVE_CONFIG.maxBytes) throw new Error("archive_too_large");
    const fingerprint = buildFingerprint(taskId, files);
    const pool = await deps.getPostgresPool();
    const existing = await pool.query<ArchiveJobRow>(
      `select id, owner_id, status, file_count, source_bytes, archive_bytes, archive_relative_path, archive_filename, manifest, error_code, expires_at
         from xh_output_archive_jobs
        where owner_id = $1 and source_task_id = $2 and source_fingerprint = $3
          and status in ('queued', 'running', 'ready', 'downloaded')
          and (expires_at is null or expires_at > now())
        order by created_at desc
        limit 1`,
      [ownerId, taskId, fingerprint],
    );
    if (existing.rows[0]) return summary(existing.rows[0], true);
    const pending = await pool.query<{ count: string }>(
      `select count(*)::text as count from xh_output_archive_jobs where owner_id = $1 and status in ('queued', 'running')`,
      [ownerId],
    );
    if (Number(pending.rows[0]?.count || 0) >= OUTPUT_ARCHIVE_CONFIG.maxPendingPerOwner) throw new Error("too_many_pending_archives");
    const id = newId();
    const filename = `rh-${safeArchiveFilename(task.title, "output")}-${taskId.slice(0, 8)}.zip`;
    const manifest: OutputArchiveManifest = {
      schemaVersion: 1,
      sourceTaskId: taskId,
      createdAt: now().toISOString(),
      files: files.map(({ absolutePath: _absolutePath, ...file }) => file),
      missing: [],
      fileCount: files.length,
      sourceBytes,
    };
    const inserted = await pool.query<ArchiveJobRow>(
      `insert into xh_output_archive_jobs
        (id, owner_id, source_task_id, source_fingerprint, status, file_count, source_bytes, archive_filename, manifest)
       values ($1, $2, $3, $4, 'queued', $5, $6, $7, $8::jsonb)
       returning id, owner_id, status, file_count, source_bytes, archive_bytes, archive_relative_path, archive_filename, manifest, error_code, expires_at`,
      [id, ownerId, taskId, fingerprint, files.length, sourceBytes, filename, JSON.stringify(manifest)],
    );
    return summary(inserted.rows[0], false);
  }

  async function readJob(jobId: string, ownerId: string) {
    assertPostgres();
    const pool = await deps.getPostgresPool();
    const result = await pool.query<ArchiveJobRow>(
      `select id, owner_id, status, file_count, source_bytes, archive_bytes, archive_relative_path, archive_filename, manifest, error_code, expires_at
         from xh_output_archive_jobs where id = $1 and owner_id = $2 limit 1`,
      [jobId, ownerId],
    );
    return result.rows[0] ? { ...summary(result.rows[0], false), archiveRelativePath: result.rows[0].archive_relative_path || undefined, archiveFilename: result.rows[0].archive_filename || undefined } : null;
  }

  async function cancelJob(jobId: string, ownerId: string) {
    assertPostgres();
    const pool = await deps.getPostgresPool();
    const result = await pool.query<ArchiveJobRow>(
      `update xh_output_archive_jobs
          set status = case when status = 'queued' then 'cancelled' else status end,
              cancel_requested_at = case when status in ('queued', 'running', 'ready', 'downloaded') then now() else cancel_requested_at end,
              updated_at = now()
        where id = $1 and owner_id = $2
      returning id, owner_id, status, file_count, source_bytes, archive_bytes, archive_relative_path, archive_filename, manifest, error_code, expires_at`,
      [jobId, ownerId],
    );
    return result.rows[0] ? summary(result.rows[0], false) : null;
  }

  async function markDownloaded(jobId: string, ownerId: string) {
    assertPostgres();
    const pool = await deps.getPostgresPool();
    await pool.query(
      `update xh_output_archive_jobs
          set status = case when status = 'ready' then 'downloaded' else status end,
              download_count = download_count + 1,
              downloaded_at = now(),
              updated_at = now()
        where id = $1 and owner_id = $2 and status in ('ready', 'downloaded')`,
      [jobId, ownerId],
    );
  }

  return { createOrReuse, readJob, cancelJob, markDownloaded, resolveSourceFiles };
}
