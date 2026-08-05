import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTaskOutputArchive,
  downloadOutputArchive,
  getOutputArchive,
  type OutputArchiveJob,
} from '../../services/outputArchive';

interface AutoDownloadTaskArchiveOptions {
  taskId?: string;
  taskStatus: string;
  enabled: boolean;
  archiveJobId?: string;
  archiveStatus?: OutputArchiveJob['status'];
  autoDownloadedJobId?: string;
  onStateChange?: (state: Partial<OutputArchiveNodeState>) => void;
}

export interface OutputArchiveNodeState {
  archiveJobId?: string;
  archiveStatus?: OutputArchiveJob['status'];
  archiveFilename?: string;
  autoDownloadedJobId?: string;
  archiveError?: string;
}

export function shouldTriggerAutomaticArchiveDownload(
  status: OutputArchiveJob['status'],
  alreadyDownloaded: boolean,
) {
  return status === 'ready' && !alreadyDownloaded;
}

export function shouldContinueArchivePolling(status: OutputArchiveJob['status']) {
  return status === 'queued' || status === 'running';
}

export function shouldSkipPersistedArchiveDownload(
  status: OutputArchiveJob['status'] | undefined,
  forceNewJob: boolean,
) {
  return status === 'downloaded' && !forceNewJob;
}

export function useAutoDownloadTaskArchive(options: AutoDownloadTaskArchiveOptions) {
  const [state, setState] = useState<OutputArchiveNodeState>({});
  const [retryVersion, setRetryVersion] = useState(0);
  const generationRef = useRef<string | null>(null);
  const downloadedRef = useRef<string | null>(null);
  const forceNewJobRef = useRef(false);
  const onStateChangeRef = useRef(options.onStateChange);
  onStateChangeRef.current = options.onStateChange;

  const apply = useCallback((patch: Partial<OutputArchiveNodeState>) => {
    setState((previous) => ({ ...previous, ...patch }));
    onStateChangeRef.current?.(patch);
  }, []);

  const start = useCallback(async (taskId: string) => {
    const job = await createTaskOutputArchive(taskId);
    generationRef.current = taskId;
    apply({
      archiveJobId: job.jobId,
      archiveStatus: job.status,
      archiveFilename: job.archiveFilename,
      archiveError: undefined,
    });
    return job;
  }, [apply]);

  const retry = useCallback(async () => {
    if (!options.taskId) return;
    generationRef.current = null;
    downloadedRef.current = null;
    forceNewJobRef.current = true;
    apply({
      archiveJobId: undefined,
      archiveStatus: undefined,
      archiveFilename: undefined,
      autoDownloadedJobId: undefined,
      archiveError: undefined,
    });
    setRetryVersion((version) => version + 1);
  }, [apply, options.taskId]);

  useEffect(() => {
    if (!options.enabled || options.taskStatus !== 'success' || !options.taskId) return;
    if (generationRef.current === options.taskId) return;
    if (shouldSkipPersistedArchiveDownload(options.archiveStatus, forceNewJobRef.current)) {
      generationRef.current = options.taskId;
      apply({ archiveStatus: 'downloaded' });
      return;
    }
    generationRef.current = options.taskId;
    let cancelled = false;
    let timer: number | undefined;
    const alreadyDownloaded = (jobId: string) =>
      downloadedRef.current === jobId || options.autoDownloadedJobId === jobId;
    const triggerDownload = (job: OutputArchiveJob) => {
      if (alreadyDownloaded(job.jobId)) return;
      downloadedRef.current = job.jobId;
      apply({
        archiveJobId: job.jobId,
        archiveStatus: 'downloaded',
        archiveFilename: job.archiveFilename,
        autoDownloadedJobId: job.jobId,
        archiveError: undefined,
      });
      downloadOutputArchive(job.jobId, job.archiveFilename);
    };
    const poll = async (jobId: string) => {
      const job = await getOutputArchive(jobId);
      if (cancelled) return;
      apply({
        archiveJobId: job.jobId,
        archiveStatus: job.status,
        archiveFilename: job.archiveFilename,
        archiveError: job.errorCode,
      });
      if (shouldTriggerAutomaticArchiveDownload(job.status, alreadyDownloaded(job.jobId))) {
        triggerDownload(job);
        return;
      }
      if (job.status === 'downloaded') {
        return;
      }
      if (shouldContinueArchivePolling(job.status)) timer = window.setTimeout(() => void poll(job.jobId), 2000);
    };
    const initialJobId = forceNewJobRef.current ? undefined : options.archiveJobId;
    forceNewJobRef.current = false;
    const operation = initialJobId ? getOutputArchive(initialJobId) : start(options.taskId);
    void operation
      .then((job) => {
        if (cancelled) return;
        apply({
          archiveJobId: job.jobId,
          archiveStatus: job.status,
          archiveFilename: job.archiveFilename,
          archiveError: job.errorCode,
        });
        if (shouldContinueArchivePolling(job.status)) timer = window.setTimeout(() => void poll(job.jobId), 2000);
        if (shouldTriggerAutomaticArchiveDownload(job.status, alreadyDownloaded(job.jobId))) triggerDownload(job);
      })
      .catch((error) => {
        if (!cancelled) apply({ archiveStatus: 'failed', archiveError: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [apply, options.enabled, options.taskId, options.taskStatus, retryVersion, start]);

  return { ...state, retry };
}
