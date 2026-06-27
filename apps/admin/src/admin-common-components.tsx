import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "./admin-view-model";

export function DataTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <AdminTable title={title}>
      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
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

export function FormPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="form-panel">
      <header><Icon aria-hidden="true" /><h2>{title}</h2></header>
      <div className="form-grid">{children}</div>
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
    <section className={className ? `admin-workspace-band ${className}` : "admin-workspace-band"}>
      <div className="admin-workspace-band__main">
        <div className="admin-workspace-band__copy">
          <span className="admin-workspace-band__kicker">{kicker}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="admin-workspace-band__focus">
          <div className="admin-workspace-band__focus-copy">
            <span className="admin-workspace-band__focus-label">当前页面</span>
            <strong>{currentLabel}</strong>
            <p>{currentDescription}</p>
          </div>
          {actions ? <div className="admin-workspace-band__actions">{actions}</div> : null}
        </div>
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
