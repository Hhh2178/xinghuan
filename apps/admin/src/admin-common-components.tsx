import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "./admin-view-model";

export interface AdminSummaryItem {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: LucideIcon;
  tone?: StatusTone;
}

export function AdminWorkspaceFrame({
  className = "",
  labelledBy = "admin-page-title",
  children,
}: {
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={className ? `admin-workspace-frame ${className}` : "admin-workspace-frame"}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}

export function AdminSummaryStrip({
  label,
  items,
}: {
  label: string;
  items: AdminSummaryItem[];
}) {
  return (
    <section className="admin-summary-strip" aria-label={label}>
      <dl className="admin-summary-strip__items">
        {items.map(({ label: itemLabel, value, detail, icon: Icon, tone = "muted" }) => (
          <div className="admin-summary-strip__item" data-tone={tone} key={itemLabel}>
            <Icon aria-hidden="true" />
            <div className="admin-summary-strip__copy">
              <dt>{itemLabel}</dt>
              <dd><strong>{value}</strong><small>{detail}</small></dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DataTable({
  title,
  columns,
  rows,
  emptyLabel = "暂无数据",
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
  emptyLabel?: string;
}) {
  return (
    <AdminTable title={title}>
      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>
        {rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : (
          <tr><td colSpan={columns.length}><div className="admin-table-empty">{emptyLabel}</div></td></tr>
        )}
      </tbody>
    </AdminTable>
  );
}

export function AdminTable({
  title,
  toolbar,
  tableWrapClassName,
  children,
}: {
  title: string;
  toolbar?: ReactNode;
  tableWrapClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="data-panel">
      <header><h2>{title}</h2></header>
      {toolbar ? <div className="table-toolbar">{toolbar}</div> : null}
      <div className={tableWrapClassName ? `table-wrap ${tableWrapClassName}` : "table-wrap"}><table>{children}</table></div>
    </section>
  );
}

export function FormPanel({
  title,
  icon: Icon,
  bodyClassName = "form-grid",
  children,
}: {
  title: string;
  icon: LucideIcon;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-panel">
      <header><Icon aria-hidden="true" /><h2>{title}</h2></header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function AdminWorkspaceBand({
  className = "",
  kicker,
  title,
  description,
  currentLabel,
  currentDescription,
  actions,
  footer,
}: {
  className?: string;
  kicker: string;
  title: string;
  description: string;
  currentLabel: string;
  currentDescription: string;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section
      className={className ? `admin-workspace-band ${className}` : "admin-workspace-band"}
      aria-description={description}
    >
      <div className="admin-workspace-band__main">
        <div className="admin-workspace-band__copy">
          <span className="admin-workspace-band__kicker">{title} · {kicker}</span>
          <h1 id="admin-page-title">{currentLabel}</h1>
          <p>{currentDescription}</p>
        </div>
        {actions ? <div className="admin-workspace-band__actions">{actions}</div> : null}
      </div>
      {footer ? <div className="admin-workspace-band__footer">{footer}</div> : null}
    </section>
  );
}

export function AdminBandTabButton({
  active = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "admin-workspace-band__tab active" : "admin-workspace-band__tab"}
      {...props}
    >
      {children}
    </button>
  );
}
