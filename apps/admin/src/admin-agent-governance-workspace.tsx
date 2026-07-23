import {
  Activity, AlertTriangle, Check, CirclePause, GitBranch, History, ListChecks, Loader2,
  Plus, RefreshCw, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModelRecord } from "./admin-types";
import type { AdminAgentRuntimeViewId } from "./admin-view-model";
import { AdminAgentRoleConfigurationEditor } from "./admin-agent-role-configuration-editor";
import { AdminAgentPoolEditor } from "./admin-agent-pool-editor";
import { AdminAgentQualityEditor } from "./admin-agent-quality-editor";
import { canvasAgentPurpose, purposeRouteTemplates } from "./admin-agent-governance-purpose";
import {
  adminAgentGovernanceApi,
  type AgentApproval,
  type AgentAuditRecord,
  type AgentEnvironment,
  type AgentOverview,
  type AgentRuntimeControl,
  type AgentRunsData,
  type LlmRoutePool,
  type QualityProfile,
  type RecoveryDecision,
  type AgentRoleWorkspaceData,
  type AgentRecoveryWorkspaceData,
} from "./admin-agent-governance-api";

interface Props { activeView: AdminAgentRuntimeViewId; models: ModelRecord[] }
type ModelsData = { roles: AgentRoleWorkspaceData; pools: LlmRoutePool[] };
type PoliciesData = { quality: QualityProfile[]; recovery: AgentRecoveryWorkspaceData };
type ActivityData = { runs: AgentRunsData; approvals: AgentApproval[]; audit: AgentAuditRecord[] };
type Data = AgentOverview | ModelsData | PoliciesData | ActivityData;

export function AdminAgentGovernanceWorkspace({ activeView, models }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const next = await ({
        controls: adminAgentGovernanceApi.overview,
        models: async () => {
          const [roles, pools] = await Promise.all([adminAgentGovernanceApi.roleWorkspace(), adminAgentGovernanceApi.pools()]);
          return { roles, pools };
        },
        policies: async () => {
          const [quality, recovery] = await Promise.all([adminAgentGovernanceApi.qualityProfiles(), adminAgentGovernanceApi.recoveryWorkspace()]);
          return { quality, recovery };
        },
        activity: async () => {
          const [runs, approvals, audit] = await Promise.all([adminAgentGovernanceApi.runs(), adminAgentGovernanceApi.approvals(), adminAgentGovernanceApi.audit()]);
          return { runs, approvals, audit };
        },
      } satisfies Record<AdminAgentRuntimeViewId, () => Promise<Data>>)[activeView]();
      setData(next);
    } catch (nextError) { setError(message(nextError)); }
    finally { setLoading(false); }
  }, [activeView]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(work: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); setNotice("更改已保存"); await load(); }
    catch (nextError) { setError(message(nextError)); }
    finally { setBusy(false); }
  }

  return (
    <section className="agent-governance-workspace">
      <div className="agent-governance-toolbar">
        <div><strong>{viewTitle(activeView)}</strong><span>{viewDescription(activeView)}</span></div>
        <button className="icon-button" type="button" onClick={() => void load()} disabled={loading || busy} title="刷新当前治理视图"><RefreshCw aria-hidden="true" /></button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="agent-success-banner" role="status">{notice}</div> : null}
      {loading ? <Loading /> : (
        <>
          {activeView === "controls" ? <OverviewView value={data as AgentOverview} busy={busy} mutate={mutate} /> : null}
          {activeView === "models" ? <ModelsView value={data as ModelsData} models={models} busy={busy} mutate={mutate} /> : null}
          {activeView === "policies" ? <PoliciesView value={data as PoliciesData} busy={busy} mutate={mutate} /> : null}
          {activeView === "activity" ? <ActivityView value={data as ActivityData} busy={busy} mutate={mutate} /> : null}
        </>
      )}
    </section>
  );
}

