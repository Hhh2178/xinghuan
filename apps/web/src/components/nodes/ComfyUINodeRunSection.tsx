import { AlertCircle, Loader2, Play } from 'lucide-react';
import type { CSSProperties } from 'react';

interface ComfyUINodeRunSectionProps {
  status: string;
  progress?: string;
  machineLabel: string;
  error?: string;
  isBusy: boolean;
  runLabel?: string;
  buttonClassName: string;
  buttonStyle: CSSProperties;
  onRun: () => void;
}

export default function ComfyUINodeRunSection({
  status,
  progress,
  machineLabel,
  error,
  isBusy,
  runLabel = '运行 comfyui',
  buttonClassName,
  buttonStyle,
  onRun,
}: ComfyUINodeRunSectionProps) {
  return (
    <section className="space-y-2 rounded border p-2" style={{ borderColor: buttonStyle.borderColor, background: 'rgba(255,255,255,0.03)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black">运行状态</div>
        <div className="text-[10px] opacity-70">{machineLabel || '未选机器'}</div>
      </div>
      <div className="text-[10px] opacity-65">
        {status}{progress ? ` · ${progress}` : ''}
      </div>
      {error ? (
        <div className="flex gap-1 rounded border px-2 py-1 text-[11px] text-red-400" style={{ borderColor: 'rgba(248,113,113,0.45)' }}>
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      ) : null}
      <button type="button" className={`${buttonClassName} w-full py-2 text-sm font-black`} style={buttonStyle} disabled={isBusy} onClick={onRun}>
        {isBusy ? <><Loader2 size={14} className="animate-spin" /> 运行中...</> : <><Play size={14} /> {runLabel}</>}
      </button>
    </section>
  );
}
