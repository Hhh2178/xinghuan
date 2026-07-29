import { AlertTriangle, Check, CircleCheck, CirclePause, Clock3, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  buildActivityCases,
  type ActivityCase,
  type ActivityCaseKind,
} from "./admin-agent-activity-view-model";
import { adminAgentGovernanceApi, type AgentApproval, type AgentAuditRecord, type AgentRunsData, type RecoveryDecision } from "./admin-agent-governance-api";
import { AdminGovernanceLayout } from "./admin-governance-workbench";
import type { ModelRecord } from "./admin-types";

interface Props {
  runs: AgentRunsData;
  approvals: AgentApproval[];
  recovery: RecoveryDecision[];
  audit: AgentAuditRecord[];
  models: ModelRecord[];
  busy: boolean;
  mutate: (work: () => Promise<unknown>) => Promise<void>;
}

type ActivityFilter = "all" | ActivityCaseKind;

export function AdminAgentActivityWorkspace({ runs, approvals, recovery, audit, models, busy, mutate }: Props) {
  const cases = useMemo(() => buildActivityCases({ runs, approvals, recovery, audit, models }), [audit, approvals, models, recovery, runs]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const filtered = filter === "all" ? cases : cases.filter((item) => item.kind === filter);
  const [selectedId, setSelectedId] = useState(filtered[0]?.id || "");
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0];

  useEffect(() => {
    if (!filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0]?.id || "");
  }, [filtered, selectedId]);

  const counts = {
    approval: cases.filter((item) => item.kind === "approval").length,
    failed: cases.filter((item) => item.kind === "failed").length,
    degraded: cases.filter((item) => item.kind === "degraded").length,
    recovered: cases.filter((item) => item.kind === "recovered").length,
  };

  return <div className="agent-activity-workbench">
    <div className="agent-activity-metrics">
      <Metric label="等待处理" value={counts.approval} tone="warning" />
      <Metric label="失败运行" value={counts.failed} tone="danger" />
      <Metric label="降级或转人工" value={counts.degraded} />
      <Metric label="恢复成功" value={counts.recovered} tone="success" />
    </div>
    <AdminGovernanceLayout
      className="admin-governance-layout--activity"
      rail={
        <section className="agent-activity-queue">
        <header><div><strong>需要关注</strong><span>按风险和时间排序</span></div><span>{filtered.length} 项</span></header>
        <div className="agent-activity-filters" role="tablist" aria-label="运行处置筛选">
          {([
            ["all", "全部", cases.length], ["approval", "待审批", counts.approval], ["failed", "失败", counts.failed],
            ["degraded", "已降级", counts.degraded], ["recovered", "已恢复", counts.recovered],
          ] as Array<[ActivityFilter, string, number]>).map(([id, label, count]) => <button type="button" role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} key={id} onClick={() => setFilter(id)}>{label} <span>{count}</span></button>)}
        </div>
        <div className="agent-activity-list">
          {filtered.length ? filtered.map((item) => <button type="button" key={item.id} className={`agent-activity-case agent-activity-case--${item.kind}${selected?.id === item.id ? " selected" : ""}`} onClick={() => setSelectedId(item.id)}>
            <CaseIcon kind={item.kind} />
            <span><strong>{item.title}</strong><small>{item.summary}</small><em>{item.ownerEmail} · {formatTime(item.createdAt)}</em></span>
            <Status value={item.status} />
          </button>) : <div className="agent-activity-empty"><CirclePause aria-hidden="true" /><strong>当前筛选下没有需要处理的记录</strong><span>运行证据仍保留在底层账本中。</span></div>}
        </div>
        </section>
      }
    >
      <section className="agent-activity-detail" aria-live="polite">
        {selected ? <ActivityDetail value={selected} busy={busy} mutate={mutate} /> : <div className="agent-activity-empty"><ShieldCheck aria-hidden="true" /><strong>没有待处置事项</strong><span>新的失败、降级或审批会按风险出现在左侧。</span></div>}
      </section>
    </AdminGovernanceLayout>
  </div>;
}

function ActivityDetail({ value, busy, mutate }: { value: ActivityCase; busy: boolean; mutate: Props["mutate"] }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [value.id]);

  async function decide(status: "approved" | "rejected") {
    if (!value.approval || !reason.trim()) return;
    const action = status === "approved" ? "批准" : "拒绝";
    if (!window.confirm(`${action}此动作？${value.impact}`)) return;
    await mutate(() => adminAgentGovernanceApi.decideApproval(value.approval!.id, status, reason.trim()));
  }

  return <>
    <header className="agent-activity-detail__header"><div><strong>{value.title}</strong><span>{value.ownerEmail} · {value.canvasRunId}</span></div><Status value={value.status} /></header>
    <div className="agent-activity-detail__body">
      <div className="agent-activity-impact"><AlertTriangle aria-hidden="true" /><div><strong>批准后的影响</strong><span>{value.impact}</span></div></div>
      <div className="agent-activity-facts">
        <Fact label="运行" value={value.canvasRunId} technical />
        <Fact label="步骤" value={value.runStepId || "整个 Workflow Run"} technical={Boolean(value.runStepId)} />
        <Fact label="当前模型" value={value.currentModelName || "未记录"} />
        <Fact label="目标模型" value={value.targetModelName || "不切换"} />
      </div>
      <div className="agent-activity-timeline"><h4>证据时间线</h4>{value.timeline.map((item) => <div key={item.id}><span><Clock3 aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.detail}</small><em>{formatTime(item.createdAt)}</em></div></div>)}</div>
      {value.approval?.status === "pending" ? <div className="agent-activity-approval"><label><span>决策理由</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明批准或拒绝的依据，内容将写入审计。" rows={3} /></label><div><button type="button" className="danger-action" disabled={busy || !reason.trim()} onClick={() => void decide("rejected")}><X aria-hidden="true" />拒绝</button><button type="button" className="primary-action" disabled={busy || !reason.trim()} onClick={() => void decide("approved")}><Check aria-hidden="true" />批准并继续</button></div></div> : null}
    </div>
  </>;
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number; tone?: string }) {
  return <div className={`agent-activity-metric agent-activity-metric--${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Fact({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return <div><span>{label}</span>{technical ? <code>{value}</code> : <strong>{value}</strong>}</div>;
}

function CaseIcon({ kind }: { kind: ActivityCaseKind }) {
  if (kind === "recovered") return <CircleCheck aria-hidden="true" />;
  if (kind === "approval") return <Clock3 aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

function Status({ value }: { value: string }) {
  return <span className={`agent-status agent-status--${value.replace(/_/g, "-")}`}>{statusLabel(value)}</span>;
}

function statusLabel(value: string) {
  return ({ pending: "待审批", failed: "失败", degraded: "已降级", succeeded: "成功", awaiting_approval: "等待审批", approved: "已批准", rejected: "已拒绝" } as Record<string, string>)[value] || value;
}

function formatTime(value: number) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}
