import type { ReactNode } from "react";
import { RotateCcw, Save } from "lucide-react";
import { StatusPill } from "./admin-common-components";
import type { StatusTone } from "./admin-view-model";

function classNames(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function AdminConfigurationWorkbench({
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
      className={classNames("admin-configuration-workbench", className)}
      data-admin-template="configuration"
      aria-label={label}
    >
      {children}
    </section>
  );
}

export function AdminConfigurationContext({
  eyebrow,
  title,
  description,
  status,
  actions,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  status?: { label: ReactNode; tone: StatusTone };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classNames("admin-configuration-context", className)}>
      <div className="admin-configuration-context__copy">
        <span className="admin-configuration-context__eyebrow">{eyebrow}</span>
        <strong className="admin-configuration-context__title">{title}</strong>
        {description ? <span className="admin-configuration-context__description">{description}</span> : null}
      </div>
      {status || actions ? (
        <div className="admin-configuration-context__actions">
          {status ? <span data-tone={status.tone}><StatusPill tone={status.tone}>{status.label}</StatusPill></span> : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function AdminConfigurationLayout({
  rail,
  children,
  inspector,
  className,
}: {
  rail: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames("admin-configuration-layout", className)}
      data-has-inspector={inspector ? "true" : "false"}
    >
      <aside className="admin-configuration-layout__rail" data-workbench-slot="rail">{rail}</aside>
      <div className="admin-configuration-layout__editor" data-workbench-slot="editor">{children}</div>
      {inspector ? <aside className="admin-configuration-layout__inspector" data-workbench-slot="inspector">{inspector}</aside> : null}
    </div>
  );
}

export function AdminConfigurationSaveBar({
  dirty,
  saving,
  onReset,
  onSave,
  cleanLabel = "Configuration synchronized",
  dirtyLabel = "Unsaved configuration changes",
  resetLabel = "Reset",
  saveLabel = "Save",
}: {
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  cleanLabel?: string;
  dirtyLabel?: string;
  resetLabel?: string;
  saveLabel?: string;
}) {
  const disabled = !dirty || saving;
  return (
    <div className="admin-configuration-savebar" data-dirty={dirty ? "true" : "false"}>
      <div className="admin-configuration-savebar__status">
        <StatusPill tone={dirty ? "warning" : "success"}>{dirty ? dirtyLabel : cleanLabel}</StatusPill>
      </div>
      <div className="admin-configuration-savebar__actions">
        <button type="button" className="ghost-action" disabled={disabled} onClick={onReset}>
          <RotateCcw aria-hidden="true" /> {resetLabel}
        </button>
        <button type="button" className="primary-action" disabled={disabled} onClick={onSave}>
          <Save aria-hidden="true" /> {saving ? `${saveLabel}...` : saveLabel}
        </button>
      </div>
    </div>
  );
}
