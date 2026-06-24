import type { ReactNode } from 'react';

interface ApiSettingsFormBlockProps {
  title: string;
  note?: string;
  className: string;
  labelClassName: string;
  hintClassName: string;
  children: ReactNode;
}

export default function ApiSettingsFormBlock({
  title,
  note,
  className,
  labelClassName,
  hintClassName,
  children,
}: ApiSettingsFormBlockProps) {
  return (
    <section className={className}>
      <div className="space-y-1">
        <div className={`text-xs font-black ${labelClassName}`}>{title}</div>
        {note && <p className={`text-[11px] leading-relaxed ${hintClassName}`}>{note}</p>}
      </div>
      {children}
    </section>
  );
}
