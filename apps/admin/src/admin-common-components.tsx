import type { ReactNode } from "react";
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
