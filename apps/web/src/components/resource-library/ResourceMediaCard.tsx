import type { ReactNode } from 'react';

interface ResourceMediaCardProps {
  className?: string;
  title: string;
  subtitle: string;
  media: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
}

export function ResourceMediaCard({ className = '', title, subtitle, media, actions, children }: ResourceMediaCardProps) {
  return (
    <article className={`overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] transition-transform ${className}`.trim()}>
      <div className="relative h-28 overflow-hidden bg-black/80">
        {media}
      </div>
      <div className="space-y-1.5 p-2">
        <div className="truncate text-xs font-medium" title={title}>{title}</div>
        <div className="truncate text-[10px] text-white/55">{subtitle}</div>
        {children}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
          {actions}
        </div>
      </div>
    </article>
  );
}
