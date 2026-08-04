import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { OutputArchiveStatus } from "@xinghuan/shared";

interface CurrentUserShape { id: string }

interface ArchiveRouteRepository {
  createOrReuse(taskId: string, ownerId: string): Promise<unknown>;
  readJob(jobId: string, ownerId: string): Promise<{
    jobId: string;
    status: OutputArchiveStatus;
    archiveRelativePath?: string;
    archiveFilename?: string;
    expiresAt?: string;
  } | null>;
  cancelJob(jobId: string, ownerId: string): Promise<unknown>;
  markDownloaded(jobId: string, ownerId: string): Promise<void>;
}

export function createOutputArchiveRouteHandler(input: {
  repository: ArchiveRouteRepository;
  currentUser: CurrentUserShape;
  userDataDirs: (ownerId: string) => { archiveDir: string };
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  sendT8: (response: ServerResponse, data: unknown, statusCode?: number, headers?: Record<string, string>) => void;
  toHttpError: (statusCode: number, message: string) => Error;
}) {
  const { repository, currentUser, userDataDirs, request, response, url } = input;
  const run = async <T>(operation: Promise<T>): Promise<T> => {
    try {
      return await operation;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const knownStatus = message === "ARCHIVE_TASK_NOT_FOUND" || message === "no_materialized_outputs" ? 409
        : message === "OUTPUT_ARCHIVE_POSTGRES_REQUIRED" ? 503
          : message === "archive_source_invalid" || message === "archive_too_large" || message === "too_many_pending_archives" ? 400
            : 500;
      throw input.toHttpError(knownStatus, message);
    }
  };
  const createMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/output-archives$/);
  if (createMatch && request.method === "POST") {
    return run(repository.createOrReuse(decodeURIComponent(createMatch[1]), currentUser.id))
      .then((data) => { input.sendT8(response, data); return true; });
  }
  const jobMatch = url.pathname.match(/^\/api\/output-archives\/([^/]+)$/);
  if (jobMatch && request.method === "GET") {
    return run(repository.readJob(decodeURIComponent(jobMatch[1]), currentUser.id))
      .then((data) => {
        if (!data) throw input.toHttpError(404, "OUTPUT_ARCHIVE_NOT_FOUND");
        input.sendT8(response, data);
        return true;
      });
  }
  if (jobMatch && request.method === "DELETE") {
    return run(repository.cancelJob(decodeURIComponent(jobMatch[1]), currentUser.id))
      .then((data) => {
        if (!data) throw input.toHttpError(404, "OUTPUT_ARCHIVE_NOT_FOUND");
        input.sendT8(response, data);
        return true;
      });
  }
  const downloadMatch = url.pathname.match(/^\/api\/output-archives\/([^/]+)\/download$/);
  if (downloadMatch && request.method === "GET") {
    return streamArchive(downloadMatch[1]);
  }
  return false;

  async function streamArchive(rawJobId: string) {
    const jobId = decodeURIComponent(rawJobId);
    const job = await run(repository.readJob(jobId, currentUser.id));
    if (!job) throw input.toHttpError(404, "OUTPUT_ARCHIVE_NOT_FOUND");
    if (job.status !== "ready" && job.status !== "downloaded") throw input.toHttpError(409, `OUTPUT_ARCHIVE_NOT_READY:${job.status}`);
    if (!job.archiveRelativePath) throw input.toHttpError(409, "OUTPUT_ARCHIVE_PATH_MISSING");
    const archiveRoot = resolve(userDataDirs(currentUser.id).archiveDir);
    const archivePath = resolve(archiveRoot, job.archiveRelativePath);
    if (archivePath !== archiveRoot && !archivePath.startsWith(`${archiveRoot}\\`) && !archivePath.startsWith(`${archiveRoot}/`)) {
      throw input.toHttpError(403, "OUTPUT_ARCHIVE_INVALID_PATH");
    }
    const info = await stat(archivePath).catch(() => null);
    if (!info?.isFile()) throw input.toHttpError(404, "OUTPUT_ARCHIVE_FILE_MISSING");
    await repository.markDownloaded(jobId, currentUser.id);
    const filename = basename(job.archiveFilename || `${jobId}.zip`).replace(/[\r\n"]+/g, "_");
    response.writeHead(200, {
      "content-type": "application/zip",
      "content-length": String(info.size),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    });
    createReadStream(archivePath).pipe(response);
    return true;
  }
}
