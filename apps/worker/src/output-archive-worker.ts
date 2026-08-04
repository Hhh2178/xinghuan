import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, statfs } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Pool } from "pg";
import type { ArchiverError, ZipArchive as ZipArchiveType } from "archiver";
import { OUTPUT_ARCHIVE_CONFIG, type OutputArchiveErrorCode, type OutputArchiveManifest } from "@xinghuan/shared";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver") as typeof import("archiver");

interface ArchiveJobRow {
  id: string;
  owner_id: string;
  source_task_id: string;
  archive_filename: string | null;
  manifest: unknown;
}

interface ArchiveWorkerOptions {
  pool: Pool;
  dataDir: string;
  workerId: string;
  pollIntervalMs?: number;
  leaseMs?: number;
  heartbeatMs?: number;
  ttlMinutes?: number;
  maxBytes?: number;
  reservedDiskBytes?: number;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  logger?: Pick<Console, "error" | "warn" | "info">;
}

const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_HEARTBEAT_MS = 15_000;

export function createOutputArchiveWorker(options: ArchiveWorkerOptions) {
  const wait = options.wait || ((ms: number) => new Promise<void>((resolveWait) => setTimeout(resolveWait, ms)));
  const logger = options.logger || console;
  const pollIntervalMs = Math.max(250, options.pollIntervalMs ?? Number.parseInt(process.env.OUTPUT_ARCHIVE_POLL_INTERVAL_MS || "2000", 10));
  const leaseMs = Math.max(5_000, options.leaseMs ?? Number.parseInt(process.env.OUTPUT_ARCHIVE_LEASE_MS || String(DEFAULT_LEASE_MS), 10));
  const heartbeatMs = Math.min(Math.max(1_000, options.heartbeatMs ?? Number.parseInt(process.env.OUTPUT_ARCHIVE_HEARTBEAT_MS || String(DEFAULT_HEARTBEAT_MS), 10)), Math.floor(leaseMs / 2));
  const ttlMinutes = Math.max(5, options.ttlMinutes ?? Number.parseInt(process.env.OUTPUT_ARCHIVE_TTL_MINUTES || String(OUTPUT_ARCHIVE_CONFIG.ttlMinutes), 10));
  const maxBytes = options.maxBytes ?? OUTPUT_ARCHIVE_CONFIG.maxBytes;
  const reservedDiskBytes = options.reservedDiskBytes ?? OUTPUT_ARCHIVE_CONFIG.reservedDiskBytes;
  let stopped = false;

  async function tick(): Promise<boolean> {
    await cleanupExpired();
    const slot = await acquireGlobalSlot();
    if (!slot) return false;
    try {
      const job = await claimNextJob();
      if (!job) return false;
      await processJob(job);
      return true;
    } finally {
      await releaseGlobalSlot();
    }
  }

  async function run() {
    while (!stopped) {
      try {
        await tick();
      } catch (error) {
        logger.error("output archive worker tick failed", error);
      }
      if (!stopped) await wait(pollIntervalMs);
    }
  }

  function stop() {
    stopped = true;
  }

  async function acquireGlobalSlot() {
    const result = await options.pool.query(
      `update xh_output_archive_dispatch_slots
          set lease_owner = $1, lease_expires_at = now() + ($2::text || ' milliseconds')::interval,
              heartbeat_at = now(), updated_at = now()
        where scope = 'global' and (lease_owner = $1 or lease_expires_at is null or lease_expires_at < now())
      returning scope`,
      [options.workerId, leaseMs],
    );
    return Boolean(result.rowCount);
  }

  async function releaseGlobalSlot() {
    await options.pool.query(
      `update xh_output_archive_dispatch_slots
          set lease_owner = '', lease_expires_at = null, heartbeat_at = null, updated_at = now()
        where scope = 'global' and lease_owner = $1`,
      [options.workerId],
    ).catch(() => undefined);
  }

  async function claimNextJob(): Promise<ArchiveJobRow | null> {
    const owners = await options.pool.query<{ owner_id: string }>(
      `select distinct owner_id
         from xh_output_archive_jobs
        where status = 'queued'
        order by owner_id asc`,
    );
    if (owners.rows.length === 0) return null;
    const cursor = await options.pool.query<{ last_owner_id: string }>(
      `select last_owner_id from xh_output_archive_dispatch_cursors where scope = 'global' limit 1`,
    );
    const lastOwner = cursor.rows[0]?.last_owner_id || "";
    const nextOwner = owners.rows.find((row) => row.owner_id > lastOwner)?.owner_id || owners.rows[0].owner_id;
    const result = await options.pool.query<ArchiveJobRow>(
      `with candidate as (
        select id
          from xh_output_archive_jobs
         where owner_id = $1 and status = 'queued'
         order by created_at asc, id asc
         for update skip locked
         limit 1
      )
      update xh_output_archive_jobs job
         set status = 'running', lease_owner = $2,
             lease_expires_at = now() + ($3::text || ' milliseconds')::interval,
             heartbeat_at = now(), updated_at = now()
        from candidate
       where job.id = candidate.id
      returning job.id, job.owner_id, job.source_task_id, job.archive_filename, job.manifest`,
      [nextOwner, options.workerId, leaseMs],
    );
    if (!result.rows[0]) return null;
    await options.pool.query(
      `update xh_output_archive_dispatch_cursors set last_owner_id = $1, updated_at = now() where scope = 'global'`,
      [nextOwner],
    );
    return result.rows[0];
  }

  async function processJob(job: ArchiveJobRow) {
    const manifest = normalizeManifest(job.manifest, job.source_task_id);
    const archiveDir = join(options.dataDir, "users", safeOwner(job.owner_id), "output-archives");
    await mkdir(archiveDir, { recursive: true });
    const finalName = `${job.id}.zip`;
    const partPath = join(archiveDir, `.${finalName}.part`);
    const finalPath = join(archiveDir, finalName);
    const missing: OutputArchiveManifest["missing"] = [];
    let totalBytes = 0;
    let stream: ReturnType<typeof createWriteStream> | null = null;
    let archive: ZipArchiveType | null = null;
    let archiveError: Error | null = null;
    const heartbeat = setInterval(() => {
      void heartbeatJob(job.id).catch(() => undefined);
    }, heartbeatMs);
    try {
      const available = await statfs(archiveDir).catch(() => null);
      if (available && Number(available.bavail) * Number(available.bsize) < reservedDiskBytes) {
        throw new Error("insufficient_archive_disk");
      }
      stream = createWriteStream(partPath, { flags: "wx" });
      archive = new ZipArchive({ store: true, zlib: { level: 0 } });
      archive.on("warning", (error: ArchiverError) => logger.warn("output archive warning", error));
      archive.on("error", (error: ArchiverError) => { archiveError = error; });
      archive.pipe(stream);
      for (const file of manifest.files) {
        if (await isCancellationRequested(job.id)) throw new Error("cancelled");
        if (!file.sourceUrl.startsWith("/files/output/")) {
          missing.push({ sourceUrl: file.sourceUrl, reason: "archive_source_invalid" });
          continue;
        }
        const filename = decodeURIComponent(file.sourceUrl.slice("/files/output/".length));
        if (!filename || filename.includes("..") || /[\\/]/.test(filename)) {
          missing.push({ sourceUrl: file.sourceUrl, reason: "archive_source_invalid" });
          continue;
        }
        const sourcePath = join(options.dataDir, "users", safeOwner(job.owner_id), "output", filename);
        const info = await stat(sourcePath).catch(() => null);
        if (!info?.isFile()) {
          missing.push({ sourceUrl: file.sourceUrl, reason: "source_missing" });
          continue;
        }
        totalBytes += info.size;
        if (totalBytes > maxBytes) throw new Error("archive_too_large");
        archive.append(createReadStream(sourcePath), { name: file.archivePath });
      }
      if (totalBytes <= 0) throw new Error("no_materialized_outputs");
      archive.append(JSON.stringify({ ...manifest, missing, fileCount: manifest.files.length - missing.length, sourceBytes: totalBytes }, null, 2), { name: "manifest.json" });
      await archive.finalize();
      await onceClosed(stream);
      if (archiveError) throw archiveError;
      await rename(partPath, finalPath);
      await options.pool.query(
        `update xh_output_archive_jobs
            set status = 'ready', archive_bytes = $2, archive_relative_path = $3,
                manifest = $4::jsonb, expires_at = now() + ($5::text || ' minutes')::interval,
                lease_owner = null, lease_expires_at = null, heartbeat_at = null, updated_at = now()
          where id = $1 and lease_owner = $6`,
        [job.id, (await stat(finalPath)).size, finalName, JSON.stringify({ ...manifest, missing, fileCount: manifest.files.length - missing.length, sourceBytes: totalBytes }), ttlMinutes, options.workerId],
      );
    } catch (error) {
      await rm(partPath, { force: true }).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      const code = (message === "cancelled" ? "cancelled" : normalizeErrorCode(message)) as OutputArchiveErrorCode | "cancelled";
      await options.pool.query(
        `update xh_output_archive_jobs
            set status = $2, error_code = $3, lease_owner = null, lease_expires_at = null, heartbeat_at = null, updated_at = now()
          where id = $1 and lease_owner = $4`,
        [job.id, code === "cancelled" ? "cancelled" : "failed", code === "cancelled" ? null : code, options.workerId],
      ).catch(() => undefined);
    } finally {
      clearInterval(heartbeat);
      archive?.abort();
      stream?.destroy();
    }
  }

  async function heartbeatJob(jobId: string) {
    await options.pool.query(
      `update xh_output_archive_jobs
          set lease_expires_at = now() + ($2::text || ' milliseconds')::interval, heartbeat_at = now(), updated_at = now()
        where id = $1 and lease_owner = $3 and status = 'running'`,
      [jobId, leaseMs, options.workerId],
    );
  }

  async function isCancellationRequested(jobId: string) {
    const result = await options.pool.query<{ cancel_requested_at: Date | null }>(
      `select cancel_requested_at from xh_output_archive_jobs where id = $1 and lease_owner = $2`,
      [jobId, options.workerId],
    );
    return Boolean(result.rows[0]?.cancel_requested_at);
  }

  async function cleanupExpired() {
    const jobs = await options.pool.query<{ id: string; owner_id: string; archive_relative_path: string | null }>(
      `select id, owner_id, archive_relative_path
         from xh_output_archive_jobs
        where (expires_at is not null and expires_at <= now() and status in ('ready', 'downloaded'))
           or (status = 'cancelled' and archive_relative_path is not null)`,
    );
    for (const job of jobs.rows) {
      if (job.archive_relative_path) {
        await rm(join(options.dataDir, "users", safeOwner(job.owner_id), "output-archives", job.archive_relative_path), { force: true }).catch(() => undefined);
      }
      await options.pool.query(
        `update xh_output_archive_jobs set status = case when status = 'cancelled' then 'cancelled' else 'expired' end, archive_relative_path = null, updated_at = now() where id = $1`,
        [job.id],
      );
    }
    await options.pool.query(`update xh_output_archive_jobs set status = 'queued', error_code = null, lease_owner = null, lease_expires_at = null, heartbeat_at = null, updated_at = now() where status = 'running' and lease_expires_at < now()`).catch(() => undefined);
  }

  return { run, stop, tick, cleanupExpired };
}

