import type { ReactNode } from "react";

import { StatusPill } from "./admin-common-components";
import type { StatusTone } from "./admin-view-model";

export type AdminGovernanceMode = "governance" | "content" | "automation";

function classNames(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function AdminGovernanceWorkbench({
  label,
  mode,
  className,
  children,
}: {
  label: string;
  mode: AdminGovernanceMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={classNames("admin-governance-workbench", className)}
      data-admin-template="governance"
      data-governance-mode={mode}
      aria-label={label}
    >
      {children}
    </section>
  );
}

export function AdminGovernanceContext({
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
    <header className={classNames("admin-governance-context", className)}>
      <div className="admin-governance-context__copy">
        <span className="admin-governance-context__eyebrow">{eyebrow}</span>
        <strong className="admin-governance-context__title">{title}</strong>
        {description ? <span className="admin-governance-context__description">{description}</span> : null}
      </div>
      {status || actions ? (
        <div className="admin-governance-context__actions">
          {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
          {actions}
        </div>
      ) : null}
      {meta ? <div className="admin-governance-context__meta">{meta}</div> : null}
    </header>
  );
}

export function AdminGovernanceLayout({
  rail,
  children,
  inspector,
  className,
}: {
  rail?: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames("admin-governance-layout", className)}
      data-has-rail={rail ? "true" : "false"}
      data-has-inspector={inspector ? "true" : "false"}
    >
      {rail ? <aside className="admin-governance-layout__rail" data-workbench-slot="rail">{rail}</aside> : null}
      <div className="admin-governance-layout__editor" data-workbench-slot="editor">{children}</div>
      {inspector ? <aside className="admin-governance-layout__inspector" data-workbench-slot="inspector">{inspector}</aside> : null}
    </div>
  );
}

export function AdminGovernanceToolbar({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classNames("admin-governance-toolbar", className)}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}
