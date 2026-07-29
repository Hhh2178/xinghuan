import type { ReactNode } from 'react';

interface NodePresentationProps {
  kind: string;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}

interface NodePresentationSectionProps {
  title: string;
  tone?: 'default' | 'accent' | 'runtime';
  children: ReactNode;
}

export function NodePresentation({ kind, title, status, children }: NodePresentationProps) {
  return (
    <section className="t8-node-presentation" data-node-presentation={kind}>
      <header className="t8-node-presentation__header">
        <h3>{title}</h3>
        {status ? <span className="t8-node-presentation__status">{status}</span> : null}
      </header>
      <div className="t8-node-presentation__body">{children}</div>
    </section>
  );
}

export function NodePresentationSection({ title, tone = 'default', children }: NodePresentationSectionProps) {
  return (
    <section className="t8-node-presentation__section" data-tone={tone}>
      <h4>{title}</h4>
      <div className="t8-node-presentation__section-body">{children}</div>
    </section>
  );
}

export function NodePresentationKeyGrid({ children }: { children: ReactNode }) {
  return <div className="t8-node-presentation__key-grid">{children}</div>;
}
