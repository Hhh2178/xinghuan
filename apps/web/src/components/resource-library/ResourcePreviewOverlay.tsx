import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ResourcePreviewOverlayProps {
  title: string;
  filename?: string;
  media: ReactNode;
  downloadUrl?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function ResourcePreviewOverlay({
  title,
  filename,
  media,
  downloadUrl,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  onClose,
}: ResourcePreviewOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="素材预览"
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="mt-1 text-[11px] text-white/55">{filename || title}</div>
          </div>
          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10"
                title="下载"
              >
                <Download size={13} /> 下载
              </a>
            )}
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-black">
          {hasPrev && onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
              title="上一项"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {hasNext && onNext && (
            <button
              onClick={onNext}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white"
              title="下一项"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <div className="flex h-full w-full items-center justify-center p-4">
            {media}
          </div>
        </div>
      </div>
    </div>
  );
}
