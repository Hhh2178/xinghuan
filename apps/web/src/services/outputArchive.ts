export type OutputArchiveStatus = 'queued' | 'running' | 'ready' | 'downloaded' | 'failed' | 'cancelled' | 'expired';

export interface OutputArchiveJob {
  jobId: string;
  status: OutputArchiveStatus;
  reused: boolean;
  fileCount: number;
  sourceBytes: number;
  archiveBytes?: number;
  errorCode?: string;
  expiresAt?: string;
  archiveFilename?: string;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('归档接口返回了无效响应');
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await readJson(response);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || `HTTP ${response.status}`);
  return (payload?.data ?? payload) as T;
}

export function createTaskOutputArchive(taskId: string) {
  return request<OutputArchiveJob>(`/api/tasks/${encodeURIComponent(taskId)}/output-archives`, { method: 'POST' });
}

export function getOutputArchive(jobId: string) {
  return request<OutputArchiveJob>(`/api/output-archives/${encodeURIComponent(jobId)}`);
}

export function cancelOutputArchive(jobId: string) {
  return request<OutputArchiveJob>(`/api/output-archives/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

export function downloadOutputArchive(jobId: string, filename?: string) {
  const anchor = document.createElement('a');
  anchor.href = `/api/output-archives/${encodeURIComponent(jobId)}/download`;
  anchor.download = filename || `${jobId}.zip`;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
