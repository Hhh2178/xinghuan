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
  onStateChange?: (state: Partial<OutputArchiveNodeState>) => void;
}

export interface OutputArchiveNodeState {
  archiveJobId?: string;
  archiveStatus?: OutputArchiveJob['status'];
  archiveError?: string;
}

export function useAutoDownloadTaskArchive(options: AutoDownloadTaskArchiveOptions) {
  const [state, setState] = useState<OutputArchiveNodeState>({});
  const generationRef = useRef<string | null>(null);
  const downloadedRef = useRef<string | null>(null);
  const onStateChangeRef = useRef(options.onStateChange);
  onStateChangeRef.current = options.onStateChange;

  const apply = useCallback((patch: Partial<OutputArchiveNodeState>) => {
    setState((previous) => ({ ...previous, ...patch }));
    onStateChangeRef.current?.(patch);
  }, []);

  const start = useCallback(async (taskId: string) => {
    const job = await createTaskOutputArchive(taskId);
    generationRef.current = taskId;
    apply({ archiveJobId: job.jobId, archiveStatus: job.status, archiveError: undefined });
    return job;
  }, [apply]);

  const retry = useCallback(async () => {
    if (!options.taskId) return;
    generationRef.current = null;
    downloadedRef.current = null;
    try {
      await start(options.taskId);
    } catch (error) {
      apply({ archiveStatus: 'failed', archiveError: error instanceof Error ? error.message : String(error) });
    }
  }, [apply, options.taskId, start]);

  useEffect(() => {
    if (!options.enabled || options.taskStatus !== 'success' || !options.taskId) return;
    if (generationRef.current === options.taskId) return;
    generationRef.current = options.taskId;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async (jobId: string) => {
      const job = await getOutputArchive(jobId);
      if (cancelled) return;
      apply({ archiveJobId: job.jobId, archiveStatus: job.status, archiveError: job.errorCode });
      if (job.status === 'ready' || job.status === 'downloaded') {
        if (downloadedRef.current !== job.jobId) {
          downloadedRef.current = job.jobId;
          downloadOutputArchive(job.jobId, job.archiveFilename);
        }
        return;
      }
      if (job.status === 'queued' || job.status === 'running') timer = window.setTimeout(() => void poll(job.jobId), 2000);
    };
    void start(options.taskId)
      .then((job) => {
        if (!cancelled && (job.status === 'queued' || job.status === 'running')) timer = window.setTimeout(() => void poll(job.jobId), 2000);
        if (!cancelled && (job.status === 'ready' || job.status === 'downloaded')) {
          downloadedRef.current = job.jobId;
          downloadOutputArchive(job.jobId, job.archiveFilename);
        }
      })
      .catch((error) => {
        if (!cancelled) apply({ archiveStatus: 'failed', archiveError: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [apply, options.enabled, options.taskId, options.taskStatus, start]);

  return { ...state, retry };
}