function normalizeManifest(value: unknown, taskId: string): OutputArchiveManifest {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const files = Array.isArray(raw.files) ? raw.files.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const sourceUrl = String(file.sourceUrl || "");
    const archivePath = String(file.archivePath || "");
    if (!sourceUrl || !archivePath) return [];
    return [{ artifactId: file.artifactId ? String(file.artifactId) : undefined, sourceUrl, archivePath, kind: String(file.kind || "other"), sourceBytes: Number(file.sourceBytes) || 0 }];
  }) : [];
  return { schemaVersion: 1, sourceTaskId: String(raw.sourceTaskId || taskId), createdAt: String(raw.createdAt || new Date().toISOString()), files, missing: [], fileCount: files.length, sourceBytes: files.reduce((sum, file) => sum + file.sourceBytes, 0) };
}

function normalizeErrorCode(message: string): OutputArchiveErrorCode {
  if (message === "archive_too_large" || message === "insufficient_archive_disk" || message === "no_materialized_outputs" || message === "archive_source_invalid") return message;
  return "archive_source_invalid";
}

function safeOwner(ownerId: string) {
  const value = String(ownerId || "").trim();
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error("ARCHIVE_OWNER_INVALID");
  return value;
}

function onceClosed(stream: ReturnType<typeof createWriteStream>) {
  return new Promise<void>((resolveClosed, reject) => {
    stream.once("close", () => resolveClosed());
    stream.once("error", reject);
  });
}
