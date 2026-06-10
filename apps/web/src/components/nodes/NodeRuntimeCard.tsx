import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface NodeRuntimeCardProps {
  status?: string | null;
  progress?: string | number | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  lastDurationMs?: number | null;
  accent?: string;
  taskId?: string | null;
}

const RUNNING_STATUSES = new Set(['generating', 'submitting', 'polling', 'running']);

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseProgress(progress?: string | number | null) {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    return clamp(progress);
  }
  if (typeof progress !== 'string') return null;
  const text = progress.trim();
  if (!text) return null;
  const pctMatch = text.match(/(\d{1,3})\s*%/);
  if (pctMatch) return clamp(Number(pctMatch[1]));
  const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const done = Number(fractionMatch[1]);
    const total = Number(fractionMatch[2]);
    if (total > 0) return clamp((done / total) * 100);
  }
  return null;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes} 分 ${seconds} 秒`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours} 小时 ${restMinutes} 分`;
}

function labelForStatus(status?: string | null) {
  if (status === 'success') return '已完成';
  if (status === 'error') return '失败';
  if (status && RUNNING_STATUSES.has(status)) return '运行中';
  return '待执行';
}

export default function NodeRuntimeCard({
  status,
  progress,
  startedAt,
  finishedAt,
  lastDurationMs,
  accent = '#38bdf8',
  taskId,
}: NodeRuntimeCardProps) {
  const running = Boolean(status && RUNNING_STATUSES.has(status));
  const visible = running || status === 'success' || status === 'error' || Boolean(startedAt || finishedAt || lastDurationMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || typeof startedAt !== 'number' || typeof finishedAt === 'number') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finishedAt, running, startedAt]);

  const progressValue = useMemo(() => parseProgress(progress), [progress]);
  if (!visible) return null;

  const elapsedMs =
    typeof lastDurationMs === 'number'
      ? lastDurationMs
      : typeof startedAt === 'number' && typeof finishedAt === 'number'
        ? Math.max(0, finishedAt - startedAt)
        : typeof startedAt === 'number' && running
          ? Math.max(0, now - startedAt)
          : 0;

  const progressText =
    typeof progress === 'string' && progress.trim()
      ? progress.trim()
      : typeof progressValue === 'number'
        ? `${Math.round(progressValue)}%`
        : running
          ? '处理中'
          : status === 'success'
            ? '100%'
            : status === 'error'
              ? '异常结束'
              : '等待运行';

  const style = {
    '--node-runtime-accent': accent,
    '--node-runtime-progress': `${progressValue ?? 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`node-runtime-card${progressValue === null && running ? ' node-runtime-card--indeterminate' : ''}`}
      style={style}
    >
      <div className="node-runtime-card__head">
        <strong>{labelForStatus(status)}</strong>
        <span>{progressText}</span>
      </div>
      <div className="node-runtime-card__bar">
        <span className="node-runtime-card__bar-fill" />
      </div>
      <div className="node-runtime-card__meta">
        <small>{formatDuration(elapsedMs)}</small>
        {taskId ? <small className="node-runtime-card__task">{String(taskId).slice(0, 10)}…</small> : null}
      </div>
    </div>
  );
}
