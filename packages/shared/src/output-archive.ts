export const OUTPUT_ARCHIVE_CONFIG = {
  globalConcurrency: 1,
  maxPendingPerOwner: 2,
  ttlMinutes: 120,
  maxBytes: 8 * 1024 * 1024 * 1024,
  reservedDiskBytes: 10 * 1024 * 1024 * 1024,
} as const;

export const outputArchiveStatuses = [
  "queued",
  "running",
  "ready",
  "downloaded",
  "failed",
  "cancelled",
  "expired",
] as const;

export type OutputArchiveStatus = typeof outputArchiveStatuses[number];

export const outputArchiveErrorCodes = [
  "archive_too_large",
  "insufficient_archive_disk",
  "too_many_pending_archives",
  "no_materialized_outputs",
  "source_task_not_terminal",
  "archive_source_invalid",
] as const;

export type OutputArchiveErrorCode = typeof outputArchiveErrorCodes[number];

export interface OutputArchiveJobSummary {
  jobId: string;
  status: OutputArchiveStatus;
  reused: boolean;
  fileCount: number;
  sourceBytes: number;
  archiveBytes?: number;
  errorCode?: OutputArchiveErrorCode;
  expiresAt?: string;
}

export interface OutputArchiveManifestFile {
  artifactId?: string;
  sourceUrl: string;
  archivePath: string;
  kind: string;
  sourceBytes: number;
}

export interface OutputArchiveManifest {
  schemaVersion: 1;
  sourceTaskId: string;
  createdAt: string;
  files: OutputArchiveManifestFile[];
  missing: Array<{ sourceUrl: string; reason: string }>;
  fileCount: number;
  sourceBytes: number;
}
