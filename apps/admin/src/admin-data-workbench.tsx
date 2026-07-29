import type { ReactNode } from "react";

import { StatusPill } from "./admin-common-components";
import type { StatusTone } from "./admin-view-model";

export type AdminDataMode = "overview" | "realtime" | "analytics";

function classNames(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function AdminDataWorkbench({
  label,
  mode,
  className,
  children,
}: {
  label: string;
  mode: AdminDataMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={classNames("admin-data-workbench", className)}
      data-admin-template="data"
      data-data-mode={mode}
      aria-label={label}
    >
      {children}
    </section>
  );
}

export function AdminDataContext({
  eyebrow,
  title,
  description,
  status,
  actions,
  meta,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: { label: ReactNode; tone: StatusTone };
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classNames("admin-data-context", className)}>
      <div className="admin-data-context__copy">
        <span className="admin-data-context__eyebrow">{eyebrow}</span>
        <strong className="admin-data-context__title">{title}</strong>
        {description ? <span className="admin-data-context__description">{description}</span> : null}
      </div>
      {status || actions ? (
        <div className="admin-data-context__actions">
          {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
          {actions}
        </div>
      ) : null}
      {meta ? <div className="admin-data-context__meta">{meta}</div> : null}
    </header>
  );
}

export function AdminDataToolbar({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={classNames("admin-data-toolbar", className)}
      role="group"
      aria-label={label}
    >
      {children}
    </section>
  );
}