function ModelsView({ value, models, busy, mutate }: { value: ModelsData; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const activeDefinitions = { ...value.roles, definitions: value.roles.definitions.filter((definition) => canvasAgentPurpose(definition.agentKey)) };
  const historicalDefinitions = value.roles.definitions.filter((definition) => !canvasAgentPurpose(definition.agentKey));
  return <div className="agent-governance-stack">
    <SectionHead title="用途与模型绑定" description="只管理助手诊断、失败恢复和候选评估。配置仅在新 Run 开始时冻结并生效。" />
    <RolesView value={activeDefinitions} busy={busy} mutate={mutate} />
    <SectionHead title="LLM 路由与回退" description="路由池只接受已发布的聊天模型，并在新 Run 开始时锁定版本。" />
    <PoolsView value={value.pools} models={models.filter((model) => model.capability === "chat" && model.enabled)} busy={busy} mutate={mutate} />
    <HistoricalDefinitions value={historicalDefinitions} />
  </div>;
}

function PoliciesView({ value, busy, mutate }: { value: PoliciesData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-governance-stack">
    <SectionHead title="质量与候选选择" description="质量阈值和置信度策略只作用于显式候选门。" />
    <QualityView value={value.quality} busy={busy} mutate={mutate} />
    <RecoveryView value={value.recovery} busy={busy} mutate={mutate} />
  </div>;
}

function ActivityView({ value, busy, mutate }: { value: ActivityData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-governance-stack">
    <RunsView value={value.runs} />
    <SectionHead title="待处理审批" description="只有超出已发布策略边界的动作需要人工决定。" />
    <ApprovalsView value={value.approvals} busy={busy} mutate={mutate} />
    <SectionHead title="不可变动作审计" description="查看运行决策、工具结果和经过脱敏的错误。" />
    <AuditView value={value.audit} />
  </div>;
}

function OverviewView({ value, busy, mutate }: { value: AgentOverview; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const metrics = value?.metrics || {};
  return <div className="agent-governance-stack">
    <div className="agent-metric-grid">
      <Metric icon={<Activity />} label="活跃 Agent" value={metrics.activeAgentRuns} />
      <Metric icon={<GitBranch />} label="活跃画布运行" value={metrics.activeCanvasRuns} />
      <Metric icon={<AlertTriangle />} label="异常 LLM 路由" value={metrics.unhealthyRoutes} tone={metrics.unhealthyRoutes ? "warning" : "normal"} />
      <Metric icon={<ListChecks />} label="待审批" value={metrics.pendingApprovals} tone={metrics.pendingApprovals ? "warning" : "normal"} />
      <Metric icon={<Sparkles />} label="24h 质量评估" value={metrics.evaluations24h} />
    </div>
    <ActionHead title="环境总开关" action={<button type="button" className="ghost-action" disabled={busy} onClick={() => void mutate(adminAgentGovernanceApi.bootstrap)}><Plus />初始化固定用途草稿</button>} />
    <p className="agent-section-description">环境开关只改变服务端允许范围，不自动发布任何配置。初始化操作也是幂等的，不会覆盖已有角色或配置。</p>
    <div className="agent-control-table">
      {(value?.controls || []).map((control) => <ControlRow key={control.environment} value={control} busy={busy} mutate={mutate} />)}
    </div>
  </div>;
}

function ControlRow({ value, busy, mutate }: { value: AgentRuntimeControl; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const keys: Array<[keyof AgentRuntimeControl, string]> = [["agentEnabled", "Agent"], ["canvasRunsEnabled", "Canvas Run"], ["qualityEvaluationEnabled", "质量评估"], ["automaticRecoveryEnabled", "自动恢复"]];
  return <div className="agent-control-row">
    <div className="agent-control-environment"><EnvironmentBadge value={draft.environment} /><small>revision {draft.revision}</small></div>
    <div className="agent-control-toggles">{keys.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /><span>{label}</span></label>)}</div>
    <button type="button" className="primary-action" disabled={busy || sameControl(draft, value)} onClick={() => void mutate(() => adminAgentGovernanceApi.updateControls(draft))}><Check aria-hidden="true" />应用</button>
  </div>;
}

function RolesView({ value, busy, mutate }: { value: AgentRoleWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.definitions.length} 个固定用途`} action={<span className="agent-status agent-status--enabled">用途受控</span>} />
    {value.definitions.length ? <AdminAgentRoleConfigurationEditor value={value} busy={busy} mutate={mutate} /> : <Empty label="尚未初始化固定用途，请先在运行控制中初始化默认草稿" />}
  </div>;
}

function PoolsView({ value, models, busy, mutate }: { value: LlmRoutePool[]; models: ModelRecord[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const availableTemplates = purposeRouteTemplates.filter((template) => !value.some((pool) => pool.poolKey === template.poolKey));
  const [templateId, setTemplateId] = useState<string>(purposeRouteTemplates[0].id);
  const template = availableTemplates.find((item) => item.id === templateId) || availableTemplates[0];
  return <div className="agent-governance-stack">
    <ActionHead title={`${value.length} 个 LLM 路由池`} action={<button type="button" className="primary-action" disabled={!availableTemplates.length} onClick={() => setCreating(!creating)}><Plus />按用途创建</button>} />
    <div className="scope-note"><ShieldCheck /><span>这里只接受后台模型目录中已启用的 <code>chat</code> 模型。图片、视频、音频生成模型不进入该路由池。</span></div>
    {creating && template ? <InlineForm onSubmit={() => mutate(() => adminAgentGovernanceApi.createPool(template))} disabled={busy} submit="创建用途路由">
      <Field label="用途"><select value={template.id} onChange={(event) => setTemplateId(event.target.value)}>{availableTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
      <Field label="固定标识"><input value={template.poolKey} disabled /></Field>
      <Field label="生效场景"><input value={template.label} disabled /></Field>
    </InlineForm> : null}
    <AdminAgentPoolEditor pools={value} models={models} busy={busy} mutate={mutate} />
  </div>;
}

function HistoricalDefinitions({ value }: { value: AgentRoleWorkspaceData["definitions"] }) {
  if (!value.length) return null;
  return <div className="agent-governance-stack">
    <SectionHead title="历史配置" description="这些定义仅用于兼容历史记录，不可从当前 MVP 编辑，也不会被新的 Canvas AI Run 自动选择。" />
    <div className="scope-note"><History /><span>保留版本和发布记录用于审计；迁移或清理必须通过后续受控流程完成。</span></div>
    <DataTable headers={["名称", "内部标识", "状态", "版本", "历史发布"]}>{value.map((definition) => <tr key={definition.id}><td><strong>{definition.name}</strong></td><td><code>{definition.agentKey}</code></td><td><StatusBadge value={definition.enabled ? "enabled" : "disabled"} /></td><td>{definition.versions.length}</td><td>{definition.publications.map((item) => item.environment === "gray" ? "Gray" : "Production").join(" / ") || "-"}</td></tr>)}</DataTable>
  </div>;
}

function QualityView({ value, busy, mutate }: { value: QualityProfile[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  return <AdminAgentQualityEditor value={value} busy={busy} mutate={mutate} />;
}

function RunsView({ value }: { value: AgentRunsData }) { return <div className="agent-governance-stack"><SectionHead title="Agent Run" description="最近的助手诊断、媒体评估、候选选择与失败恢复运行。" /><RunTable rows={value.agentRuns} /><SectionHead title="Workflow Run" description="按 workflow revision 和冻结执行计划持久化的 Canvas 运行。" /><RunTable rows={value.canvasRuns} /></div>; }
function RecoveryView({ value, busy, mutate }: { value: AgentRecoveryWorkspaceData; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) {
  const roles = { ...value.roles, definitions: value.roles.definitions.filter((definition) => definition.agentKey === "generation-recovery") };
  return <div className="agent-governance-stack"><SectionHead title="恢复策略" description="恢复用途的发布配置决定工具、预算、审批与自动恢复次数。" /><AdminAgentRoleConfigurationEditor value={roles} busy={busy} mutate={mutate} /><SectionHead title="恢复决策账本" description="最近的失败分类、目标模型与审批状态。" /><DataTable headers={["时间", "Owner", "失败分类", "恢复决策", "模型变化", "状态"]}>{value.decisions.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td>{item.ownerEmail}</td><td><StatusBadge value={item.failureClass} /></td><td><strong>{item.decision}</strong><small>{item.reason}</small></td><td><code>{item.currentModelId || "-"}</code><small>{item.targetModelId && item.targetModelId !== item.currentModelId ? `→ ${item.targetModelId}` : "同配置"}</small></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable></div>;
}
function RunTable({ rows }: { rows: AgentRunsData["agentRuns"] }) { return <DataTable headers={["运行", "Owner", "角色 / 场景", "状态", "更新时间"]}>{rows.map((row) => <tr key={row.id}><td><code>{row.id}</code></td><td>{row.ownerEmail}</td><td>{[row.role, row.scenario].filter(Boolean).join(" · ") || row.canvasId}</td><td><StatusBadge value={row.status} /></td><td>{formatTime(row.updatedAt)}</td></tr>)}</DataTable>; }

function ApprovalsView({ value, busy, mutate }: { value: AgentApproval[]; busy: boolean; mutate: (work: () => Promise<unknown>) => Promise<void> }) { return value.length ? <div className="agent-approval-list">{value.map((item) => <div className="agent-approval-row" key={item.id}><div><StatusBadge value={item.status} /><strong>{item.actionType}</strong><span>{item.ownerEmail} · {formatTime(item.createdAt)}</span></div><code>{item.canvasRunId}</code>{item.status === "pending" ? <div><button type="button" className="primary-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.decideApproval(item.id, "approved", "管理员批准"))}><Check />批准</button><button type="button" className="danger-action" disabled={busy} onClick={() => void mutate(() => adminAgentGovernanceApi.decideApproval(item.id, "rejected", "管理员拒绝"))}><X />拒绝</button></div> : <p>{item.decisionReason}</p>}</div>)}</div> : <Empty label="没有待处理或近期审批" />; }
function AuditView({ value }: { value: AgentAuditRecord[] }) { return <DataTable headers={["时间", "Agent Run", "动作", "工具", "状态"]}>{value.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td><code>{item.agentRunId}</code></td><td>{item.actionType}</td><td><code>{item.toolName || "-"}</code></td><td><StatusBadge value={item.status} /></td></tr>)}</DataTable>; }

function InlineForm({ children, onSubmit, disabled, submit }: { children: ReactNode; onSubmit: () => Promise<void>; disabled: boolean; submit: string }) { return <form className="agent-inline-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>{children}<button type="submit" className="primary-action" disabled={disabled}><Check />{submit}</button></form>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="agent-field"><span>{label}</span>{children}</label>; }
function ActionHead({ title, action }: { title: string; action: ReactNode }) { return <div className="agent-action-head"><strong>{title}</strong>{action}</div>; }
function SectionHead({ title, description }: { title: string; description: string }) { return <div className="agent-section-head"><strong>{title}</strong><span>{description}</span></div>; }
function Metric({ icon, label, value, tone = "normal" }: { icon: ReactNode; label: string; value?: number; tone?: string }) { return <div className={`agent-metric agent-metric--${tone}`}>{icon}<span>{label}</span><strong>{value || 0}</strong></div>; }
function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) { return <div className="data-table-wrap agent-data-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function StatusBadge({ value }: { value: string }) { return <span className={`agent-status agent-status--${value.replace(/_/g, "-")}`}>{statusLabel(value)}</span>; }
function EnvironmentBadge({ value }: { value: AgentEnvironment }) { return <span className={`agent-environment agent-environment--${value}`}>{value === "gray" ? "Gray" : "Production"}</span>; }
function Empty({ label }: { label: string }) { return <div className="agent-empty"><CirclePause /><span>{label}</span></div>; }
function Loading() { return <div className="starlight-page-loading"><Loader2 className="spin" />正在加载智能体治理数据...</div>; }
function viewTitle(view: AdminAgentRuntimeViewId) { return ({ controls: "AI 运行控制", models: "用途与模型绑定", policies: "恢复与候选选择", activity: "运行与审计" })[view]; }
function viewDescription(view: AdminAgentRuntimeViewId) { return ({ controls: "环境级开关与实时态势", models: "有界用途、发布配置与 LLM 路由", policies: "质量门、有限恢复与人工接管边界", activity: "Workflow Run、Agent Run、审批和动作证据" })[view]; }
function statusLabel(value: string) { return ({ enabled: "启用", disabled: "停用", draft: "草稿", review: "审核中", approved: "已批准", retired: "已退役", pending: "待处理", rejected: "已拒绝", cancelled: "已取消", running: "运行中", succeeded: "成功", failed: "失败", queued: "排队", planned: "已计划", paused: "已暂停", awaiting_approval: "等待审批", healthy: "健康", degraded: "降级", circuit_open: "熔断", legacy_browser: "浏览器运行", native_server: "服务端运行", observe: "观察", execute: "执行", modify: "修改", public: "公开", internal: "内部" } as Record<string, string>)[value] || value; }
function formatTime(value: number) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-"; }
function sameControl(left: AgentRuntimeControl, right: AgentRuntimeControl) { return left.agentEnabled === right.agentEnabled && left.canvasRunsEnabled === right.canvasRunsEnabled && left.automaticRecoveryEnabled === right.automaticRecoveryEnabled && left.qualityEvaluationEnabled === right.qualityEvaluationEnabled; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
