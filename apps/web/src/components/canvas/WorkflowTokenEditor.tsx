import { useRef, type UIEvent } from 'react';

import { workflowTokenPresentation } from './workflowTokenPresentation';

export function WorkflowTokenEditor({
  value,
  onChange,
  error,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  className?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!overlayRef.current) return;
    overlayRef.current.scrollTop = event.currentTarget.scrollTop;
    overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className={`relative min-h-[72px] ${className}`}>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-2 py-1.5 text-xs leading-5 text-white"
      >
        {workflowTokenPresentation(value).map((segment, index) => segment.kind === 'token' ? (
          <span key={`${index}-${segment.value}`} className="rounded-sm bg-amber-300 px-0.5 font-semibold text-zinc-950">
            {segment.value}
          </span>
        ) : <span key={`${index}-${segment.value}`}>{segment.value}</span>)}
        {value.endsWith('\n') ? '\n' : null}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        placeholder="输入固定文本，使用 ##变量名## 插入变量"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-invalid={Boolean(error)}
        className={`relative z-10 h-full min-h-[72px] w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-xs leading-5 text-transparent caret-white outline-none placeholder:text-white/30 nodrag nowheel ${
          error ? 'border-red-400/70' : 'border-white/10 focus:border-amber-300/60'
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}
