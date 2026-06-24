import { AlertCircle, Loader2 } from 'lucide-react';
import LoopingVideo from '../LoopingVideo';

type RHToolsNodeRuntimeSectionProps = {
  isBusy: boolean;
  status: 'idle' | 'submitting' | 'polling' | 'success' | 'error' | 'cancelled';
  rhProgress: string;
  rhQueueHint: string;
  taskId?: string;
  isCancelling: boolean;
  error: string | null;
  urls: string[];
  hasAutoOutput: boolean;
  border: string;
  accent: string;
  subText: string;
  isLight: boolean;
};

export default function RHToolsNodeRuntimeSection({
  isBusy,
  status,
  rhProgress,
  rhQueueHint,
  taskId,
  isCancelling,
  error,
  urls,
  hasAutoOutput,
  border,
  accent,
  subText,
  isLight,
}: RHToolsNodeRuntimeSectionProps) {
  return (
    <>
      {isBusy ? (
        <div className="px-3 pt-2 shrink-0">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: rhProgress || (status === 'submitting' ? '5%' : '45%'), background: accent }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: accent }}>
            <span>{rhQueueHint || (status === 'submitting' ? '任务提交中' : '任务已提交，正在生成')}</span>
            <span>{rhProgress || (status === 'submitting' ? '5%' : '45%')}</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {isBusy && (
          <div className="flex items-center gap-1 text-[10px]" style={{ color: accent }}>
            <Loader2 size={11} className="animate-spin" />
            {isCancelling
              ? '正在取消任务'
              : (rhQueueHint || (status === 'submitting' ? '任务提交中' : '任务已提交，正在生成'))}
            {taskId && <span className="ml-auto" style={{ color: subText }}>{String(taskId).slice(0, 10)}…</span>}
          </div>
        )}

        {status === 'cancelled' && !isBusy ? (
          <div className="text-[10px]" style={{ color: isLight ? '#92400e' : '#fde68a' }}>
            {rhQueueHint || '任务已取消'}
          </div>
        ) : null}

        {error && (
          <div className="flex items-start gap-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {urls.length > 0 && !hasAutoOutput && (
          <div className="space-y-1 pt-1" style={{ borderTop: `1px solid ${border}` }}>
            {urls.map((url, index) => {
              if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(url)) {
                return <LoopingVideo key={index} src={url} controls className="w-full rounded" />;
              }
              if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(url)) {
                return <audio key={index} src={url} controls className="w-full h-8" />;
              }
              return <img key={index} src={url} alt={`输出 ${index}`} className="w-full rounded object-cover" />;
            })}
          </div>
        )}
      </div>
    </>
  );
}
